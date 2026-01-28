import type { Workspace } from "@openagentic/workspace";

import { resolveCwdPath } from "./path.js";

export type BuiltinIo = { env: Record<string, string>; cwd: string; stdin?: string };
export type BuiltinResult = { exitCode: number; stdout: string; stderr: string; cwd?: string };
export type BuiltinDeps = { workspace: Workspace; hasCommand?: (name: string) => boolean };

function asString(v: unknown): string {
  return typeof v === "string" ? v : String(v ?? "");
}

function isVarName(s: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
}

function isoDateFromEnv(env: Record<string, string>): string {
  const sde = env.SOURCE_DATE_EPOCH;
  if (typeof sde === "string" && sde.trim()) {
    const seconds = Number(sde);
    if (Number.isFinite(seconds)) return new Date(seconds * 1000).toISOString();
  }
  const msRaw = env.OPENAGENTIC_DATE_EPOCH_MS;
  if (typeof msRaw === "string" && msRaw.trim()) {
    const ms = Number(msRaw);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

function interpretBackslashEscapes(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c !== "\\") {
      out += c;
      continue;
    }
    const n = s[i + 1];
    if (n === undefined) {
      out += "\\";
      continue;
    }
    if (n === "n") {
      out += "\n";
      i++;
      continue;
    }
    if (n === "t") {
      out += "\t";
      i++;
      continue;
    }
    if (n === "r") {
      out += "\r";
      i++;
      continue;
    }
    if (n === "\\") {
      out += "\\";
      i++;
      continue;
    }
    out += n;
    i++;
  }
  return out;
}

function formatPrintfOnce(fmtRaw: string, args: string[], startIdx: number): { out: string; nextIdx: number; usedArg: boolean } {
  const fmt = interpretBackslashEscapes(fmtRaw);
  let out = "";
  let argIdx = startIdx;
  let usedArg = false;

  for (let i = 0; i < fmt.length; i++) {
    const c = fmt[i]!;
    if (c !== "%") {
      out += c;
      continue;
    }
    const n = fmt[i + 1];
    if (n === undefined) {
      out += "%";
      continue;
    }
    if (n === "%") {
      out += "%";
      i++;
      continue;
    }
    if (n === "s") {
      out += args[argIdx] ?? "";
      usedArg = true;
      argIdx++;
      i++;
      continue;
    }
    // Minimal: unknown specifier -> print literally.
    out += `%${n}`;
    i++;
  }

  return { out, nextIdx: argIdx, usedArg };
}

async function walkFiles(workspace: Workspace, dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await workspace.listDir(dir);
  for (const e of entries) {
    const p = dir ? `${dir}/${e.name}` : e.name;
    if (e.type === "dir") out.push(...(await walkFiles(workspace, p)));
    else out.push(p);
  }
  return out;
}

export async function runBuiltin(argv: string[], io: BuiltinIo, deps: BuiltinDeps): Promise<BuiltinResult | null> {
  const cmd = argv[0] ?? "";
  const args = argv.slice(1);

  if (cmd === ":" || cmd === "true") return { exitCode: 0, stdout: "", stderr: "" };
  if (cmd === "false") return { exitCode: 1, stdout: "", stderr: "" };

  if (cmd === "echo") {
    return { exitCode: 0, stdout: `${args.join(" ")}\n`, stderr: "" };
  }

  if (cmd === "printf") {
    const fmt = args[0] ?? "";
    const rest = args.slice(1);
    if (!fmt) return { exitCode: 0, stdout: "", stderr: "" };

    let out = "";
    let idx = 0;
    let first = true;
    while (first || idx < rest.length) {
      first = false;
      const one = formatPrintfOnce(fmt, rest, idx);
      out += one.out;
      if (!one.usedArg) break;
      idx = one.nextIdx;
    }
    return { exitCode: 0, stdout: out, stderr: "" };
  }

  if (cmd === "date") {
    if (args.length > 0) return { exitCode: 2, stdout: "", stderr: "date: flags not supported (v10: add format support)" };
    return { exitCode: 0, stdout: `${isoDateFromEnv(io.env)}\n`, stderr: "" };
  }

  if (cmd === "uname") {
    const flag = args[0] ?? "";
    if (flag && flag !== "-s") return { exitCode: 2, stdout: "", stderr: `uname: unsupported flag: ${asString(flag)}` };
    const v = io.env.OPENAGENTIC_UNAME ?? "WASI";
    return { exitCode: 0, stdout: `${v}\n`, stderr: "" };
  }

  if (cmd === "whoami") {
    const v = io.env.USER || io.env.OPENAGENTIC_WHOAMI || "unknown";
    return { exitCode: 0, stdout: `${v}\n`, stderr: "" };
  }

  if (cmd === "command") {
    const sub = args[0] ?? "";
    if (sub !== "-v") return { exitCode: 2, stdout: "", stderr: "command: only '-v' is supported" };
    const names = args.slice(1);
    if (names.length === 0) return { exitCode: 2, stdout: "", stderr: "command: name required" };
    const builtins = new Set([":", "true", "false", "echo", "date", "uname", "whoami", "pwd", "cd", "ls", "cat", "grep", "rg", "command"]);

    let ok = true;
    let out = "";
    for (const n of names) {
      if (!isVarName(n)) {
        ok = false;
        continue;
      }
      const found = builtins.has(n) || Boolean(deps.hasCommand?.(n));
      if (!found) {
        ok = false;
        continue;
      }
      out += `${n}\n`;
    }
    return { exitCode: ok ? 0 : 1, stdout: out, stderr: "" };
  }

  if (cmd === "pwd") {
    return { exitCode: 0, stdout: `${io.cwd || ""}\n`, stderr: "" };
  }

  if (cmd === "cd") {
    const target = args[0] ?? "";
    const next = resolveCwdPath(io.cwd, target);
    const st = await deps.workspace.stat(next);
    if (st && st.type !== "dir") return { exitCode: 1, stdout: "", stderr: `cd: not a directory: ${asString(target)}` };
    if (!st && next !== "") return { exitCode: 1, stdout: "", stderr: `cd: no such file or directory: ${asString(target)}` };
    return { exitCode: 0, stdout: "", stderr: "", cwd: next };
  }

  if (cmd === "ls") {
    const target = args[0] ?? "";
    const path = resolveCwdPath(io.cwd, target);
    const st = await deps.workspace.stat(path);
    if (st && st.type === "file") {
      const name = path.split("/").pop() ?? path;
      return { exitCode: 0, stdout: `${name}\n`, stderr: "" };
    }
    const entries = await deps.workspace.listDir(path);
    const names = entries.map((e) => e.name);
    return { exitCode: 0, stdout: names.join("\n") + (names.length ? "\n" : ""), stderr: "" };
  }

  if (cmd === "cat") {
    if (args.length === 0) return { exitCode: 0, stdout: io.stdin ?? "", stderr: "" };
    let out = "";
    for (const p0 of args) {
      const p = resolveCwdPath(io.cwd, p0);
      const bytes = await deps.workspace.readFile(p);
      out += new TextDecoder().decode(bytes);
    }
    return { exitCode: 0, stdout: out, stderr: "" };
  }

  if (cmd === "grep") {
    const pattern = args[0];
    if (typeof pattern !== "string" || !pattern) return { exitCode: 2, stdout: "", stderr: "grep: pattern required" };
    let rx: RegExp;
    try {
      rx = new RegExp(pattern);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      return { exitCode: 2, stdout: "", stderr: `grep: invalid regex: ${err.message}` };
    }

    const files = args.slice(1);
    const scanText = async (text: string): Promise<string> => {
      const lines = text.split(/\r?\n/);
      const matched: string[] = [];
      for (const line of lines) {
        if (rx.test(line)) matched.push(line);
      }
      return matched.length ? matched.join("\n") + "\n" : "";
    };

    if (files.length === 0) {
      return { exitCode: 0, stdout: await scanText(io.stdin ?? ""), stderr: "" };
    }

    let out = "";
    for (const f0 of files) {
      const p = resolveCwdPath(io.cwd, f0);
      const bytes = await deps.workspace.readFile(p);
      out += await scanText(new TextDecoder().decode(bytes));
    }
    return { exitCode: 0, stdout: out, stderr: "" };
  }

  if (cmd === "rg") {
    const flags: string[] = [];
    const rest: string[] = [];
    for (const a of args) {
      if (a.startsWith("-") && a.length > 1) flags.push(a);
      else rest.push(a);
    }

    const showLineNumbers = flags.includes("-n");
    const pattern = rest[0];
    const root = rest[1] ?? "";
    if (typeof pattern !== "string" || !pattern) return { exitCode: 2, stdout: "", stderr: "rg: pattern required" };
    let rx: RegExp;
    try {
      rx = new RegExp(pattern);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      return { exitCode: 2, stdout: "", stderr: `rg: invalid regex: ${err.message}` };
    }

    const files = await walkFiles(deps.workspace, root === "." ? "" : root);
    let out = "";
    let matched = false;
    for (const p of files) {
      const bytes = await deps.workspace.readFile(p).catch(() => null);
      if (!bytes) continue;
      const text = new TextDecoder().decode(bytes);
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (!rx.test(line)) continue;
        matched = true;
        out += showLineNumbers ? `${p}:${i + 1}:${line}\n` : `${p}:${line}\n`;
      }
    }

    return { exitCode: matched ? 0 : 1, stdout: out, stderr: "" };
  }

  return null;
}

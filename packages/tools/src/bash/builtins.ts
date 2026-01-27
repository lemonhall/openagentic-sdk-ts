import type { Workspace } from "@openagentic/workspace";

import { resolveCwdPath } from "./path.js";

export type BuiltinIo = { env: Record<string, string>; cwd: string; stdin?: string };
export type BuiltinResult = { exitCode: number; stdout: string; stderr: string; cwd?: string };

function asString(v: unknown): string {
  return typeof v === "string" ? v : String(v ?? "");
}

export async function runBuiltin(argv: string[], io: BuiltinIo, deps: { workspace: Workspace }): Promise<BuiltinResult | null> {
  const cmd = argv[0] ?? "";
  const args = argv.slice(1);

  if (cmd === "echo") {
    return { exitCode: 0, stdout: `${args.join(" ")}\n`, stderr: "" };
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

  return null;
}


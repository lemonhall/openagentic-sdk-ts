import type { Workspace } from "@openagentic/workspace";

import { parseScript } from "./parser.js";
import type { PipelineNode, Redir, ScriptNode, SequenceNode, WordToken } from "./parser.js";

export type ShellExecOptions = {
  env?: Record<string, string>;
  cwd?: string;
  stdin?: string;
  lastExitCode?: number;
};

export type ShellExecResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ShellCommandResult = ShellExecResult & { cwd?: string };

export type ShellCommandRunner = (
  argv: string[],
  io: { env: Record<string, string>; vars: Record<string, string>; exports: Set<string>; positional: string[]; cwd: string; stdin?: string },
  deps: { workspace: Workspace },
) => Promise<ShellCommandResult>;

type ShellState = {
  vars: Record<string, string>;
  env: Record<string, string>;
  exports: Set<string>;
  positional: string[];
  cwd: string;
  lastExitCode: number;
};

class ShellExit extends Error {
  readonly code: number;
  constructor(code: number) {
    super("Shell: exit");
    this.name = "ShellExit";
    this.code = code;
  }
}

function cloneState(s: ShellState): ShellState {
  return {
    vars: { ...s.vars },
    env: { ...s.env },
    exports: new Set(s.exports),
    positional: [...s.positional],
    cwd: s.cwd,
    lastExitCode: s.lastExitCode,
  };
}

function expandVars(token: string, ctx: { vars: Record<string, string>; positional: string[]; lastExitCode: number }): string {
  let out = "";
  for (let i = 0; i < token.length; i++) {
    const c = token[i]!;
    if (c !== "$") {
      out += c;
      continue;
    }
    const next = token[i + 1];
    if (next === "?") {
      out += String(ctx.lastExitCode);
      i++;
      continue;
    }
    if (next === "#") {
      out += String(ctx.positional.length);
      i++;
      continue;
    }
    if (next === "@" || next === "*") {
      out += ctx.positional.join(" ");
      i++;
      continue;
    }
    if (next && /[0-9]/.test(next)) {
      let j = i + 1;
      while (j < token.length && /[0-9]/.test(token[j]!)) j++;
      const n = Number(token.slice(i + 1, j));
      out += n >= 1 ? (ctx.positional[n - 1] ?? "") : "";
      i = j - 1;
      continue;
    }
    if (next === "{") {
      const end = token.indexOf("}", i + 2);
      if (end === -1) {
        out += "$";
        continue;
      }

      const inner = token.slice(i + 2, end);
      const defIdx = inner.indexOf(":-");
      const name = defIdx >= 0 ? inner.slice(0, defIdx) : inner;
      const defaultValue = defIdx >= 0 ? inner.slice(defIdx + 2) : null;

      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        i = end;
        continue;
      }

      const value = ctx.vars[name];
      if (defaultValue !== null) {
        out += value ? value : defaultValue;
      } else {
        out += value ?? "";
      }

      i = end;
      continue;
    }
    if (next && /[A-Za-z_]/.test(next)) {
      let j = i + 1;
      while (j < token.length && /[A-Za-z0-9_]/.test(token[j]!)) j++;
      const name = token.slice(i + 1, j);
      out += ctx.vars[name] ?? "";
      i = j - 1;
      continue;
    }
    out += "$";
  }
  return out;
}

function wildcardMatch(pattern: string, name: string): boolean {
  // Minimal globbing: '*' only.
  if (!pattern.includes("*")) return pattern === name;
  const [pre, ...rest] = pattern.split("*");
  if (!name.startsWith(pre)) return false;
  const suf = rest.join("*");
  if (!suf) return true;
  return name.endsWith(suf);
}

async function expandGlob(token: string, workspace: Workspace, cwd: string): Promise<string[]> {
  if (!token.includes("*")) return [token];
  const p = token.includes("/") ? token : (cwd ? `${cwd}/${token}` : token);
  const idx = p.lastIndexOf("/");
  const dir = idx >= 0 ? p.slice(0, idx) : "";
  const base = idx >= 0 ? p.slice(idx + 1) : p;

  const entries = await workspace.listDir(dir);
  const matches = entries.filter((e) => e.type === "file" && wildcardMatch(base, e.name)).map((e) => (dir ? `${dir}/${e.name}` : e.name));
  if (matches.length === 0) return [token];
  return matches;
}

function escapeRegExpCharClass(s: string): string {
  // Escape characters that are special inside [...].
  return s.replace(/[-\\\]^]/g, "\\$&");
}

function splitFields(s: string, ifs: string): string[] {
  if (ifs === "") return [s];
  const re = new RegExp(`[${escapeRegExpCharClass(ifs)}]+`, "g");
  return s.split(re).filter(Boolean);
}

async function tokenToWords(
  tok: WordToken,
  ctx: { state: ShellState; stdin?: string; lastExitCode: number },
  workspace: Workspace,
  deps: { runCommand: ShellCommandRunner },
): Promise<string[]> {
  const raw = tok.value;
  if (tok.quote === "single") return [raw];
  if (tok.quote === "double" && raw === "$@") return [...ctx.state.positional];
  let withVars = expandVars(raw, { vars: ctx.state.vars, positional: ctx.state.positional, lastExitCode: ctx.lastExitCode });
  withVars = await expandCommandSubstitutions(withVars, ctx, { workspace, runCommand: deps.runCommand });

  if (tok.quote !== "none") return [withVars];
  // POSIX-ish behavior: empty unquoted expansions produce no word.
  if (withVars === "") return [];
  const ifs = typeof ctx.state.vars.IFS === "string" ? ctx.state.vars.IFS : " \t\n";
  const fields = splitFields(withVars, ifs);
  const out: string[] = [];
  for (const f of fields) {
    out.push(...(await expandGlob(f, workspace, ctx.state.cwd)));
  }
  return out;
}

async function expandText(
  raw: string,
  ctx: { state: ShellState; stdin?: string; lastExitCode: number },
  deps: { runCommand: ShellCommandRunner; workspace: Workspace },
): Promise<string> {
  let withVars = expandVars(raw, { vars: ctx.state.vars, positional: ctx.state.positional, lastExitCode: ctx.lastExitCode });
  return expandCommandSubstitutions(withVars, ctx, deps);
}

async function tokensToArgv(
  tokens: WordToken[],
  ctx: { state: ShellState; stdin?: string; lastExitCode: number },
  workspace: Workspace,
  deps: { runCommand: ShellCommandRunner },
): Promise<string[]> {
  const out: string[] = [];
  for (const t of tokens) {
    const expanded = await tokenToWords(t, ctx, workspace, deps);
    out.push(...expanded);
  }
  return out;
}

async function expandCommandSubstitutions(
  text: string,
  ctx: { state: ShellState; stdin?: string; lastExitCode: number },
  deps: { runCommand: ShellCommandRunner; workspace: Workspace },
): Promise<string> {
  if (!text.includes("$(")) return text;
  let out = "";
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "$" || text[i + 1] !== "(") {
      out += text[i]!;
      continue;
    }

    const start = i + 2;
    let j = start;
    let depth = 1;
    while (j < text.length && depth > 0) {
      const c = text[j]!;
      if (c === "(") depth++;
      else if (c === ")") depth--;
      j++;
    }
    if (depth !== 0) throw new Error("Shell: unterminated command substitution");

    const inner = text.slice(start, j - 1);
    const innerAst = parseScript(inner);
    const subState = cloneState(ctx.state);
    subState.lastExitCode = ctx.lastExitCode;
    const innerRes = await execSequenceWithState(innerAst, { state: subState, stdin: ctx.stdin }, deps);
    const captured = String(innerRes.stdout ?? "").replace(/\r?\n$/, "");

    out += captured;
    i = j - 1;
  }
  return out;
}

async function execSequenceWithState(
  ast: ScriptNode,
  opts: { state: ShellState; stdin?: string },
  deps: { runCommand: ShellCommandRunner; workspace: Workspace },
): Promise<ShellExecResult> {
  const state = opts.state;
  const { runCommand, workspace } = deps;

  const applyOutputRedirs = async (
    redirs: Redir[],
    out0: { stdout: string; stderr: string },
    ctx: { cwd: string; lastExitCode: number },
  ): Promise<{ stdout: string; stderr: string }> => {
    type Sink =
      | { kind: "capture"; stream: "stdout" | "stderr" }
      | { kind: "file"; path: string; append: boolean };

    const stdoutSink: Sink = { kind: "capture", stream: "stdout" };
    const stderrSink: Sink = { kind: "capture", stream: "stderr" };

    let fd1: Sink = stdoutSink;
    let fd2: Sink = stderrSink;

    for (const r of redirs) {
      if (r.kind === "out" || r.kind === "append") {
        const [p0] = await tokenToWords(r.path, { state, stdin: opts.stdin, lastExitCode: ctx.lastExitCode }, workspace, { runCommand });
        fd1 = { kind: "file", path: p0, append: r.kind === "append" };
        continue;
      }
      if (r.kind === "err" || r.kind === "errAppend") {
        const [p0] = await tokenToWords(r.path, { state, stdin: opts.stdin, lastExitCode: ctx.lastExitCode }, workspace, { runCommand });
        fd2 = { kind: "file", path: p0, append: r.kind === "errAppend" };
        continue;
      }
      if (r.kind === "errToOut") {
        // NOTE: ordering matters; this copies fd1 "as of now".
        fd2 = fd1;
        continue;
      }
      if (r.kind === "outToErr") {
        // NOTE: ordering matters; this copies fd2 "as of now".
        fd1 = fd2;
        continue;
      }
    }

    const pieces = new Map<Sink, string>();
    pieces.set(fd1, (pieces.get(fd1) ?? "") + out0.stdout);
    pieces.set(fd2, (pieces.get(fd2) ?? "") + out0.stderr);

    let stdout = "";
    let stderr = "";

    for (const [sink, data] of pieces.entries()) {
      if (!data) continue;

      if (sink.kind === "capture") {
        if (sink.stream === "stdout") stdout += data;
        else stderr += data;
        continue;
      }

      const bytes = new TextEncoder().encode(data);
      if (sink.append) {
        const existing = await workspace.readFile(sink.path).catch(() => new Uint8Array());
        const combined = new Uint8Array(existing.byteLength + bytes.byteLength);
        combined.set(existing, 0);
        combined.set(bytes, existing.byteLength);
        await workspace.writeFile(sink.path, combined);
      } else {
        await workspace.writeFile(sink.path, bytes);
      }
    }

    return { stdout, stderr };
  };

  const runPipeline = async (pipeline: PipelineNode): Promise<ShellExecResult> => {
    let stdin: string | undefined = opts.stdin;
    let lastStdout = "";
    let lastStderr = "";
    let lastExit = 0;

    for (let i = 0; i < pipeline.commands.length; i++) {
      const cmd = pipeline.commands[i];
      const preExit = state.lastExitCode;

      try {
        const assigns = cmd.assigns ?? [];
        const assignsMap: Record<string, string> = {};
        for (const a of assigns) {
          const eq = a.value.indexOf("=");
          if (eq <= 0) continue;
          const name = a.value.slice(0, eq);
          const valueRaw = a.value.slice(eq + 1);
          assignsMap[name] = await expandText(valueRaw, { state, stdin, lastExitCode: preExit }, { runCommand, workspace });
        }

        if (cmd.subshell) {
          // Apply redirects for the subshell "command".
          for (const r of cmd.redirs) {
            if (r.kind !== "in") continue;
            const [p0] = await tokenToWords(r.path, { state, stdin, lastExitCode: preExit }, workspace, { runCommand });
            const bytes = await workspace.readFile(p0);
            stdin = new TextDecoder().decode(bytes);
          }

          const subState = cloneState(state);
          for (const [k, v] of Object.entries(assignsMap)) {
            subState.vars[k] = v;
            subState.env[k] = v;
            subState.exports.add(k);
          }
          const out = await execSequenceWithState(cmd.subshell, { state: subState, stdin }, { runCommand, workspace });
          lastExit = Number(out.exitCode ?? 0);
          const after = await applyOutputRedirs(cmd.redirs, { stdout: String(out.stdout ?? ""), stderr: String(out.stderr ?? "") }, { cwd: state.cwd, lastExitCode: preExit });
          lastStdout = after.stdout;
          lastStderr = after.stderr;
          stdin = lastStdout;
          state.lastExitCode = lastExit;
        } else {
          // Standalone assignments: persist into shell vars; exported vars also update env.
          if (cmd.argv.length === 0 && Object.keys(assignsMap).length > 0) {
            for (const [k, v] of Object.entries(assignsMap)) {
              state.vars[k] = v;
              if (state.exports.has(k)) state.env[k] = v;
            }
            lastExit = 0;
            lastStdout = "";
            lastStderr = "";
            stdin = "";
            state.lastExitCode = 0;
            continue;
          }

          const argv = await tokensToArgv(cmd.argv, { state, stdin, lastExitCode: preExit }, workspace, { runCommand });

          if ((argv[0] ?? "") === "exit") {
            const raw = argv[1];
            const code = raw === undefined ? state.lastExitCode : Number(raw);
            const normalized = Number.isInteger(code) ? code : 2;
            throw new ShellExit(normalized);
          }

          // Apply input redirection on first command only (v1 simplification).
          for (const r of cmd.redirs) {
            if (r.kind !== "in") continue;
            const [p0] = await tokenToWords(r.path, { state, stdin, lastExitCode: preExit }, workspace, { runCommand });
            const bytes = await workspace.readFile(p0);
            stdin = new TextDecoder().decode(bytes);
          }

        const prior = new Map<string, string | undefined>();
        for (const [k, v] of Object.entries(assignsMap)) {
          prior.set(k, state.env[k]);
          state.env[k] = v;
        }
        let out: ShellCommandResult;
        try {
          const io = { env: state.env, vars: state.vars, exports: state.exports, positional: state.positional, cwd: state.cwd, stdin };
          out = await runCommand(argv, io, { workspace });
          state.positional = io.positional;
        } finally {
          for (const [k, prev] of prior.entries()) {
            // Only restore prefix-assigned values if they were not modified during execution.
            if (state.env[k] === assignsMap[k]) {
                if (prev === undefined) delete state.env[k];
                else state.env[k] = prev;
              }
            }
          }
          lastExit = Number(out.exitCode ?? 0);
          const after = await applyOutputRedirs(cmd.redirs, { stdout: String(out.stdout ?? ""), stderr: String(out.stderr ?? "") }, { cwd: state.cwd, lastExitCode: preExit });
          lastStdout = after.stdout;
          lastStderr = after.stderr;
          if (typeof out.cwd === "string") state.cwd = out.cwd;
          stdin = lastStdout;
          state.lastExitCode = lastExit;
        }
      } catch (e) {
        if (e instanceof ShellExit) throw e;
        const err = e instanceof Error ? e : new Error(String(e));
        lastExit = 127;
        const after = await applyOutputRedirs(cmd.redirs, { stdout: "", stderr: err.message }, { cwd: state.cwd, lastExitCode: preExit });
        lastStdout = after.stdout;
        lastStderr = after.stderr;
        state.lastExitCode = lastExit;
        // If a pipeline step fails to start (e.g., unknown command), stop the pipeline.
        break;
      }
    }

    return { exitCode: lastExit, stdout: lastStdout, stderr: lastStderr };
  };

  const runSequence = async (seq: SequenceNode): Promise<ShellExecResult> => {
    let acc = await runPipeline(seq.head);
    for (const step of seq.tail) {
      const shouldRun = step.op === "&&" ? acc.exitCode === 0 : acc.exitCode !== 0;
      if (!shouldRun) continue;
      acc = await runPipeline(step.pipeline);
    }
    return acc;
  };

  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  try {
    for (const seq of ast.sequences) {
      const out = await runSequence(seq);
      stdout += out.stdout;
      stderr += out.stderr;
      exitCode = out.exitCode;
      state.lastExitCode = out.exitCode;
    }
  } catch (e) {
    if (e instanceof ShellExit) return { exitCode: e.code, stdout, stderr };
    throw e;
  }

  return { exitCode, stdout, stderr };
}

export async function execSequence(
  ast: ScriptNode,
  opts: ShellExecOptions,
  deps: { runCommand: ShellCommandRunner; workspace: Workspace },
): Promise<ShellExecResult> {
  const initEnv = { ...(opts.env ?? {}) };
  const state: ShellState = {
    vars: { ...initEnv },
    env: { ...initEnv },
    exports: new Set(Object.keys(initEnv)),
    positional: [],
    cwd: opts.cwd ?? "",
    lastExitCode: opts.lastExitCode ?? 0,
  };
  return execSequenceWithState(ast, { state, stdin: opts.stdin }, deps);
}

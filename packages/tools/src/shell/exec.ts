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

export type ShellCommandRunner = (argv: string[], io: { env: Record<string, string>; cwd: string; stdin?: string }, deps: { workspace: Workspace }) => Promise<ShellCommandResult>;

function expandVars(token: string, env: Record<string, string>, lastExitCode: number): string {
  let out = "";
  for (let i = 0; i < token.length; i++) {
    const c = token[i]!;
    if (c !== "$") {
      out += c;
      continue;
    }
    const next = token[i + 1];
    if (next === "?") {
      out += String(lastExitCode);
      i++;
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

      const value = env[name];
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
      out += env[name] ?? "";
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

async function tokenToWords(
  tok: WordToken,
  env: Record<string, string>,
  workspace: Workspace,
  cwd: string,
  lastExitCode: number,
  runCommand: ShellCommandRunner,
): Promise<string[]> {
  const raw = tok.value;
  if (tok.quote === "single") return [raw];
  let withVars = expandVars(raw, env, lastExitCode);

  if (withVars.includes("$(")) {
    let out = "";
    for (let i = 0; i < withVars.length; i++) {
      if (withVars[i] !== "$" || withVars[i + 1] !== "(") {
        out += withVars[i]!;
        continue;
      }

      const start = i + 2;
      let j = start;
      let depth = 1;
      while (j < withVars.length && depth > 0) {
        const c = withVars[j]!;
        if (c === "(") depth++;
        else if (c === ")") depth--;
        j++;
      }
      if (depth !== 0) throw new Error("Shell: unterminated command substitution");

      const inner = withVars.slice(start, j - 1);
      const innerAst = parseScript(inner);
      const innerRes = await execSequence(innerAst, { env, cwd, lastExitCode }, { runCommand, workspace });
      const captured = String(innerRes.stdout ?? "").replace(/\r?\n$/, "");

      out += captured;
      i = j - 1;
    }
    withVars = out;
  }

  if (tok.quote !== "none") return [withVars];
  // POSIX-ish behavior: empty unquoted expansions produce no word.
  if (withVars === "") return [];
  return expandGlob(withVars, workspace, cwd);
}

async function tokensToArgv(
  tokens: WordToken[],
  env: Record<string, string>,
  workspace: Workspace,
  cwd: string,
  lastExitCode: number,
  runCommand: ShellCommandRunner,
): Promise<string[]> {
  const out: string[] = [];
  for (const t of tokens) {
    const expanded = await tokenToWords(t, env, workspace, cwd, lastExitCode, runCommand);
    out.push(...expanded);
  }
  return out;
}

export async function execSequence(
  ast: ScriptNode,
  opts: ShellExecOptions,
  deps: { runCommand: ShellCommandRunner; workspace: Workspace },
): Promise<ShellExecResult> {
  const env = opts.env ?? {};
  const state = { cwd: opts.cwd ?? "", lastExitCode: opts.lastExitCode ?? 0 };
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
        const [p0] = await tokenToWords(r.path, env, workspace, ctx.cwd, ctx.lastExitCode, runCommand);
        fd1 = { kind: "file", path: p0, append: r.kind === "append" };
        continue;
      }
      if (r.kind === "err" || r.kind === "errAppend") {
        const [p0] = await tokenToWords(r.path, env, workspace, ctx.cwd, ctx.lastExitCode, runCommand);
        fd2 = { kind: "file", path: p0, append: r.kind === "errAppend" };
        continue;
      }
      if (r.kind === "errToOut") {
        // NOTE: ordering matters; this copies fd1 "as of now".
        fd2 = fd1;
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
        if (cmd.subshell) {
          // Apply redirects for the subshell "command".
          for (const r of cmd.redirs) {
            if (r.kind !== "in") continue;
            const [p0] = await tokenToWords(r.path, env, workspace, state.cwd, preExit, runCommand);
            const bytes = await workspace.readFile(p0);
            stdin = new TextDecoder().decode(bytes);
          }

          const out = await execSequence(
            cmd.subshell,
            { env, cwd: state.cwd, stdin, lastExitCode: preExit },
            { runCommand, workspace },
          );
          lastExit = Number(out.exitCode ?? 0);
          const after = await applyOutputRedirs(cmd.redirs, { stdout: String(out.stdout ?? ""), stderr: String(out.stderr ?? "") }, { cwd: state.cwd, lastExitCode: preExit });
          lastStdout = after.stdout;
          lastStderr = after.stderr;
          stdin = lastStdout;
          state.lastExitCode = lastExit;
        } else {
          const argv = await tokensToArgv(cmd.argv, env, workspace, state.cwd, preExit, runCommand);

          // Apply input redirection on first command only (v1 simplification).
          for (const r of cmd.redirs) {
            if (r.kind !== "in") continue;
            const [p0] = await tokenToWords(r.path, env, workspace, state.cwd, preExit, runCommand);
            const bytes = await workspace.readFile(p0);
            stdin = new TextDecoder().decode(bytes);
          }

          const out = await runCommand(argv, { env, cwd: state.cwd, stdin }, { workspace });
          lastExit = Number(out.exitCode ?? 0);
          const after = await applyOutputRedirs(cmd.redirs, { stdout: String(out.stdout ?? ""), stderr: String(out.stderr ?? "") }, { cwd: state.cwd, lastExitCode: preExit });
          lastStdout = after.stdout;
          lastStderr = after.stderr;
          if (typeof out.cwd === "string") state.cwd = out.cwd;
          stdin = lastStdout;
          state.lastExitCode = lastExit;
        }
      } catch (e) {
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

  for (const seq of ast.sequences) {
    const out = await runSequence(seq);
    stdout += out.stdout;
    stderr += out.stderr;
    exitCode = out.exitCode;
    state.lastExitCode = out.exitCode;
  }

  return { exitCode, stdout, stderr };
}

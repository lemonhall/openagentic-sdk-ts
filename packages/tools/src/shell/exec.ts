import type { Workspace } from "@openagentic/workspace";

import type { PipelineNode, ScriptNode, SequenceNode, WordToken } from "./parser.js";

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
): Promise<string[]> {
  const raw = tok.value;
  if (tok.quote === "single") return [raw];
  const withVars = expandVars(raw, env, lastExitCode);
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
): Promise<string[]> {
  const out: string[] = [];
  for (const t of tokens) {
    const expanded = await tokenToWords(t, env, workspace, cwd, lastExitCode);
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

  const runPipeline = async (pipeline: PipelineNode): Promise<ShellExecResult> => {
    let stdin: string | undefined = opts.stdin;
    let lastStdout = "";
    let lastStderr = "";
    let lastExit = 0;

    for (let i = 0; i < pipeline.commands.length; i++) {
      const cmd = pipeline.commands[i];

      try {
        if (cmd.subshell) {
          // Apply redirects for the subshell "command".
          for (const r of cmd.redirs) {
            if (r.kind !== "in") continue;
            const [p0] = await tokenToWords(r.path, env, workspace, state.cwd, state.lastExitCode);
            const bytes = await workspace.readFile(p0);
            stdin = new TextDecoder().decode(bytes);
          }

          const out = await execSequence(
            cmd.subshell,
            { env, cwd: state.cwd, stdin, lastExitCode: state.lastExitCode },
            { runCommand, workspace },
          );
          lastExit = Number(out.exitCode ?? 0);
          lastStdout = String(out.stdout ?? "");
          lastStderr = String(out.stderr ?? "");
          stdin = lastStdout;
          state.lastExitCode = lastExit;
        } else {
          const argv = await tokensToArgv(cmd.argv, env, workspace, state.cwd, state.lastExitCode);

          // Apply input redirection on first command only (v1 simplification).
          for (const r of cmd.redirs) {
            if (r.kind !== "in") continue;
            const [p0] = await tokenToWords(r.path, env, workspace, state.cwd, state.lastExitCode);
            const bytes = await workspace.readFile(p0);
            stdin = new TextDecoder().decode(bytes);
          }

          const out = await runCommand(argv, { env, cwd: state.cwd, stdin }, { workspace });
          lastExit = Number(out.exitCode ?? 0);
          lastStdout = String(out.stdout ?? "");
          lastStderr = String(out.stderr ?? "");
          if (typeof out.cwd === "string") state.cwd = out.cwd;
          stdin = lastStdout;
          state.lastExitCode = lastExit;
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        lastExit = 127;
        lastStdout = "";
        lastStderr = err.message;
        state.lastExitCode = lastExit;
        // If a pipeline step fails to start (e.g., unknown command), stop the pipeline.
        break;
      }
    }

    // Apply output redirection from the last command.
    const last = pipeline.commands.at(-1)!;
    for (const r of last.redirs) {
      if (r.kind !== "out" && r.kind !== "append") continue;
      const [p0] = await tokenToWords(r.path, env, workspace, state.cwd, state.lastExitCode);
      const data = new TextEncoder().encode(lastStdout);
      if (r.kind === "append") {
        const existing = await workspace.readFile(p0).catch(() => new Uint8Array());
        const combined = new Uint8Array(existing.byteLength + data.byteLength);
        combined.set(existing, 0);
        combined.set(data, existing.byteLength);
        await workspace.writeFile(p0, combined);
      } else {
        await workspace.writeFile(p0, data);
      }
      lastStdout = "";
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

import type { Workspace } from "@openagentic/workspace";

import type { CommandTool } from "../command.js";
import type { SequenceNode, WordToken } from "./parser.js";

export type ShellExecOptions = {
  env?: Record<string, string>;
  cwd?: string;
};

export type ShellExecResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function expandVars(token: string, env: Record<string, string>): string {
  return token.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_m, name) => env[name] ?? "");
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

async function tokenToWords(tok: WordToken, env: Record<string, string>, workspace: Workspace, cwd: string): Promise<string[]> {
  const raw = tok.value;
  if (tok.quote === "single") return [raw];
  const withVars = expandVars(raw, env);
  if (tok.quote !== "none") return [withVars];
  return expandGlob(withVars, workspace, cwd);
}

async function tokensToArgv(tokens: WordToken[], env: Record<string, string>, workspace: Workspace, cwd: string): Promise<string[]> {
  const out: string[] = [];
  for (const t of tokens) {
    const expanded = await tokenToWords(t, env, workspace, cwd);
    out.push(...expanded);
  }
  return out;
}

export async function execSequence(
  ast: SequenceNode,
  opts: ShellExecOptions,
  deps: { command: CommandTool; workspace: Workspace },
): Promise<ShellExecResult> {
  const env = opts.env ?? {};
  const cwd = opts.cwd ?? "";
  const { command, workspace } = deps;

  const runPipeline = async (pipeline: SequenceNode["head"]): Promise<ShellExecResult> => {
    let stdin: string | undefined;
    let lastStdout = "";
    let lastStderr = "";
    let lastExit = 0;

    for (let i = 0; i < pipeline.commands.length; i++) {
      const cmd = pipeline.commands[i];
      const argv = await tokensToArgv(cmd.argv, env, workspace, cwd);

      // Apply input redirection on first command only (v1 simplification).
      for (const r of cmd.redirs) {
        if (r.kind !== "in") continue;
        const [p0] = await tokenToWords(r.path, env, workspace, cwd);
        const bytes = await workspace.readFile(p0);
        stdin = new TextDecoder().decode(bytes);
      }

      try {
        const out = (await command.run(
          { argv, cwd, env, stdin, limits: { maxStdoutBytes: 1024 * 1024, maxStderrBytes: 1024 * 1024 } },
          { sessionId: "shell", toolUseId: `shell:${i}`, workspace } as any,
        )) as any;
        lastExit = Number(out.exitCode ?? 0);
        lastStdout = String(out.stdout ?? "");
        lastStderr = String(out.stderr ?? "");
        stdin = lastStdout;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        lastExit = 127;
        lastStdout = "";
        lastStderr = err.message;
        // If a pipeline step fails to start (e.g., unknown command), stop the pipeline.
        break;
      }
    }

    // Apply output redirection from the last command.
    const last = pipeline.commands.at(-1)!;
    for (const r of last.redirs) {
      if (r.kind !== "out" && r.kind !== "append") continue;
      const [p0] = await tokenToWords(r.path, env, workspace, cwd);
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

  let acc = await runPipeline(ast.head);
  for (const step of ast.tail) {
    const shouldRun = step.op === "&&" ? acc.exitCode === 0 : acc.exitCode !== 0;
    if (!shouldRun) continue;
    acc = await runPipeline(step.pipeline);
  }
  return acc;
}

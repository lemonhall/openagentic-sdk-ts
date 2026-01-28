import type { Tool, ToolContext } from "@openagentic/sdk-core";
import type { Workspace } from "@openagentic/workspace";

import { execSequence } from "../shell/exec.js";
import { parse } from "../shell/parser.js";
import type { CommandTool } from "../command.js";
import { runBuiltin } from "./builtins.js";

export type BashToolOptions = {
  maxOutputBytes?: number;
  wasiCommand?: CommandTool;
};

function truncateBytes(s: string, maxBytes: number): { text: string; truncated: boolean } {
  const enc = new TextEncoder().encode(s);
  if (enc.byteLength <= maxBytes) return { text: s, truncated: false };
  return { text: new TextDecoder().decode(enc.slice(0, maxBytes)), truncated: true };
}

export class BashTool implements Tool {
  readonly name = "Bash";
  readonly description = "Run a restricted shell command over the shadow workspace (pipes/redirection supported; not host bash).";
  readonly inputSchema = {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command string." },
      cwd: { type: "string", description: "Workspace-relative current directory (optional)." },
      workdir: { type: "string", description: "Alias of cwd." },
      env: { type: "object", additionalProperties: { type: "string" }, description: "Environment variables (optional)." },
    },
    required: ["command"],
  };

  readonly #maxOutputBytes: number;
  readonly #wasiCommand?: CommandTool;

  constructor(options: BashToolOptions = {}) {
    this.#maxOutputBytes =
      typeof options.maxOutputBytes === "number" && options.maxOutputBytes > 0 ? Math.trunc(options.maxOutputBytes) : 1024 * 1024;
    this.#wasiCommand = options.wasiCommand;
  }

  async run(toolInput: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const workspace = (ctx as any).workspace as Workspace | undefined;
    if (!workspace) throw new Error("Bash: workspace is required in ToolContext");

    const command = toolInput.command;
    if (typeof command !== "string" || !command.trim()) throw new Error("Bash: 'command' must be a non-empty string");

    const env = typeof toolInput.env === "object" && toolInput.env ? (toolInput.env as Record<string, string>) : {};
    const cwdRaw = (toolInput.cwd ?? toolInput.workdir) as unknown;
    const cwd = typeof cwdRaw === "string" ? cwdRaw : "";

    const ast = parse(command);
    const res = await execSequence(ast, { env, cwd }, {
      workspace,
      runCommand: async (argv, io, deps) => {
        const cmdName = argv[0] ?? "";

        // Always allow a small builtin set to run even when using WASI bundles.
        // These are either shell-control primitives or host-provided utilities.
        const forcedBuiltins = new Set([
          // shell-control primitives (must be builtins; can't be delegated)
          ":",
          "true",
          "false",
          "command",
          "export",
          "unset",
          "set",
          "shift",
          "test",
          "[",
          "cd",
          "pwd",
          // host-provided utilities (keep deterministic + portable)
          "date",
          "uname",
          "whoami",
          "rg",
          // baseline convenience builtins
          "echo",
          "printf",
          // prefer host builtins over minimal WASI stubs (core-utils v0.0.0)
          "cat",
          "ls",
          "grep",
        ]);
        const hasCommand = (n: string) => Boolean((this.#wasiCommand as any)?.hasCommand?.(n));
        if (forcedBuiltins.has(cmdName)) {
          const out = await runBuiltin(argv, io, { workspace: deps.workspace, hasCommand });
          if (!out) throw new Error(`unknown command: ${cmdName}`);
          return out;
        }

        if (this.#wasiCommand && hasCommand(cmdName)) {
          const out = (await this.#wasiCommand.run(
            {
              argv,
              cwd: io.cwd,
              env: io.env,
              stdin: io.stdin,
              limits: { maxStdoutBytes: this.#maxOutputBytes, maxStderrBytes: this.#maxOutputBytes },
            },
            { sessionId: ctx.sessionId, toolUseId: `${ctx.toolUseId}:cmd`, workspace: deps.workspace } as any,
          )) as any;
          return { exitCode: Number(out.exitCode ?? out.exit_code ?? 0), stdout: String(out.stdout ?? ""), stderr: String(out.stderr ?? "") };
        }

        const out = await runBuiltin(argv, io, { workspace: deps.workspace, hasCommand });
        if (!out) throw new Error(`unknown command: ${argv[0] ?? ""}`);
        return out;
      },
    });

    const stdoutT = truncateBytes(res.stdout, this.#maxOutputBytes);
    const stderrT = truncateBytes(res.stderr, this.#maxOutputBytes);
    const output = stdoutT.text + stderrT.text;

    return {
      command,
      exit_code: res.exitCode,
      stdout: stdoutT.text,
      stderr: stderrT.text,
      stdout_truncated: stdoutT.truncated,
      stderr_truncated: stderrT.truncated,
      output_lines_truncated: false,
      full_output_file_path: null,
      output,
      exitCode: res.exitCode,
      killed: false,
      shellId: null,
    };
  }
}

import type { Tool, ToolContext } from "@openagentic/sdk-core";
import type { NativeRunner } from "@openagentic/native-runner";

export type NativeBashToolOptions = {
  runner: NativeRunner;
  maxOutputBytes?: number;
  timeoutMs?: number;
};

function truncateBytes(bytes: Uint8Array, maxBytes: number): { bytes: Uint8Array; truncated: boolean } {
  if (bytes.byteLength <= maxBytes) return { bytes, truncated: false };
  return { bytes: bytes.slice(0, maxBytes), truncated: true };
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export class NativeBashTool implements Tool {
  readonly name = "Bash";
  readonly description =
    "Run host-native bash inside a sandboxed shadow workspace (backend-dependent). Supports full bash syntax (pipes/redirection).";
  readonly inputSchema = {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command string." },
      cwd: { type: "string", description: "Workspace-relative current directory (optional)." },
      workdir: { type: "string", description: "Alias of cwd." },
      env: { type: "object", additionalProperties: { type: "string" }, description: "Environment variables (optional)." },
      stdin: { type: "string", description: "Optional stdin (UTF-8 text)." },
    },
    required: ["command"],
  };

  readonly #runner: NativeRunner;
  readonly #maxOutputBytes: number;
  readonly #timeoutMs: number;

  constructor(options: NativeBashToolOptions) {
    this.#runner = options.runner;
    this.#maxOutputBytes =
      typeof options.maxOutputBytes === "number" && options.maxOutputBytes > 0 ? Math.trunc(options.maxOutputBytes) : 1024 * 1024;
    this.#timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? Math.trunc(options.timeoutMs) : 60_000;
  }

  async run(toolInput: Record<string, unknown>, _ctx: ToolContext): Promise<unknown> {
    const command = toolInput.command;
    if (typeof command !== "string" || !command.trim()) throw new Error("Bash: 'command' must be a non-empty string");

    const env = typeof toolInput.env === "object" && toolInput.env ? (toolInput.env as Record<string, string>) : undefined;
    const cwdRaw = (toolInput.cwd ?? toolInput.workdir) as unknown;
    const cwd = typeof cwdRaw === "string" ? cwdRaw : undefined;
    const stdinText = typeof toolInput.stdin === "string" ? toolInput.stdin : "";
    const stdinBytes = stdinText ? new TextEncoder().encode(stdinText) : undefined;

    const res = await this.#runner.exec({
      argv: ["bash", "-lc", command],
      ...(cwd ? { cwd } : {}),
      ...(env ? { env } : {}),
      ...(stdinBytes ? { stdin: stdinBytes } : {}),
      limits: { maxStdoutBytes: this.#maxOutputBytes, maxStderrBytes: this.#maxOutputBytes, timeoutMs: this.#timeoutMs },
    });

    const stdoutT = truncateBytes(res.stdout, this.#maxOutputBytes);
    const stderrT = truncateBytes(res.stderr, this.#maxOutputBytes);
    const stdout = decodeUtf8(stdoutT.bytes);
    const stderr = decodeUtf8(stderrT.bytes);
    const output = stdout + stderr;

    return {
      command,
      exit_code: res.exitCode,
      stdout,
      stderr,
      stdout_truncated: stdoutT.truncated || res.truncatedStdout,
      stderr_truncated: stderrT.truncated || res.truncatedStderr,
      output_lines_truncated: false,
      full_output_file_path: null,
      output,
      exitCode: res.exitCode,
      killed: false,
      shellId: null,
    };
  }
}

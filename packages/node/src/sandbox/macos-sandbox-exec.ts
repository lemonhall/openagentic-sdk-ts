import type { NativeExecInput, NativeExecResult, NativeRunner } from "@openagentic/native-runner";
import type { ProcessSandbox, ProcessSandboxCommand } from "@openagentic/wasi-runner-wasmtime";
import { spawn } from "node:child_process";
import { join } from "node:path";

export type SandboxExecNetworkMode = "allow" | "deny";

export type SandboxExecOptions = {
  sandboxExecPath?: string;
  network?: SandboxExecNetworkMode;
  /**
   * When mounts include this `label`, its `hostPath` is treated as the shadow workspace root
   * and is the only path allowed for read/write.
   */
  shadowMountLabel?: string;
};

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

function sbplQuote(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function buildSandboxExecProfile(options: { shadowDirHostPath: string; network: SandboxExecNetworkMode }): string {
  const shadow = sbplQuote(options.shadowDirHostPath);
  const allowNet = options.network === "allow";

  return [
    "(version 1)",
    // Best-effort: sandbox-exec policies vary by macOS version. Keep this readable and explicit.
    "(deny default)",
    "(allow process*)",
    // Allow reading basic system locations needed for executing host binaries.
    '(allow file-read* (subpath "/System") (subpath "/usr") (subpath "/bin") (subpath "/sbin") (subpath "/private"))',
    // Allow read/write only under the operator-provided shadow directory.
    `(allow file-read* file-write* (subpath "${shadow}"))`,
    allowNet ? "(allow network*)" : "(deny network*)",
  ].join("\n");
}

export function createSandboxExecProcessSandbox(opts: SandboxExecOptions = {}): ProcessSandbox {
  const sandboxExecPath = opts.sandboxExecPath ?? "sandbox-exec";
  const network = opts.network ?? "deny";
  const shadowMountLabel = opts.shadowMountLabel ?? "shadow-workspace";

  return {
    name: "sandbox-exec",
    wrap(command: ProcessSandboxCommand) {
      const mounts = command.mounts ?? [];
      const shadow = mounts.find((m) => m.label === shadowMountLabel)?.hostPath;
      if (!shadow) throw new Error(`sandbox-exec: missing mount with label=${shadowMountLabel}`);

      const profile = buildSandboxExecProfile({ shadowDirHostPath: shadow, network });
      return {
        cmd: sandboxExecPath,
        args: ["-p", profile, "--", command.cmd, ...command.args],
        env: command.env,
        cwd: command.cwd ?? shadow,
      };
    },
  };
}

export function buildSandboxExecNativeArgv(options: {
  sandboxExecPath: string;
  profile: string;
  commandArgv: string[];
}): { cmd: string; args: string[] } {
  return { cmd: options.sandboxExecPath, args: ["-p", options.profile, "--", ...options.commandArgv] };
}

export type SandboxExecNativeRunnerOptions = {
  sandboxExecPath?: string;
  shadowDir: string;
  network?: SandboxExecNetworkMode;
};

export class SandboxExecNativeRunner implements NativeRunner {
  readonly sandboxExecPath: string;
  readonly shadowDir: string;
  readonly network: SandboxExecNetworkMode;

  constructor(options: SandboxExecNativeRunnerOptions) {
    this.sandboxExecPath = options.sandboxExecPath ?? "sandbox-exec";
    this.shadowDir = options.shadowDir;
    this.network = options.network ?? "deny";
  }

  async exec(input: NativeExecInput): Promise<NativeExecResult> {
    const cmd0 = input.argv[0];
    if (!cmd0) throw new Error("NativeRunner.exec: argv[0] is required");

    const maxStdout = input.limits?.maxStdoutBytes ?? 1024 * 1024;
    const maxStderr = input.limits?.maxStderrBytes ?? 1024 * 1024;
    const timeoutMs = input.limits?.timeoutMs ?? 60_000;

    const profile = buildSandboxExecProfile({ shadowDirHostPath: this.shadowDir, network: this.network });
    const argv = buildSandboxExecNativeArgv({
      sandboxExecPath: this.sandboxExecPath,
      profile,
      commandArgv: input.argv,
    });

    const cwdRel = (input.cwd ?? "").replace(/^\/+/, "");
    const cwd = cwdRel === "" || cwdRel === "." ? this.shadowDir : join(this.shadowDir, cwdRel);

    const startedAt = Date.now();
    const stdoutChunks: Uint8Array[] = [];
    const stderrChunks: Uint8Array[] = [];
    let truncatedStdout = false;
    let truncatedStderr = false;
    let timedOut = false;
    let signal: string | null = null;

    const exitCode = await new Promise<number>((resolve, reject) => {
      const cp = spawn(argv.cmd, argv.args, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd,
        env: { ...process.env, ...(input.env ?? {}) },
      });

      const t = setTimeout(() => {
        timedOut = true;
        try {
          cp.kill("SIGKILL");
        } catch {
          // ignore
        }
      }, timeoutMs);

      cp.on("error", (e) => {
        clearTimeout(t);
        reject(e);
      });

      if (input.stdin && input.stdin.byteLength > 0) {
        cp.stdin.write(Buffer.from(input.stdin));
      }
      cp.stdin.end();

      cp.stdout.on("data", (buf: Buffer) => {
        if (truncatedStdout) return;
        const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        const cur = stdoutChunks.reduce((n, c) => n + c.byteLength, 0);
        const slice = bytes.subarray(0, Math.max(0, maxStdout - cur));
        stdoutChunks.push(slice);
        if (slice.byteLength < bytes.byteLength) truncatedStdout = true;
      });
      cp.stderr.on("data", (buf: Buffer) => {
        if (truncatedStderr) return;
        const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        const cur = stderrChunks.reduce((n, c) => n + c.byteLength, 0);
        const slice = bytes.subarray(0, Math.max(0, maxStderr - cur));
        stderrChunks.push(slice);
        if (slice.byteLength < bytes.byteLength) truncatedStderr = true;
      });

      cp.on("close", (code, sig) => {
        clearTimeout(t);
        signal = sig;
        resolve(code ?? (timedOut ? 124 : 1));
      });
    });

    const durationMs = Date.now() - startedAt;

    return {
      exitCode,
      stdout: concat(stdoutChunks),
      stderr: concat(stderrChunks),
      truncatedStdout,
      truncatedStderr,
      audits: [
        {
          kind: "native.exec",
          cmd: argv.cmd,
          argv: argv.args,
          cwd: input.cwd,
          durationMs,
          timedOut,
          signal,
          truncatedStdout,
          truncatedStderr,
        },
      ],
    };
  }
}


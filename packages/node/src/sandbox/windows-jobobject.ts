import type { NativeExecInput, NativeExecResult, NativeRunner } from "@openagentic/native-runner";
import { spawn } from "node:child_process";

export type WindowsJobObjectOptions = {
  /**
   * Upper bound timeout (ms) applied when `input.limits.timeoutMs` is missing or larger.
   */
  timeoutMs?: number;
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

async function taskkillTree(pid: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const cp = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    cp.on("close", () => resolve());
    cp.on("error", () => resolve());
  });
}

export class WindowsJobObjectNativeRunner implements NativeRunner {
  readonly timeoutMs: number;

  constructor(options: WindowsJobObjectOptions = {}) {
    if (process.platform !== "win32") throw new Error("WindowsJobObjectNativeRunner is only supported on win32");
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async exec(input: NativeExecInput): Promise<NativeExecResult> {
    const cmd0 = input.argv[0];
    if (!cmd0) throw new Error("NativeRunner.exec: argv[0] is required");

    const maxStdout = input.limits?.maxStdoutBytes ?? 1024 * 1024;
    const maxStderr = input.limits?.maxStderrBytes ?? 1024 * 1024;
    const effectiveTimeout = Math.min(input.limits?.timeoutMs ?? this.timeoutMs, this.timeoutMs);

    const startedAt = Date.now();
    const stdoutChunks: Uint8Array[] = [];
    const stderrChunks: Uint8Array[] = [];
    let truncatedStdout = false;
    let truncatedStderr = false;
    let timedOut = false;
    let signal: string | null = null;

    const exitCode = await new Promise<number>((resolve, reject) => {
      const cp = spawn(cmd0, input.argv.slice(1), {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: input.cwd,
        env: { ...process.env, ...(input.env ?? {}) },
        windowsHide: true,
      });

      const t = setTimeout(() => {
        timedOut = true;
        if (cp.pid) void taskkillTree(cp.pid);
      }, effectiveTimeout);

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
          cmd: cmd0,
          argv: input.argv,
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

export function createWindowsJobObjectNativeRunner(options: WindowsJobObjectOptions = {}): NativeRunner {
  return new WindowsJobObjectNativeRunner(options);
}


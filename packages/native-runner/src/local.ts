import { spawn } from "node:child_process";
import { resolve } from "node:path";

import type { NativeExecInput, NativeExecResult, NativeRunner } from "./types.js";

export type LocalNativeRunnerOptions = {
  shadowDir: string;
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

function resolveWorkspaceCwd(shadowDir: string, cwd?: string): string {
  const cwdRel = String(cwd ?? "").replace(/^\/+/, "");
  if (cwdRel === "" || cwdRel === ".") return shadowDir;
  if (cwdRel.includes("..")) throw new Error("LocalNativeRunner: cwd must be workspace-relative (no '..')");
  const full = resolve(shadowDir, cwdRel);
  const root = resolve(shadowDir);
  if (full !== root && !full.startsWith(`${root}/`)) throw new Error("LocalNativeRunner: cwd escapes shadowDir");
  return full;
}

export class LocalNativeRunner implements NativeRunner {
  readonly shadowDir: string;

  constructor(options: LocalNativeRunnerOptions) {
    this.shadowDir = options.shadowDir;
  }

  async exec(input: NativeExecInput): Promise<NativeExecResult> {
    const cmd0 = input.argv[0];
    if (!cmd0) throw new Error("NativeRunner.exec: argv[0] is required");

    const maxStdout = input.limits?.maxStdoutBytes ?? 1024 * 1024;
    const maxStderr = input.limits?.maxStderrBytes ?? 1024 * 1024;
    const timeoutMs = input.limits?.timeoutMs ?? 60_000;

    const startedAt = Date.now();
    const stdoutChunks: Uint8Array[] = [];
    const stderrChunks: Uint8Array[] = [];
    let truncatedStdout = false;
    let truncatedStderr = false;
    let timedOut = false;
    let signal: string | null = null;

    const cwd = resolveWorkspaceCwd(this.shadowDir, input.cwd);

    const exitCode = await new Promise<number>((resolveP, reject) => {
      const cp = spawn(input.argv[0]!, input.argv.slice(1), {
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

      if (input.stdin && input.stdin.byteLength > 0) cp.stdin.write(Buffer.from(input.stdin));
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
        resolveP(code ?? (timedOut ? 124 : 1));
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
          cmd: input.argv[0]!,
          argv: input.argv,
          cwd,
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


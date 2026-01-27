import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import type { WasiExecInput, WasiExecResult, WasiRunner } from "@openagentic/wasi-runner";

function findInPath(cmd: string): string | null {
  const sep = process.platform === "win32" ? ";" : ":";
  const parts = (process.env.PATH ?? "").split(sep).filter(Boolean);
  for (const p of parts) {
    const full = join(p, cmd);
    try {
      // eslint-disable-next-line no-sync
      require("node:fs").accessSync(full);
      return full;
    } catch {
      // continue
    }
  }
  return null;
}

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

export class WasmtimeWasiRunner implements WasiRunner {
  readonly wasmtimePath: string;

  constructor(wasmtimePath?: string) {
    this.wasmtimePath = wasmtimePath || process.env.WASMTIME || findInPath("wasmtime") || "wasmtime";
  }

  async execModule(input: WasiExecInput): Promise<WasiExecResult> {
    if (input.module.kind !== "bytes") throw new Error("WasmtimeWasiRunner currently supports module.kind=bytes only");

    const maxStdout = input.limits?.maxStdoutBytes ?? 1024 * 1024;
    const maxStderr = input.limits?.maxStderrBytes ?? 1024 * 1024;

    const dir = await mkdtemp(join(tmpdir(), "oas-wasi-"));
    const wasmPath = join(dir, "module.wasm");
    await writeFile(wasmPath, input.module.bytes);

    const argv = input.argv ?? [];
    const args = ["run", wasmPath, ...argv];

    const stdoutChunks: Uint8Array[] = [];
    const stderrChunks: Uint8Array[] = [];
    let truncatedStdout = false;
    let truncatedStderr = false;

    const exitCode = await new Promise<number>((resolve, reject) => {
      const cp = spawn(this.wasmtimePath, args, { stdio: ["ignore", "pipe", "pipe"] });
      cp.on("error", reject);
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
      cp.on("close", (code) => resolve(code ?? 0));
    });

    await rm(dir, { recursive: true, force: true });

    return {
      exitCode,
      stdout: concat(stdoutChunks),
      stderr: concat(stderrChunks),
      truncatedStdout,
      truncatedStderr,
    };
  }
}


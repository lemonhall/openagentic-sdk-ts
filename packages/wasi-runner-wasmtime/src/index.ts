import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import type { WasiExecInput, WasiExecResult, WasiRunner } from "@openagentic/wasi-runner";

import { writeSnapshotToDir, readSnapshotFromDir } from "./snapshot-io.js";
import { buildWasmtimeCliArgs } from "./wasmtime-args.js";

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
    if (input.preopenDir && input.fs) throw new Error("WasmtimeWasiRunner: preopenDir and fs snapshot are mutually exclusive");

    const maxStdout = input.limits?.maxStdoutBytes ?? 1024 * 1024;
    const maxStderr = input.limits?.maxStderrBytes ?? 1024 * 1024;

    const dir = await mkdtemp(join(tmpdir(), "oas-wasi-"));
    let fsOut: WasiExecResult["fs"] | undefined;
    try {
      const wasmPath = join(dir, "module.wasm");
      await writeFile(wasmPath, input.module.bytes);

      let preopenDir: string | undefined;
      if (input.preopenDir) {
        preopenDir = input.preopenDir;
      } else if (input.fs) {
        preopenDir = join(dir, "fs");
        await mkdir(preopenDir, { recursive: true });
        await writeSnapshotToDir(preopenDir, input.fs);
      }

      const args = buildWasmtimeCliArgs({
        wasmPath,
        argv: input.argv ?? [],
        env: input.env,
        preopenDir,
      });

      const stdoutChunks: Uint8Array[] = [];
      const stderrChunks: Uint8Array[] = [];
      let truncatedStdout = false;
      let truncatedStderr = false;

      const exitCode = await new Promise<number>((resolve, reject) => {
        const cp = spawn(this.wasmtimePath, args, { stdio: ["pipe", "pipe", "pipe"] });
        cp.on("error", reject);
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
        cp.on("close", (code) => resolve(code ?? 0));
      });

      if (preopenDir && !input.preopenDir) {
        fsOut = await readSnapshotFromDir(preopenDir);
      }

      return {
        exitCode,
        stdout: concat(stdoutChunks),
        stderr: concat(stderrChunks),
        truncatedStdout,
        truncatedStderr,
        fs: fsOut,
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

export { createServerNetFetch } from "./netfetch.js";

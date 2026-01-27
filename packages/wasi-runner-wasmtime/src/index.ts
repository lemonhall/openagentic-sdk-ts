import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import type { SandboxAuditRecord, WasiExecInput, WasiExecResult, WasiRunner } from "@openagentic/wasi-runner";

import { writeSnapshotToDir, readSnapshotFromDir } from "./snapshot-io.js";
import { buildWasmtimeCliArgs } from "./wasmtime-args.js";
import type { ProcessSandbox } from "./process-sandbox.js";
import { applyProcessSandbox } from "./process-sandbox.js";

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

function toStringEnv(inputEnv: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(inputEnv)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export class WasmtimeWasiRunner implements WasiRunner {
  readonly wasmtimePath: string;
  readonly processSandbox?: ProcessSandbox;

  constructor(options?: string | { wasmtimePath?: string; processSandbox?: ProcessSandbox }) {
    const wasmtimePath =
      typeof options === "string"
        ? options
        : options?.wasmtimePath || process.env.WASMTIME || findInPath("wasmtime") || "wasmtime";
    this.wasmtimePath = wasmtimePath;
    this.processSandbox = typeof options === "string" ? undefined : options?.processSandbox;
  }

  async execModule(input: WasiExecInput): Promise<WasiExecResult> {
    if (input.module.kind !== "bytes") throw new Error("WasmtimeWasiRunner currently supports module.kind=bytes only");
    if (input.preopenDir && input.fs) throw new Error("WasmtimeWasiRunner: preopenDir and fs snapshot are mutually exclusive");

    const maxStdout = input.limits?.maxStdoutBytes ?? 1024 * 1024;
    const maxStderr = input.limits?.maxStderrBytes ?? 1024 * 1024;

    const dir = await mkdtemp(join(tmpdir(), "oas-wasi-"));
    let fsOut: WasiExecResult["fs"] | undefined;
    const sandboxAudits: SandboxAuditRecord[] = [];
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
        const sandboxed = applyProcessSandbox({
          sandbox: this.processSandbox,
          command: {
            cmd: this.wasmtimePath,
            args,
            env: toStringEnv(process.env),
            mounts: [
              { kind: "dir", label: "runner-tmp", hostPath: dir, guestPath: "/__runner__", mode: "rw" },
              ...(preopenDir
                ? [{ kind: "dir" as const, label: "shadow-workspace", hostPath: preopenDir, guestPath: "/workspace", mode: "rw" }]
                : []),
            ],
          },
          redactHostPaths: [dir, preopenDir].filter(Boolean) as string[],
        });
        if (sandboxed.audit) sandboxAudits.push(sandboxed.audit);

        const cp = spawn(sandboxed.spawn.cmd, sandboxed.spawn.args, {
          stdio: ["pipe", "pipe", "pipe"],
          env: sandboxed.spawn.env,
          cwd: sandboxed.spawn.cwd,
        });
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
        sandboxAudits: sandboxAudits.length ? sandboxAudits : undefined,
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

export { createServerNetFetch } from "./netfetch.js";

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { WasmtimeWasiRunner } from "../index.js";

async function compileWat(wat: string): Promise<Uint8Array> {
  const wabt = await (await import("wabt")).default();
  const mod = wabt.parseWat("mount-dir.test.wat", wat);
  const { buffer } = mod.toBinary({ log: false, write_debug_names: true });
  return new Uint8Array(buffer);
}

function hasWasmtime(): boolean {
  try {
    // eslint-disable-next-line no-sync
    require("node:child_process").execSync("command -v wasmtime", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("WasmtimeWasiRunner (preopenDir)", () => {
  it.skipIf(!hasWasmtime())("mounts a host directory without snapshot round-trips", async () => {
    const wasm = await compileWat(`
      (module
        (import "wasi_snapshot_preview1" "path_open"
          (func $path_open (param i32 i32 i32 i32 i32 i64 i64 i32 i32) (result i32)))
        (import "wasi_snapshot_preview1" "fd_write"
          (func $fd_write (param i32 i32 i32 i32) (result i32)))
        (import "wasi_snapshot_preview1" "fd_close" (func $fd_close (param i32) (result i32)))
        (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
        (memory 1)
        (export "memory" (memory 0))

        ;; iovec at 0: { ptr=64, len=3 }
        (data (i32.const 64) "ok\\n")
        (data (i32.const 80) "out.txt")

        (func (export "_start")
          ;; open "out.txt" under preopen fd=3
          (call $path_open
            (i32.const 3)      ;; dirfd
            (i32.const 0)      ;; dirflags
            (i32.const 80)     ;; path_ptr
            (i32.const 7)      ;; path_len
            (i32.const 9)      ;; oflags = CREAT(1) | TRUNC(8)
            (i64.const -1)     ;; rights_base (all)
            (i64.const -1)     ;; rights_inheriting (all)
            (i32.const 0)      ;; fdflags
            (i32.const 8)      ;; opened_fd_ptr
          )
          drop

          ;; write "ok\n" to opened fd at memory[8]
          (i32.store (i32.const 0) (i32.const 64))
          (i32.store (i32.const 4) (i32.const 3))
          (call $fd_write
            (i32.load (i32.const 8))
            (i32.const 0)
            (i32.const 1)
            (i32.const 20)
          )
          drop
          (call $fd_close (i32.load (i32.const 8)))
          drop
          (call $proc_exit (i32.const 0))
        )
      )
    `);

    const dir = await mkdtemp(join(tmpdir(), "oas-wasi-mount-"));
    try {
      const runner = new WasmtimeWasiRunner();
      const res = await runner.execModule({ module: { kind: "bytes", bytes: wasm }, preopenDir: dir });
      expect(res.exitCode).toBe(0);
      const out = await readFile(join(dir, "out.txt"), "utf8");
      expect(out).toBe("ok\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});


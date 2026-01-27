import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "../../../workspace/src/workspace/memory.js";

import { WorkspaceMountedWasiRunner } from "../worker/opfs-sync-fs.js";

async function compileWat(wat: string): Promise<Uint8Array> {
  const wabt = await (await import("wabt")).default();
  const mod = wabt.parseWat("opfs-sync-fs.test.wat", wat);
  const { buffer } = mod.toBinary({ log: false, write_debug_names: true });
  return new Uint8Array(buffer);
}

describe("WorkspaceMountedWasiRunner", () => {
  it("persists file writes back to the backing Workspace", async () => {
    const wasm = await compileWat(`
      (module
        (import "wasi_snapshot_preview1" "path_open" (func $path_open (param i32 i32 i32 i32 i32 i64 i64 i32 i32) (result i32)))
        (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
        (import "wasi_snapshot_preview1" "fd_close" (func $fd_close (param i32) (result i32)))
        (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
        (memory 1)
        (export "memory" (memory 0))
        (data (i32.const 300) "a.txt")
        (data (i32.const 320) "hello")
        (func (export "_start")
          (call $path_open
            (i32.const 3)        ;; dirfd
            (i32.const 0)        ;; dirflags
            (i32.const 300)      ;; path ptr
            (i32.const 5)        ;; path len
            (i32.const 9)        ;; oflags: CREAT|TRUNC
            (i64.const -1)       ;; rights base
            (i64.const -1)       ;; rights inheriting
            (i32.const 0)        ;; fdflags
            (i32.const 400)      ;; opened fd out
          )
          drop

          (i32.store (i32.const 8) (i32.const 320))
          (i32.store (i32.const 12) (i32.const 5))
          (call $fd_write (i32.load (i32.const 400)) (i32.const 8) (i32.const 1) (i32.const 120))
          drop
          (call $fd_close (i32.load (i32.const 400)))
          drop
          (call $proc_exit (i32.const 0))
        )
      )
    `);

    const ws = new MemoryWorkspace();
    const runner = new WorkspaceMountedWasiRunner({ workspace: ws });
    const res = await runner.execModule({ module: { kind: "bytes", bytes: wasm } });
    expect(res.exitCode).toBe(0);

    const data = await ws.readFile("a.txt");
    expect(new TextDecoder().decode(data)).toBe("hello");
  });
});

import { describe, expect, it } from "vitest";

import { InProcessWasiRunner } from "../in-process.js";

async function compileWat(wat: string): Promise<Uint8Array> {
  const wabt = await (await import("wabt")).default();
  const mod = wabt.parseWat("test.wat", wat);
  const { buffer } = mod.toBinary({ log: false, write_debug_names: true });
  return new Uint8Array(buffer);
}

describe("InProcessWasiRunner", () => {
  it("executes a tiny WASI module and captures stdout", async () => {
    const wasm = await compileWat(`
      (module
        (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
        (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
        (memory 1)
        (export "memory" (memory 0))
        (data (i32.const 8) "hi\\n")
        (func (export "_start")
          (i32.store (i32.const 0) (i32.const 8))
          (i32.store (i32.const 4) (i32.const 3))
          (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 20))
          drop
          (call $proc_exit (i32.const 0))
        )
      )
    `);

    const runner = new InProcessWasiRunner();
    const res = await runner.execModule({ module: { kind: "bytes", bytes: wasm } });
    expect(res.exitCode).toBe(0);
    expect(new TextDecoder().decode(res.stdout)).toBe("hi\n");
    expect(new TextDecoder().decode(res.stderr)).toBe("");
  });

  it("supports WASI argv via args_sizes_get/args_get", async () => {
    const wasm = await compileWat(`
      (module
        (import "wasi_snapshot_preview1" "args_sizes_get" (func $args_sizes_get (param i32 i32) (result i32)))
        (import "wasi_snapshot_preview1" "args_get" (func $args_get (param i32 i32) (result i32)))
        (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
        (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
        (memory 1)
        (export "memory" (memory 0))
        (data (i32.const 200) "\\n")
        (func $strlen (param $p i32) (result i32)
          (local $i i32)
          (local.set $i (i32.const 0))
          (block $break
            (loop $loop
              (br_if $break (i32.eqz (i32.load8_u (i32.add (local.get $p) (local.get $i)))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $loop)
            )
          )
          (local.get $i)
        )
        (func (export "_start") (local $p i32) (local $n i32)
          (call $args_sizes_get (i32.const 100) (i32.const 104))
          drop
          (call $args_get (i32.const 0) (i32.const 64))
          drop
          (local.set $p (i32.load (i32.const 0)))
          (local.set $n (call $strlen (local.get $p)))

          ;; iovecs at 8: [arg, "\\n"]
          (i32.store (i32.const 8) (local.get $p))
          (i32.store (i32.const 12) (local.get $n))
          (i32.store (i32.const 16) (i32.const 200))
          (i32.store (i32.const 20) (i32.const 1))

          (call $fd_write (i32.const 1) (i32.const 8) (i32.const 2) (i32.const 120))
          drop
          (call $proc_exit (i32.const 0))
        )
      )
    `);

    const runner = new InProcessWasiRunner();
    const res = await runner.execModule({ module: { kind: "bytes", bytes: wasm }, argv: ["echo"] });
    expect(res.exitCode).toBe(0);
    expect(new TextDecoder().decode(res.stdout)).toBe("echo\n");
  });

  it("supports a minimal FS snapshot via path_open + fd_write", async () => {
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
          ;; open "a.txt" in preopened root dir (fd=3)
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

          ;; iovec[0] = "hello"
          (i32.store (i32.const 8) (i32.const 320))
          (i32.store (i32.const 12) (i32.const 5))

          (call $fd_write
            (i32.load (i32.const 400))
            (i32.const 8)
            (i32.const 1)
            (i32.const 120)
          )
          drop

          (call $fd_close (i32.load (i32.const 400)))
          drop
          (call $proc_exit (i32.const 0))
        )
      )
    `);

    const runner = new InProcessWasiRunner();
    const res = await runner.execModule({
      module: { kind: "bytes", bytes: wasm },
      fs: { files: {} },
    });
    expect(res.exitCode).toBe(0);
    expect(res.fs?.files["a.txt"]).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(res.fs?.files["a.txt"] ?? new Uint8Array())).toBe("hello");
  });
});

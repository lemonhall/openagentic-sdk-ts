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
});


import { describe, expect, it } from "vitest";

import { WasmtimeWasiRunner, createBubblewrapProcessSandbox } from "../index.js";

async function compileWat(wat: string): Promise<Uint8Array> {
  const wabt = await (await import("wabt")).default();
  const mod = wabt.parseWat("test.wat", wat);
  const { buffer } = mod.toBinary({ log: false, write_debug_names: true });
  return new Uint8Array(buffer);
}

function hasCmd(cmd: string): boolean {
  try {
    // eslint-disable-next-line no-sync
    require("node:child_process").execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function tinyWasiModule(): Promise<Uint8Array> {
  return compileWat(`
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
}

describe("WasmtimeWasiRunner with Bubblewrap (integration)", () => {
  it.skipIf(process.platform !== "linux" || !hasCmd("wasmtime") || !hasCmd("bwrap"))(
    "executes a tiny WASI module under bwrap",
    async () => {
      const runner = new WasmtimeWasiRunner({
        processSandbox: createBubblewrapProcessSandbox({ bwrapPath: "bwrap", network: "deny" }),
      });
      const res = await runner.execModule({ module: { kind: "bytes", bytes: await tinyWasiModule() } });
      expect(res.exitCode).toBe(0);
      expect(new TextDecoder().decode(res.stdout)).toBe("hi\n");
      expect(res.sandboxAudits?.[0]?.wrapperName).toBe("bubblewrap");
    },
  );
});


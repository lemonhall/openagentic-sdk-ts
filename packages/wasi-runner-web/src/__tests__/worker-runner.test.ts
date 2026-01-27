import { describe, expect, it } from "vitest";

import { WorkerWasiRunner } from "../worker/runner.js";

async function compileWat(wat: string): Promise<Uint8Array> {
  const wabt = await (await import("wabt")).default();
  const mod = wabt.parseWat("worker-runner.test.wat", wat);
  const { buffer } = mod.toBinary({ log: false, write_debug_names: true });
  return new Uint8Array(buffer);
}

describe("WorkerWasiRunner", () => {
  it("executes a module through a worker-like transport", async () => {
    // Minimal in-memory "worker" that just invokes the same InProcessWasiRunner code path
    // by importing the worker entry and calling its onmessage handler.
    const workerScope: any = { postMessage: (_msg: any) => {} };
    const messages: any[] = [];
    workerScope.postMessage = (msg: any) => messages.push(msg);

    // Load the worker entry module, which assigns onmessage on globalThis.
    const origGlobal: any = globalThis as any;
    const prevOnMessage = origGlobal.onmessage;
    const prevPostMessage = origGlobal.postMessage;
    try {
      origGlobal.onmessage = null;
      origGlobal.postMessage = (m: any) => workerScope.postMessage(m);
      await import("../worker/worker.js");

      const fakeWorker: any = {
        onmessage: null,
        postMessage: async (msg: any) => {
          await origGlobal.onmessage({ data: msg } as any);
          // deliver responses back to main
          for (const m of messages.splice(0)) {
            fakeWorker.onmessage?.({ data: m } as any);
          }
        },
      };

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

      const runner = new WorkerWasiRunner(fakeWorker);
      const res = await runner.execModule({ module: { kind: "bytes", bytes: wasm } });
      expect(res.exitCode).toBe(0);
      expect(new TextDecoder().decode(res.stdout)).toBe("hi\n");
    } finally {
      origGlobal.onmessage = prevOnMessage;
      origGlobal.postMessage = prevPostMessage;
    }
  });
});


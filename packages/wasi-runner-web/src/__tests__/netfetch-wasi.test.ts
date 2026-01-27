import { describe, expect, it } from "vitest";

import { InProcessWasiRunner } from "../in-process.js";

async function compileWat(wat: string): Promise<Uint8Array> {
  const wabt = await (await import("wabt")).default();
  const mod = wabt.parseWat("netfetch-wasi.test.wat", wat);
  const { buffer } = mod.toBinary({ log: false, write_debug_names: true });
  return new Uint8Array(buffer);
}

describe("openagentic_netfetch (web WASI)", () => {
  it("fetch_get returns ENOTCAPABLE when netFetch is not provided", async () => {
    const wasm = await compileWat(`
      (module
        (import "openagentic_netfetch" "fetch_get" (func $fetch_get (param i32 i32 i32 i32 i32 i32 i32) (result i32)))
        (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
        (memory 1)
        (export "memory" (memory 0))
        (data (i32.const 100) "https://example.com/")
        (func (export "_start") (local $err i32)
          (local.set $err
            (call $fetch_get
              (i32.const 100) (i32.const 20)
              (i32.const 200) (i32.const 16)
              (i32.const 300) (i32.const 304) (i32.const 308)
            )
          )
          (if (i32.ne (local.get $err) (i32.const 0))
            (then (call $proc_exit (i32.const 2)))
          )
          (call $proc_exit (i32.const 0))
        )
      )
    `);

    const runner = new InProcessWasiRunner();
    const res = await runner.execModule({ module: { kind: "bytes", bytes: wasm } });
    expect(res.exitCode).toBe(2);
  });

  it("fetch_get writes response bytes and status", async () => {
    const prev = (globalThis as any).XMLHttpRequest;
    try {
      const enc = new TextEncoder();
      class FakeXHR {
        responseType = "";
        status = 200;
        response: ArrayBuffer = enc.encode("OK").buffer;
        open(_method: string, _url: string, _async: boolean) {}
        send() {}
      }
      (globalThis as any).XMLHttpRequest = FakeXHR;

      const wasm = await compileWat(`
        (module
          (import "openagentic_netfetch" "fetch_get" (func $fetch_get (param i32 i32 i32 i32 i32 i32 i32) (result i32)))
          (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
          (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
          (memory 1)
          (export "memory" (memory 0))
          (data (i32.const 100) "https://example.com/")
          (func (export "_start") (local $err i32)
            (local.set $err
              (call $fetch_get
                (i32.const 100) (i32.const 20)
                (i32.const 200) (i32.const 16)
                (i32.const 300) (i32.const 304) (i32.const 308)
              )
            )
            (if (i32.ne (local.get $err) (i32.const 0)) (then (call $proc_exit (i32.const 2))))

            ;; iovec[0] = out bytes
            (i32.store (i32.const 0) (i32.const 200))
            (i32.store (i32.const 4) (i32.load (i32.const 300)))
            (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 320))
            drop

            (call $proc_exit (i32.const 0))
          )
        )
      `);

      const runner = new InProcessWasiRunner();
      const res = await runner.execModule({
        module: { kind: "bytes", bytes: wasm },
        netFetch: { fetch: async () => ({ status: 200, headers: {}, body: new Uint8Array(), truncated: false }) } as any,
      });
      expect(res.exitCode).toBe(0);
      expect(new TextDecoder().decode(res.stdout)).toBe("OK");
      expect(res.netFetchAudits?.length).toBe(1);
      expect(res.netFetchAudits?.[0]?.url).toBe("https://example.com/");
      expect(res.netFetchAudits?.[0]?.status).toBe(200);
      expect(res.netFetchAudits?.[0]?.bytes).toBe(2);
    } finally {
      (globalThis as any).XMLHttpRequest = prev;
    }
  });
});

import { describe, expect, it } from "vitest";

import { WasmtimeWasiRunner } from "../index.js";

describe("WasmtimeWasiRunner netFetch", () => {
  it("fails fast when netFetch is provided", async () => {
    const r = new WasmtimeWasiRunner("wasmtime");
    await expect(
      r.execModule({
        module: { kind: "bytes", bytes: new Uint8Array() },
        argv: [],
        netFetch: { policy: {} } as any,
      } as any),
    ).rejects.toThrow(/netFetch.*not supported/i);
  });
});


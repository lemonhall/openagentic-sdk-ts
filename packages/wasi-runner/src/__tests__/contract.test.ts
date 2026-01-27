import { describe, expect, it } from "vitest";

import type { WasiRunner } from "../types.js";

// Contract tests are shared; concrete runners live in other packages.
describe("WasiRunner contract", () => {
  it("defines the expected exec result shape", () => {
    const _assert: WasiRunner = {
      async execModule() {
        return {
          exitCode: 0,
          stdout: new Uint8Array(),
          stderr: new Uint8Array(),
          truncatedStdout: false,
          truncatedStderr: false,
        };
      },
    };
    expect(typeof _assert.execModule).toBe("function");
  });
});


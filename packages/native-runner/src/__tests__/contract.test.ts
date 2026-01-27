import { describe, expect, it } from "vitest";

import type { NativeExecInput, NativeExecResult, NativeRunner } from "../types.js";

describe("NativeRunner contract", () => {
  it("is structurally usable by tools", () => {
    const runner: NativeRunner = {
      exec: async (_input: NativeExecInput): Promise<NativeExecResult> => ({
        exitCode: 0,
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
        truncatedStdout: false,
        truncatedStderr: false,
      }),
    };
    expect(typeof runner.exec).toBe("function");
  });
});


import { describe, expect, it } from "vitest";

import { createWindowsJobObjectNativeRunner } from "../sandbox/windows-jobobject.js";

describe("windows jobobject backend", () => {
  it("is unavailable on non-Windows platforms", () => {
    if (process.platform === "win32") return;
    expect(() => createWindowsJobObjectNativeRunner()).toThrow(/win32/);
  });
});


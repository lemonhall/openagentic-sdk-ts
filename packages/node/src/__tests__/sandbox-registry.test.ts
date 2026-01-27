import { describe, expect, it } from "vitest";

import { getSandboxBackend } from "../sandbox/registry.js";

describe("getSandboxBackend", () => {
  it("returns a backend implementation by name", () => {
    const b = getSandboxBackend("bwrap");
    expect(b.name).toBe("bwrap");
  });
});


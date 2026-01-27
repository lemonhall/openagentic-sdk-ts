import { describe, expect, it } from "vitest";

import { getSandboxBackend, parseSandboxConfig } from "../index.js";

describe("@openagentic/sdk-node exports", () => {
  it("re-exports sandbox helpers", () => {
    const cfg = parseSandboxConfig({ backend: "none" });
    expect(cfg.backend).toBe("none");
    expect(getSandboxBackend(cfg.backend).name).toBe("none");
  });
});


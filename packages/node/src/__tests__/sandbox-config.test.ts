import { describe, expect, it } from "vitest";

import { parseSandboxConfig } from "../sandbox/config.js";

describe("parseSandboxConfig", () => {
  it("parses a named backend with options", () => {
    const cfg = parseSandboxConfig({ backend: "bwrap", options: { network: "deny" } });
    expect(cfg.backend).toBe("bwrap");
    expect(cfg.options.network).toBe("deny");
  });
});


import { describe, expect, it } from "vitest";

import { parseSandboxConfig } from "../sandbox/config.js";
import { getSandboxBackend } from "../sandbox/registry.js";

describe("getSandboxBackend", () => {
  it("returns a backend implementation by name", () => {
    const b = getSandboxBackend("bwrap");
    expect(b.name).toBe("bwrap");
  });

  it("creates a native runner (bwrap) when options are omitted", () => {
    const cfg = parseSandboxConfig({ backend: "bwrap", options: { network: "deny" } });
    const b = getSandboxBackend("bwrap");
    const r = b.createNativeRunner({ config: cfg, shadowDir: "/tmp/shadow" });
    expect(r).toBeDefined();
    expect(typeof r!.exec).toBe("function");
  });

  it("wires the linux nsjail backend", () => {
    const cfg = parseSandboxConfig({ backend: "nsjail", options: { network: "deny" } });
    const b = getSandboxBackend("nsjail");
    expect(b.name).toBe("nsjail");
    const r = b.createNativeRunner({ config: cfg, shadowDir: "/tmp/shadow" });
    expect(r).toBeDefined();
    expect(typeof r!.exec).toBe("function");
  });

  it("wires the macos sandbox-exec backend", () => {
    const cfg = parseSandboxConfig({ backend: "sandbox-exec", options: { network: "deny" } });
    const b = getSandboxBackend("sandbox-exec");
    expect(b.name).toBe("sandbox-exec");
    const r = b.createNativeRunner({ config: cfg, shadowDir: "/tmp/shadow" });
    expect(r).toBeDefined();
    expect(typeof r!.exec).toBe("function");
  });

  it("wires the windows jobobject backend (platform-gated)", () => {
    const cfg = parseSandboxConfig({ backend: "jobobject", options: { timeoutMs: 123 } });
    const b = getSandboxBackend("jobobject");
    expect(b.name).toBe("jobobject");

    if (process.platform !== "win32") {
      expect(() => b.createNativeRunner({ config: cfg, shadowDir: "/tmp" })).toThrow(/win32/);
    }
  });
});

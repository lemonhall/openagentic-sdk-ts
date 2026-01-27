import { describe, expect, it } from "vitest";

import { parseSandboxConfig } from "../sandbox/config.js";
import { getSandboxBackend } from "../sandbox/registry.js";

describe("getSandboxBackend", () => {
  it("returns a backend implementation by name", () => {
    const b = getSandboxBackend("bwrap");
    expect(b.name).toBe("bwrap");
  });

  it("preserves backend defaults when options are omitted", () => {
    const cfg = parseSandboxConfig({ backend: "bwrap", options: { network: "deny" } });
    const b = getSandboxBackend("bwrap");
    const ps = b.createProcessSandbox({ config: cfg });
    expect(ps).toBeDefined();

    const wrapped = ps!.wrap({ cmd: "wasmtime", args: ["--help"], env: {}, mounts: [] });
    expect(wrapped.cmd).toBe("bwrap");
    expect(wrapped.args.join(" ")).toContain("--ro-bind /usr /usr");
  });
});

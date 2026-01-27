import { describe, expect, it } from "vitest";

import { buildSandboxExecProfile } from "../sandbox/macos-sandbox-exec.js";

describe("macos sandbox-exec profile", () => {
  it("allows read/write under the shadow dir and denies network when configured", () => {
    const profile = buildSandboxExecProfile({ shadowDirHostPath: "/tmp/oas-shadow", network: "deny" });
    expect(profile).toContain('"/tmp/oas-shadow"');
    expect(profile).toContain("file-write");
    expect(profile).toContain("deny network");
  });
});


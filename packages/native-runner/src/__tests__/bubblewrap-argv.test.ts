import { describe, expect, it } from "vitest";

import { buildBubblewrapArgv } from "../bubblewrap.js";

describe("buildBubblewrapArgv", () => {
  it("mounts shadow workspace at /workspace and chdirs there", () => {
    const out = buildBubblewrapArgv({
      bwrapPath: "bwrap",
      shadowDir: "/host/shadow",
      commandArgv: ["bash", "-lc", "pwd"],
      network: "deny",
      roBinds: ["/usr", "/lib"],
    });
    expect(out.cmd).toBe("bwrap");
    expect(out.args).toContain("--bind");
    expect(out.args).toContain("/host/shadow");
    expect(out.args).toContain("/workspace");
    expect(out.args).toContain("--chdir");
    expect(out.args).toContain("/workspace");
    expect(out.args).toContain("--unshare-net");
  });
});


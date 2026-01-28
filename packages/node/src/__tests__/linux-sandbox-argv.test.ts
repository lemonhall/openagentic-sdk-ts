import { describe, expect, it } from "vitest";

import { buildNsjailNativeArgv } from "../sandbox/linux-nsjail.js";

describe("linux nsjail argv", () => {
  it("generates deterministic argv for native runner exec", () => {
    const argv = buildNsjailNativeArgv({
      nsjailPath: "nsjail",
      shadowDir: "/host/tmp/shadow",
      commandArgv: ["bash", "-lc", "echo hi"],
      cwd: "src",
      network: "deny",
      roBinds: ["/usr", "/bin"],
    });
    expect(argv.cmd).toBe("nsjail");
    expect(argv.args).toEqual([
      "--mode",
      "o",
      "--quiet",
      "--bindmount_ro",
      "/bin:/bin",
      "--bindmount_ro",
      "/usr:/usr",
      "--bindmount",
      "/host/tmp/shadow:/workspace",
      "--cwd",
      "/workspace/src",
      "--",
      "bash",
      "-lc",
      "echo hi",
    ]);
  });
});

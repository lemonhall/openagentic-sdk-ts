import { describe, expect, it } from "vitest";

import { buildNsjailNativeArgv, createNsjailProcessSandbox } from "../sandbox/linux-nsjail.js";

describe("linux nsjail argv", () => {
  it("generates deterministic argv with mounts + cwd + network deny", () => {
    const nsjail = createNsjailProcessSandbox({
      nsjailPath: "nsjail",
      network: "deny",
      roBinds: ["/usr", "/bin"],
    });

    const wrapped = nsjail.wrap({
      cmd: "wasmtime",
      args: ["--help"],
      env: {},
      mounts: [
        { kind: "dir", label: "runner-tmp", hostPath: "/host/tmp/runner", guestPath: "/__runner__", mode: "rw" },
        { kind: "dir", label: "shadow-workspace", hostPath: "/host/tmp/shadow", guestPath: "/workspace", mode: "rw" },
      ],
    });

    expect(wrapped.cmd).toBe("nsjail");
    expect(wrapped.args).toEqual([
      "--mode",
      "o",
      "--quiet",
      "--bindmount_ro",
      "/bin:/bin",
      "--bindmount_ro",
      "/usr:/usr",
      "--bindmount",
      "/host/tmp/runner:/__runner__",
      "--bindmount",
      "/host/tmp/shadow:/workspace",
      "--cwd",
      "/workspace",
      "--",
      "wasmtime",
      "--help",
    ]);
  });

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

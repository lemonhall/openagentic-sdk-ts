import { describe, expect, it } from "vitest";

import { createBubblewrapProcessSandbox } from "../bubblewrap.js";

describe("createBubblewrapProcessSandbox", () => {
  it("wraps a command using bwrap and rewrites mounted paths", () => {
    const sandbox = createBubblewrapProcessSandbox({
      bwrapPath: "/usr/bin/bwrap",
      network: "allow",
      roBinds: ["/usr", "/lib"],
    });

    const wrapped = sandbox.wrap({
      cmd: "wasmtime",
      args: ["run", "--dir", "/host/shadow", "/tmp/runner/module.wasm", "--", "echo", "hi"],
      env: { PATH: "/usr/bin" },
      mounts: [
        { kind: "dir", label: "runner-tmp", hostPath: "/tmp/runner", guestPath: "/__runner__", mode: "rw" },
        { kind: "dir", label: "shadow-workspace", hostPath: "/host/shadow", guestPath: "/workspace", mode: "rw" },
      ],
    });

    expect(wrapped.cmd).toBe("/usr/bin/bwrap");
    expect(wrapped.args).toContain("wasmtime");
    expect(wrapped.args).toContain("--bind");
    expect(wrapped.args).toContain("/host/shadow");
    expect(wrapped.args).toContain("/workspace");

    // Inner wasmtime args should use guest paths, not host paths.
    expect(wrapped.args).toContain("/__runner__/module.wasm");
    const dirIndex = wrapped.args.indexOf("--dir");
    expect(dirIndex).toBeGreaterThan(-1);
    expect(wrapped.args[dirIndex + 1]).toBe("/workspace");
  });

  it("supports network deny mode", () => {
    const sandbox = createBubblewrapProcessSandbox({
      bwrapPath: "bwrap",
      network: "deny",
      roBinds: [],
    });
    const wrapped = sandbox.wrap({ cmd: "wasmtime", args: ["run"], env: {} });
    expect(wrapped.args).toContain("--unshare-net");
  });
});


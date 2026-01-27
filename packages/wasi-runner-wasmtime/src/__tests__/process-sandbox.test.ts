import { describe, expect, it } from "vitest";

import type { ProcessSandboxCommand } from "../process-sandbox.js";
import { applyProcessSandbox } from "../process-sandbox.js";

describe("applyProcessSandbox", () => {
  it("uses wrapper output and emits an audit record", () => {
    const command: ProcessSandboxCommand = {
      cmd: "wasmtime",
      args: ["run", "module.wasm", "--", "echo", "hi"],
      env: { PATH: "/bin" },
      mounts: [
        { kind: "dir", label: "shadow-workspace", hostPath: "/host/shadow", guestPath: "/workspace", mode: "rw" },
      ],
    };

    const out = applyProcessSandbox({
      sandbox: {
        name: "test-sandbox",
        wrap: (c) => ({ ...c, args: ["--break", ...c.args] }),
      },
      command,
      redactHostPaths: ["/host/shadow"],
    });

    expect(out.spawn.cmd).toBe("wasmtime");
    expect(out.spawn.args[0]).toBe("--break");
    expect(out.audit.kind).toBe("process-sandbox");
    expect(out.audit.wrapperName).toBe("test-sandbox");
    expect(out.audit.mounts?.[0]).toEqual({ label: "shadow-workspace", guestPath: "/workspace", mode: "rw" });
    expect(out.audit.wrappedArgs).not.toContain("/host/shadow");
  });

  it("does not emit an audit when no sandbox is installed", () => {
    const command: ProcessSandboxCommand = { cmd: "wasmtime", args: ["run"], env: {} };
    const out = applyProcessSandbox({ command });
    expect(out.spawn.cmd).toBe("wasmtime");
    expect(out.audit).toBeUndefined();
  });
});


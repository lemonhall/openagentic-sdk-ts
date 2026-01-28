import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "@openagentic/workspace";

import { BashTool } from "../bash/bash.js";

describe("rg command selection", () => {
  it("prefers WASI rg when available", async () => {
    const ws = new MemoryWorkspace();
    const fakeCommand = {
      hasCommand(name: string) {
        return name === "rg";
      },
      async run(input: any) {
        const argv = Array.isArray(input?.argv) ? input.argv : [];
        if (argv[0] !== "rg") throw new Error(`unexpected argv[0]: ${String(argv[0] ?? "")}`);
        return { exitCode: 0, stdout: "wasi-rg\n", stderr: "", truncatedStdout: false, truncatedStderr: false };
      },
    };

    const bash = new BashTool({ wasiCommand: fakeCommand as any });
    const out = (await bash.run({ command: "rg --version" }, { sessionId: "s", toolUseId: "t", workspace: ws } as any)) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("wasi-rg\n");
  });
});


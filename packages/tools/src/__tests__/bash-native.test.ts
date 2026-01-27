import { describe, expect, it } from "vitest";

import { NativeBashTool } from "../bash/bash-native.js";

describe("NativeBashTool", () => {
  it("executes bash -lc via NativeRunner", async () => {
    const calls: any[] = [];
    const tool = new NativeBashTool({
      runner: {
        exec: async (input) => {
          calls.push(input);
          return {
            exitCode: 0,
            stdout: new TextEncoder().encode("hi\n"),
            stderr: new Uint8Array(),
            truncatedStdout: false,
            truncatedStderr: false,
          };
        },
      } as any,
    });

    const out: any = await tool.run({ command: "echo hi" }, { sessionId: "s", toolUseId: "t" } as any);
    expect(calls[0].argv.slice(0, 2)).toEqual(["bash", "-lc"]);
    expect(out.exit_code).toBe(0);
    expect(out.stdout).toContain("hi");
  });
});


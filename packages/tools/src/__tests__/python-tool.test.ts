import { describe, expect, it } from "vitest";

import type { Tool, ToolContext } from "@openagentic/sdk-core";

import { PythonTool } from "../python/python.js";

describe("PythonTool", () => {
  it("invokes Command(argv) with python -c", async () => {
    const calls: any[] = [];
    const fakeCommand: Tool = {
      name: "Command",
      description: "fake",
      async run(input: Record<string, unknown>, _ctx: ToolContext): Promise<unknown> {
        calls.push(input);
        return { exitCode: 0, stdout: "ok", stderr: "", truncatedStdout: false, truncatedStderr: false };
      },
    };

    const py = new PythonTool({ command: fakeCommand });
    const out = (await py.run({ code: "print('x')", args: ["a", "b"] }, { toolUseId: "t1", sessionId: "s1" } as any)) as any;

    expect(out.exitCode).toBe(0);
    expect(out.stdout).toBe("ok");
    expect(calls).toHaveLength(1);
    expect(calls[0].argv).toEqual(["python", "-c", "print('x')", "a", "b"]);
  });
});


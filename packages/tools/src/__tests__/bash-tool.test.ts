import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "@openagentic/workspace";

import { BashTool } from "../bash/bash.js";

describe("BashTool (workspace-native)", () => {
  it("supports pipes + grep over workspace files", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("a.txt", new TextEncoder().encode("one\ntwo\nthree\n"));

    const bash = new BashTool();
    const out = (await bash.run(
      { command: "cat a.txt | grep tw" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("two\n");
    expect(out.stderr).toBe("");
  });

  it("supports redirects to files", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run(
      { command: "echo hi > out.txt" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("");
    expect(new TextDecoder().decode(await ws.readFile("out.txt"))).toBe("hi\n");
  });

  it("supports cd + ls with &&", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("src/a.txt", new TextEncoder().encode("x"));

    const bash = new BashTool();
    const out = (await bash.run(
      { command: "cd src && ls" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout.trim().split(/\\s+/).sort()).toEqual(["a.txt"]);
  });
});


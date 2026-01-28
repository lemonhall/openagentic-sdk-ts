import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "@openagentic/workspace";

import { BashTool } from "../bash/bash.js";

describe("rg builtin", () => {
  it("supports --help", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run({ command: "rg --help" }, { sessionId: "s", toolUseId: "t", workspace: ws } as any)) as any;
    expect(out.exit_code).toBe(0);
    expect(out.stdout).toContain("Usage:");
    expect(out.stdout).toContain("rg [OPTIONS] PATTERN [PATH ...]");
  });

  it("supports --version", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run({ command: "rg --version" }, { sessionId: "s", toolUseId: "t", workspace: ws } as any)) as any;
    expect(out.exit_code).toBe(0);
    expect(out.stdout).toContain("openagentic");
  });

  it("supports --files", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("a.txt", new TextEncoder().encode("a"));
    await ws.writeFile("b/c.txt", new TextEncoder().encode("c"));
    const bash = new BashTool();

    const out = (await bash.run({ command: "rg --files ." }, { sessionId: "s", toolUseId: "t", workspace: ws } as any)) as any;
    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("a.txt\nb/c.txt\n");
  });

  it("searches multiple paths", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("a.txt", new TextEncoder().encode("hello"));
    await ws.writeFile("b/c.txt", new TextEncoder().encode("hello"));
    const bash = new BashTool();

    const out = (await bash.run(
      { command: "rg hello a.txt b" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("a.txt:hello\nb/c.txt:hello\n");
  });
});


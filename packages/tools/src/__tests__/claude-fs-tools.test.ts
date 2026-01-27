import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "@openagentic/workspace";

import { EditTool } from "../claude/edit.js";
import { ReadTool } from "../claude/read.js";
import { WriteTool } from "../claude/write.js";

describe("Claude-style FS tools", () => {
  it("Write then Read returns content", async () => {
    const ws = new MemoryWorkspace();
    const write = new WriteTool();
    const read = new ReadTool();

    await write.run({ file_path: "a.txt", content: "hello", overwrite: true }, { sessionId: "s", toolUseId: "t", workspace: ws } as any);
    const out = (await read.run({ file_path: "a.txt" }, { sessionId: "s", toolUseId: "t", workspace: ws } as any)) as any;

    expect(out.file_path).toBe("a.txt");
    expect(out.content).toBe("hello");
  });

  it("Write without overwrite rejects existing file", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("a.txt", new TextEncoder().encode("x"));
    const write = new WriteTool();

    await expect(
      write.run({ file_path: "a.txt", content: "y" }, { sessionId: "s", toolUseId: "t", workspace: ws } as any),
    ).rejects.toThrow(/exists/i);
  });

  it("Read supports offset/limit line numbering (1-based)", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("a.txt", new TextEncoder().encode("L1\nL2\nL3\n"));
    const read = new ReadTool();

    const out = (await read.run(
      { file_path: "a.txt", offset: 2, limit: 2 },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.content).toBe("2: L2\n3: L3");
    expect(out.total_lines).toBe(3);
    expect(out.lines_returned).toBe(2);
  });

  it("Edit replaces a single occurrence by default", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("a.txt", new TextEncoder().encode("a b a"));
    const edit = new EditTool();

    const out = (await edit.run(
      { file_path: "a.txt", old: "a", new: "x" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.replacements).toBe(1);
    expect(new TextDecoder().decode(await ws.readFile("a.txt"))).toBe("x b a");
  });
});


import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "@openagentic/workspace";

import { ListDirTool, ReadFileTool, WriteFileTool } from "../index.js";

describe("workspace tools", () => {
  it("writes and reads files via the shadow workspace", async () => {
    const ws = new MemoryWorkspace();
    const ctx = { sessionId: "s".padStart(32, "0"), toolUseId: "t1", workspace: ws } as any;

    const write = new WriteFileTool();
    await write.run({ path: "a.txt", content: "hello" }, ctx);

    const read = new ReadFileTool();
    const out = await read.run({ path: "a.txt" }, ctx);
    expect(out).toEqual({ path: "a.txt", content: "hello", encoding: "utf8" });
  });

  it("lists directories deterministically", async () => {
    const ws = new MemoryWorkspace();
    const ctx = { sessionId: "s".padStart(32, "0"), toolUseId: "t1", workspace: ws } as any;

    const write = new WriteFileTool();
    await write.run({ path: "b.txt", content: "b" }, ctx);
    await write.run({ path: "a.txt", content: "a" }, ctx);

    const list = new ListDirTool();
    const out = await list.run({ path: "" }, ctx);
    expect(out).toEqual({ path: "", entries: [{ name: "a.txt", type: "file" }, { name: "b.txt", type: "file" }] });
  });
});


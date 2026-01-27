import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "@openagentic/workspace";

import { SkillTool } from "../claude/skill.js";
import { SlashCommandTool } from "../claude/slash-command.js";
import { TodoWriteTool } from "../claude/todo-write.js";

describe("Claude-style meta tools", () => {
  it("TodoWrite validates and returns stats", async () => {
    const tool = new TodoWriteTool();
    const out = (await tool.run(
      {
        todos: [
          { content: "a", status: "pending" },
          { content: "b", status: "in_progress", priority: "high" },
          { content: "c", status: "completed" },
        ],
      },
      { sessionId: "s", toolUseId: "t" } as any,
    )) as any;
    expect(out.stats.total).toBe(3);
    expect(out.stats.pending).toBe(1);
    expect(out.stats.in_progress).toBe(1);
    expect(out.stats.completed).toBe(1);
  });

  it("SlashCommand loads .claude/commands/<name>.md from workspace", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile(".claude/commands/hello.md", new TextEncoder().encode("# Hello\n"));
    const tool = new SlashCommandTool();
    const out = (await tool.run({ name: "hello" }, { sessionId: "s", toolUseId: "t", workspace: ws } as any)) as any;
    expect(out.name).toBe("hello");
    expect(out.path).toBe(".claude/commands/hello.md");
    expect(out.content).toBe("# Hello\n");
  });

  it("Skill loads a built-in skill by name", async () => {
    const tool = new SkillTool();
    const out = (await tool.run({ name: "tashan-development-loop" }, { sessionId: "s", toolUseId: "t" } as any)) as any;
    expect(out.name).toBe("tashan-development-loop");
    expect(out.output).toMatch(/塔山开发循环/i);
  });
});


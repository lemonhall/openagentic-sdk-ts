import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "@openagentic/workspace";

import { GlobTool } from "../claude/glob.js";
import { GrepTool } from "../claude/grep.js";

describe("Claude-style Glob/Grep tools", () => {
  it("Glob matches workspace file paths (subset)", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("src/a.ts", new TextEncoder().encode("export const a = 1;\n"));
    await ws.writeFile("src/b.txt", new TextEncoder().encode("hi\n"));
    await ws.writeFile("README.md", new TextEncoder().encode("# ok\n"));

    const glob = new GlobTool();
    const out = (await glob.run({ pattern: "**/*.ts" }, { sessionId: "s", toolUseId: "t", workspace: ws } as any)) as any;
    expect(out.matches).toEqual(["src/a.ts"]);
    expect(out.count).toBe(1);
  });

  it("Grep finds regex matches with context", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("a.txt", new TextEncoder().encode("one\ntwo\nthree\n"));

    const grep = new GrepTool({ maxMatches: 100 });
    const out = (await grep.run(
      { query: "tw", file_glob: "**/*.txt", before_context: 1, after_context: 1 },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.total_matches).toBe(1);
    expect(out.matches[0].file_path).toBe("a.txt");
    expect(out.matches[0].line).toBe(2);
    expect(out.matches[0].before_context).toEqual(["one"]);
    expect(out.matches[0].after_context).toEqual(["three"]);
  });
});


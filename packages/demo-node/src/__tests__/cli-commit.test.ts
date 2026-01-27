import { describe, expect, it } from "vitest";

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "../index.js";

class ToolCallingProvider {
  calls = 0;
  async complete(): Promise<{
    assistantText: string | null;
    toolCalls: Array<{ toolUseId: string; name: string; input: Record<string, unknown> }>;
  }> {
    this.calls += 1;
    if (this.calls === 1) {
      return {
        assistantText: null,
        toolCalls: [{ toolUseId: "c1", name: "WriteFile", input: { path: "a.txt", content: "two\n" } }],
      };
    }
    return { assistantText: "done", toolCalls: [] };
  }
}

describe("demo-node CLI (commit)", () => {
  it("/commit writes shadow changes back to the real directory", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "openagentic-demo-node-proj-"));
    const realPath = join(projectDir, "a.txt");
    await writeFile(realPath, "one\n");

    const provider = new ToolCallingProvider() as any;
    const res = await runCli(["--project", projectDir], {
      provider,
      model: "fake-model",
      lines: ["please edit", "/commit", "/exit"],
    } as any);

    expect(res.exitCode).toBe(0);
    expect((await readFile(realPath, "utf8")).toString()).toBe("two\n");
  });
});

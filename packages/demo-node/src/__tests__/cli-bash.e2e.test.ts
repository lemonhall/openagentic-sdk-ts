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
        toolCalls: [{ toolUseId: "b1", name: "Bash", input: { command: "echo hi > hi.txt" } }],
      };
    }
    return { assistantText: "done", toolCalls: [] };
  }
}

describe("demo-node CLI (bash e2e)", () => {
  it("runs a bash command and commits the result", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "oas-node-e2e-"));
    await writeFile(join(projectDir, "seed.txt"), "seed\n");

    const provider = new ToolCallingProvider() as any;
    const res = await runCli(["--project", projectDir], {
      provider,
      model: "fake-model",
      lines: ["do it", "/commit", "/exit"],
    } as any);

    expect(res.exitCode).toBe(0);
    expect(await readFile(join(projectDir, "hi.txt"), "utf8")).toBe("hi\n");
  });
});


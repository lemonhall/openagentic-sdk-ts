import { describe, expect, it } from "vitest";

import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "../index.js";

class FakeProvider {
  async complete(): Promise<{
    assistantText: string | null;
    toolCalls: Array<{ toolUseId: string; name: string; input: Record<string, unknown> }>;
  }> {
    return { assistantText: "ok", toolCalls: [] };
  }
}

describe("demo-node CLI (project mode)", () => {
  it("creates session store under .openagentic/sessions and does not touch real files without commit", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "openagentic-demo-node-proj-"));
    const realPath = join(projectDir, "a.txt");
    await writeFile(realPath, "one\n");

    let out = "";
    const res = await runCli(["--project", projectDir, "--once", "hi"], {
      provider: new FakeProvider() as any,
      model: "fake-model",
      stdout: { write: (s: string) => (out += s) },
    } as any);

    expect(res.exitCode).toBe(0);
    expect(out).toContain("ok");

    // Real file unchanged.
    expect((await readFile(realPath, "utf8")).toString()).toBe("one\n");

    const sessionsRoot = join(projectDir, ".openagentic", "sessions");
    const sessionDirs = (await readdir(sessionsRoot)).filter((n) => !n.startsWith("."));
    expect(sessionDirs.length).toBeGreaterThan(0);
  });
});


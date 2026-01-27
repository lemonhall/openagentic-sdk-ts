import { describe, expect, it } from "vitest";

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "../index.js";

describe("demo-node CLI (errors)", () => {
  it("explains how to provide an API key when no provider is injected", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "openagentic-demo-node-proj-"));
    await writeFile(join(projectDir, "a.txt"), "one\n");

    const old = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await expect(runCli(["--project", projectDir, "--once", "hi"])).rejects.toThrow(/OPENAI_API_KEY/i);
    } finally {
      if (old != null) process.env.OPENAI_API_KEY = old;
    }
  });
});


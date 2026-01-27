import { describe, expect, it } from "vitest";

import { JsonlSessionStore } from "@openagentic/sdk-core";
import { MemoryWorkspace } from "@openagentic/workspace";

import { runCli } from "../index.js";

class MemoryJsonlBackend {
  #files = new Map<string, string>();

  async mkdirp(_dir: string): Promise<void> {}
  async readText(path: string): Promise<string> {
    const v = this.#files.get(path);
    if (v == null) throw new Error("ENOENT");
    return v;
  }
  async writeText(path: string, text: string): Promise<void> {
    this.#files.set(path, text);
  }
  async appendText(path: string, text: string): Promise<void> {
    this.#files.set(path, (this.#files.get(path) ?? "") + text);
  }
}

class FakeProvider {
  async complete(): Promise<{
    assistantText: string | null;
    toolCalls: Array<{ toolUseId: string; name: string; input: Record<string, unknown> }>;
  }> {
    return { assistantText: "hello from fake", toolCalls: [] };
  }
}

describe("demo-node CLI", () => {
  it("--once runs a single turn and prints the final message", async () => {
    const sessionStore = new JsonlSessionStore(new MemoryJsonlBackend() as any);
    const workspace = new MemoryWorkspace();
    const provider = new FakeProvider() as any;

    let out = "";
    const res = await runCli(["--once", "hi"], {
      provider,
      model: "fake-model",
      sessionStore,
      workspace,
      stdout: { write: (s: string) => (out += s) },
    } as any);

    expect(res.exitCode).toBe(0);
    expect(out).toContain("hello from fake");
  });
});


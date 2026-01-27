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
  calls = 0;
  async complete(): Promise<{
    assistantText: string | null;
    toolCalls: Array<{ toolUseId: string; name: string; input: Record<string, unknown> }>;
  }> {
    this.calls += 1;
    return { assistantText: `ok${this.calls}`, toolCalls: [] };
  }
}

describe("demo-node CLI (repl mode)", () => {
  it("runs multiple turns in the same session", async () => {
    const sessionStore = new JsonlSessionStore(new MemoryJsonlBackend() as any);
    const workspace = new MemoryWorkspace();
    const provider = new FakeProvider() as any;

    let out = "";
    const res = await runCli([], {
      provider,
      model: "fake-model",
      sessionStore,
      workspace,
      stdout: { write: (s: string) => (out += s) },
      // Test-only: drive the REPL with known lines.
      lines: ["hi", "again"],
    } as any);

    expect(res.exitCode).toBe(0);
    expect(typeof (res as any).sessionId).toBe("string");

    const sessionId = (res as any).sessionId as string;
    const events = await sessionStore.readEvents(sessionId);
    expect(events.filter((e) => e.type === "system.init").length).toBe(1);
    expect(events.filter((e) => e.type === "user.message").length).toBe(2);
    expect(out).toContain("ok1");
    expect(out).toContain("ok2");
  });
});


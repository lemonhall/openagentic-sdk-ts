import { describe, expect, it } from "vitest";

import { JsonlSessionStore } from "@openagentic/sdk-core";
import { MemoryWorkspace } from "@openagentic/workspace";

import * as agentMod from "../agent.js";

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
    if (this.calls === 1) {
      return { assistantText: null, toolCalls: [{ toolUseId: "c1", name: "WriteFile", input: { path: "x.txt", content: "y" } }] };
    }
    return { assistantText: "done", toolCalls: [] };
  }
}

describe("demo-web agent wiring", () => {
  it("executes tool calls against the provided workspace", async () => {
    const createBrowserAgent = (agentMod as any).createBrowserAgent as ((opts: any) => any) | undefined;
    expect(typeof createBrowserAgent).toBe("function");
    if (typeof createBrowserAgent !== "function") return;

    const sessionStore = new JsonlSessionStore(new MemoryJsonlBackend() as any);
    const workspace = new MemoryWorkspace();
    const provider = new FakeProvider() as any;

    const { runtime } = await createBrowserAgent({ sessionStore, workspace, provider, model: "fake" });
    const events: any[] = [];
    for await (const e of runtime.runTurn({ userText: "go" })) events.push(e);

    expect(events.some((e) => e.type === "tool.result" && e.isError === false)).toBe(true);
    expect(new TextDecoder().decode(await workspace.readFile("x.txt"))).toBe("y");
  });
});

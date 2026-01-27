import { describe, expect, it } from "vitest";

import { JsonlSessionStore } from "@openagentic/sdk-core";
import { MemoryWorkspace } from "@openagentic/workspace";

import * as runtimeMod from "../runtime.js";

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
    usage?: Record<string, unknown>;
    raw?: unknown;
    responseId?: string | null;
    providerMetadata?: unknown;
  }> {
    this.calls += 1;
    if (this.calls === 1) {
      return {
        assistantText: null,
        toolCalls: [{ toolUseId: "call-1", name: "WriteFile", input: { path: "hello.txt", content: "hi\n" } }],
      };
    }
    return { assistantText: "done", toolCalls: [] };
  }
}

describe("demo-node runtime wiring", () => {
  it("runs AgentRuntime and executes tool calls", async () => {
    const createDemoRuntime = (runtimeMod as any).createDemoRuntime as
      | ((opts: any) => { runtime: any })
      | undefined;
    expect(typeof createDemoRuntime).toBe("function");
    if (typeof createDemoRuntime !== "function") return;

    const sessionStore = new JsonlSessionStore(new MemoryJsonlBackend() as any);
    const workspace = new MemoryWorkspace();
    const provider = new FakeProvider() as any;

    const { runtime } = await createDemoRuntime({ sessionStore, workspace, provider, model: "fake-model" });

    const events: any[] = [];
    for await (const e of runtime.runTurn({ userText: "please write a file" })) events.push(e);

    const bytes = await workspace.readFile("hello.txt");
    expect(new TextDecoder().decode(bytes)).toBe("hi\n");

    expect(events.some((e) => e.type === "tool.use" && e.name === "WriteFile")).toBe(true);
    expect(events.some((e) => e.type === "tool.result" && e.toolUseId === "call-1" && e.isError === false)).toBe(true);
    expect(events.some((e) => e.type === "assistant.message" && e.text === "done")).toBe(true);
    expect(events.some((e) => e.type === "result" && e.finalText === "done")).toBe(true);
  });

  it("can enable WASI-backed Bash", async () => {
    const createDemoRuntime = (runtimeMod as any).createDemoRuntime as
      | ((opts: any) => { runtime: any; tools: any })
      | undefined;
    expect(typeof createDemoRuntime).toBe("function");
    if (typeof createDemoRuntime !== "function") return;

    const sessionStore = new JsonlSessionStore(new MemoryJsonlBackend() as any);
    const workspace = new MemoryWorkspace();
    const provider = new FakeProvider() as any;

    const { tools } = await createDemoRuntime({ sessionStore, workspace, provider, model: "fake-model", enableWasiBash: true });

    const bash = tools.get("Bash");
    const out = (await bash.run(
      { command: "echo" },
      { sessionId: "s", toolUseId: "t", workspace } as any,
    )) as any;

    expect(out.stdout).toBe("hi\n");
  });

  it("defaults to WASI-backed Bash", async () => {
    const createDemoRuntime = (runtimeMod as any).createDemoRuntime as
      | ((opts: any) => Promise<{ tools: any }>)
      | undefined;
    expect(typeof createDemoRuntime).toBe("function");
    if (typeof createDemoRuntime !== "function") return;

    const sessionStore = new JsonlSessionStore(new MemoryJsonlBackend() as any);
    const workspace = new MemoryWorkspace();
    const provider = new FakeProvider() as any;

    const { tools } = await createDemoRuntime({ sessionStore, workspace, provider, model: "fake-model" });
    const bash = tools.get("Bash");
    const out = (await bash.run(
      { command: "echo" },
      { sessionId: "s", toolUseId: "t", workspace } as any,
    )) as any;

    expect(out.stdout).toBe("hi\n");
  });

  it("can enable native engine Bash (no bundles)", async () => {
    const createDemoRuntime = (runtimeMod as any).createDemoRuntime as
      | ((opts: any) => Promise<{ tools: any }>)
      | undefined;
    expect(typeof createDemoRuntime).toBe("function");
    if (typeof createDemoRuntime !== "function") return;

    const sessionStore = new JsonlSessionStore(new MemoryJsonlBackend() as any);
    const workspace = new MemoryWorkspace();
    const provider = new FakeProvider() as any;

    const { tools } = await createDemoRuntime({
      sessionStore,
      workspace,
      provider,
      model: "fake-model",
      toolEngine: "native",
      wasiPreopenDir: "/tmp/shadow",
      nativeRunner: {
        exec: async () => ({
          exitCode: 0,
          stdout: new TextEncoder().encode("ok\n"),
          stderr: new Uint8Array(),
          truncatedStdout: false,
          truncatedStderr: false,
        }),
      } as any,
    });
    const bash = tools.get("Bash");
    expect(bash).toBeTruthy();
    expect(String(bash.description)).toContain("host-native");
  });
});

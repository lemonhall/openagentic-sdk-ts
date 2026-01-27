import { describe, expect, it } from "vitest";

import type { Event } from "../events.js";
import { AskOncePermissionGate } from "../permissions/gate.js";
import { ToolRunner } from "../runtime/tool-runner.js";
import type { SessionStore } from "../session/store.js";
import { ToolRegistry } from "../tools/registry.js";
import type { Tool } from "../tools/types.js";

class InMemorySessionStore implements SessionStore {
  #events = new Map<string, Event[]>();

  async createSession(): Promise<string> {
    const id = globalThis.crypto.randomUUID().replaceAll("-", "");
    this.#events.set(id, []);
    return id;
  }

  async readMeta(): Promise<any> {
    return null;
  }

  async appendEvent(sessionId: string, event: Event): Promise<void> {
    const arr = this.#events.get(sessionId) ?? [];
    arr.push(event);
    this.#events.set(sessionId, arr);
  }

  async readEvents(sessionId: string): Promise<Event[]> {
    return this.#events.get(sessionId) ?? [];
  }
}

describe("ToolRunner", () => {
  it("emits tool.use -> permission -> tool.result", async () => {
    const store = new InMemorySessionStore();
    const sessionId = await store.createSession();

    const tools = new ToolRegistry();
    const tool: Tool = {
      name: "Echo",
      description: "echo",
      async run(input) {
        return { ok: true, input };
      },
    };
    tools.register(tool);

    const gate = new AskOncePermissionGate({ approver: async () => true });
    const runner = new ToolRunner({ tools, permissionGate: gate, sessionStore: store });

    const events: Event[] = [];
    for await (const e of runner.run(sessionId, { toolUseId: "call_1", name: "Echo", input: { x: 1 } })) events.push(e);

    expect(events.map((e) => e.type)).toEqual(["tool.use", "permission.question", "permission.decision", "tool.result"]);
    const result = events.at(-1) as any;
    expect(result.isError).toBe(false);
    expect(result.output.ok).toBe(true);
  });

  it("passes host-injected context to tools", async () => {
    const store = new InMemorySessionStore();
    const sessionId = await store.createSession();

    const tools = new ToolRegistry();
    const tool: Tool = {
      name: "Ctx",
      description: "ctx",
      async run(_input, ctx) {
        return { workspaceTag: (ctx as any).workspace?.tag ?? null };
      },
    };
    tools.register(tool);

    const gate = new AskOncePermissionGate({ approver: async () => true });
    const runner = new ToolRunner({
      tools,
      permissionGate: gate,
      sessionStore: store,
      contextFactory: async () => ({ workspace: { tag: "w" } }),
    });

    const events: Event[] = [];
    for await (const e of runner.run(sessionId, { toolUseId: "call_1", name: "Ctx", input: {} })) events.push(e);

    const result = events.at(-1) as any;
    expect(result.isError).toBe(false);
    expect(result.output.workspaceTag).toBe("w");
  });
});

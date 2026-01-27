import { describe, expect, it } from "vitest";

import { AgentRuntime, AskOncePermissionGate, ToolRegistry, ToolRunner } from "../index.js";
import type { Event, ModelProvider, SessionStore, Tool, ToolContext } from "../index.js";

class MemorySessionStore implements SessionStore {
  #sessions = new Map<string, { meta: any; events: Event[] }>();
  #seq = 0;

  async createSession(options?: { metadata?: Record<string, unknown> }): Promise<string> {
    this.#seq += 1;
    const sessionId = String(this.#seq).padStart(32, "0");
    this.#sessions.set(sessionId, {
      meta: { sessionId, createdAt: Date.now(), metadata: options?.metadata ?? {} },
      events: [],
    });
    return sessionId;
  }

  async readMeta(sessionId: string): Promise<any> {
    return this.#sessions.get(sessionId)?.meta ?? null;
  }

  async appendEvent(sessionId: string, event: Event): Promise<void> {
    const s = this.#sessions.get(sessionId);
    if (!s) throw new Error("unknown session");
    s.events.push(event);
  }

  async readEvents(sessionId: string): Promise<Event[]> {
    return this.#sessions.get(sessionId)?.events ?? [];
  }
}

describe("AgentRuntime tool loop", () => {
  it("runs tool calls and continues until the model stops calling tools", async () => {
    const store = new MemorySessionStore();
    const tools = new ToolRegistry();

    const echo: Tool = {
      name: "Echo",
      description: "Echo text",
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      async run(input: Record<string, unknown>, _ctx: ToolContext) {
        return { echoed: input.text };
      },
    };
    tools.register(echo);

    const gate = new AskOncePermissionGate({ approver: async () => true });
    const runner = new ToolRunner({ tools, permissionGate: gate, sessionStore: store });

    let calls = 0;
    const provider: ModelProvider = {
      name: "fake",
      async complete() {
        calls += 1;
        if (calls === 1) return { assistantText: null, toolCalls: [{ toolUseId: "t1", name: "Echo", input: { text: "hi" } }] };
        return { assistantText: "done", toolCalls: [] };
      },
    };

    const rt = new AgentRuntime({ sessionStore: store, toolRunner: runner, tools, provider, model: "gpt-test", apiKey: "sk-test" });

    const events: Event[] = [];
    for await (const e of rt.runTurn({ userText: "hi" })) events.push(e);

    // The important invariant: tool.use/result happen, then the assistant final message.
    expect(events.map((e) => e.type)).toEqual([
      "system.init",
      "user.message",
      "tool.use",
      "permission.question",
      "permission.decision",
      "tool.result",
      "assistant.message",
      "result",
    ]);
  });
});


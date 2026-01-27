import { describe, expect, it } from "vitest";

import { AgentRuntime, AskOncePermissionGate, ToolRegistry, ToolRunner } from "../index.js";
import type { Event, ModelProvider, SessionStore } from "../index.js";

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

describe("AgentRuntime streaming", () => {
  it("emits assistant.delta during provider.stream and persists final assistant.message", async () => {
    const store = new MemorySessionStore();
    const tools = new ToolRegistry();
    const gate = new AskOncePermissionGate({ approver: async () => true });
    const runner = new ToolRunner({ tools, permissionGate: gate, sessionStore: store });

    const provider: ModelProvider = {
      name: "fake",
      async complete() {
        return { assistantText: "(complete)", toolCalls: [] };
      },
      async *stream() {
        yield { type: "text_delta", delta: "hel" };
        yield { type: "text_delta", delta: "lo" };
        yield { type: "done", responseId: "resp_1", usage: { total_tokens: 1 } };
      },
    };

    const rt = new AgentRuntime({ sessionStore: store, toolRunner: runner, tools, provider, model: "gpt-test", apiKey: "sk-test" });

    const events: Event[] = [];
    for await (const e of rt.runTurn({ userText: "hi" })) events.push(e);

    expect(events.map((e) => e.type)).toEqual([
      "system.init",
      "user.message",
      "assistant.delta",
      "assistant.delta",
      "assistant.message",
      "result",
    ]);
    expect((events.find((e) => e.type === "assistant.message") as any)?.text).toBe("hello");
    expect((events.find((e) => e.type === "result") as any)?.usage).toEqual({ total_tokens: 1 });
  });
});


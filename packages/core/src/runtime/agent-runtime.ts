import type { Event } from "../events.js";
import { rebuildResponsesInput } from "../replay/rebuild.js";
import type { SessionStore } from "../session/store.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { ModelProvider, ModelStreamEvent } from "../llm/types.js";
import { toolSchemasForOpenAIResponses } from "../llm/tool-schemas.js";

import type { ToolRunner } from "./tool-runner.js";

function now(): number {
  return Date.now();
}

export type AgentRuntimeOptions = {
  sessionStore: SessionStore;
  toolRunner: ToolRunner;
  tools: ToolRegistry;
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  systemPrompt?: string;
  maxSteps?: number;
};

export class AgentRuntime {
  readonly #store: SessionStore;
  readonly #toolRunner: ToolRunner;
  readonly #tools: ToolRegistry;
  readonly #provider: ModelProvider;
  readonly #model: string;
  readonly #apiKey?: string;
  readonly #systemPrompt?: string;
  readonly #maxSteps: number;

  constructor(options: AgentRuntimeOptions) {
    this.#store = options.sessionStore;
    this.#toolRunner = options.toolRunner;
    this.#tools = options.tools;
    this.#provider = options.provider;
    this.#model = options.model;
    this.#apiKey = options.apiKey;
    this.#systemPrompt = options.systemPrompt;
    this.#maxSteps = typeof options.maxSteps === "number" && options.maxSteps > 0 ? options.maxSteps : 50;
  }

  async *runTurn(input: { sessionId?: string; userText: string }): AsyncGenerator<Event> {
    const text = input.userText;
    if (typeof text !== "string") throw new Error("AgentRuntime.runTurn: userText must be a string");

    const sessionId = input.sessionId ?? (await this.#store.createSession());

    const existing = await this.#store.readEvents(sessionId);
    if (!existing.some((e) => e.type === "system.init")) {
      const init: Event = { type: "system.init", sessionId, ts: now() };
      await this.#store.appendEvent(sessionId, init);
      yield init;
    }

    const user: Event = { type: "user.message", text, ts: now() };
    await this.#store.appendEvent(sessionId, user);
    yield user;

    let steps = 0;
    while (steps < this.#maxSteps) {
      steps += 1;

      const events = await this.#store.readEvents(sessionId);
      const providerInput = rebuildResponsesInput(events);

      const prompt = typeof this.#systemPrompt === "string" && this.#systemPrompt.trim() ? this.#systemPrompt : null;
      const providerInput2 = prompt ? ([{ role: "system", content: prompt }, ...providerInput] as any) : providerInput;

      const toolSchemas = toolSchemasForOpenAIResponses(this.#tools);
      const streamed =
        typeof this.#provider.stream === "function"
          ? await this.#callStreamed(sessionId, { model: this.#model, input: providerInput2, tools: toolSchemas, apiKey: this.#apiKey })
          : null;

      const out = streamed?.out ?? (await this.#provider.complete({ model: this.#model, input: providerInput2, tools: toolSchemas, apiKey: this.#apiKey }));
      if (streamed) {
        for (const de of streamed.deltaEvents) yield de;
      }

      if (out.toolCalls.length) {
        for (const tc of out.toolCalls) {
          yield* this.#toolRunner.run(sessionId, tc);
        }
        continue;
      }

      if (out.assistantText == null) break;

      const msg: Event = { type: "assistant.message", text: out.assistantText, ts: now() };
      await this.#store.appendEvent(sessionId, msg);
      yield msg;

      const final: Event = { type: "result", finalText: out.assistantText, stopReason: "end", usage: out.usage, ts: now() };
      await this.#store.appendEvent(sessionId, final);
      yield final;
      return;
    }

    const final: Event = { type: "result", finalText: "", stopReason: "max_steps", ts: now() };
    await this.#store.appendEvent(sessionId, final);
    yield final;
  }

  async #callStreamed(
    sessionId: string,
    req: { model: string; input: unknown[]; tools: unknown[]; apiKey?: string },
  ): Promise<{
    out: { assistantText: string | null; toolCalls: Array<{ toolUseId: string; name: string; input: Record<string, unknown> }>; usage?: Record<string, unknown> };
    deltaEvents: Event[];
  }> {
    const toolCalls: Array<{ toolUseId: string; name: string; input: Record<string, unknown> }> = [];
    const parts: string[] = [];
    let usage: Record<string, unknown> | undefined;
    const deltaEvents: Event[] = [];

    const iter = this.#provider.stream!(req as any);
    for await (const ev of iter as AsyncIterable<ModelStreamEvent>) {
      if (ev.type === "text_delta") {
        parts.push(ev.delta);
        const de: Event = { type: "assistant.delta", textDelta: ev.delta, ts: now() };
        await this.#store.appendEvent(sessionId, de);
        deltaEvents.push(de);
      } else if (ev.type === "tool_call") {
        toolCalls.push(ev.toolCall as any);
      } else if (ev.type === "done") {
        usage = ev.usage;
      }
    }

    return { out: { assistantText: parts.length ? parts.join("") : null, toolCalls, usage }, deltaEvents };
  }
}

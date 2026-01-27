import type { Event } from "../events.js";
import { AskOncePermissionGate } from "../permissions/gate.js";
import type { ApprovalResult, PermissionContext, PermissionQuestion } from "../permissions/gate.js";
import type { SessionStore } from "../session/store.js";
import type { ToolCall, ToolContext } from "../tools/types.js";
import { ToolRegistry } from "../tools/registry.js";

export type ToolRunnerOptions = {
  tools: ToolRegistry;
  permissionGate: AskOncePermissionGate;
  sessionStore: SessionStore;
  contextFactory?: (sessionId: string, toolCall: ToolCall) => Record<string, unknown> | Promise<Record<string, unknown>>;
};

function now(): number {
  return Date.now();
}

export class ToolRunner {
  readonly #tools: ToolRegistry;
  readonly #gate: AskOncePermissionGate;
  readonly #store: SessionStore;
  readonly #contextFactory: NonNullable<ToolRunnerOptions["contextFactory"]>;

  constructor(options: ToolRunnerOptions) {
    this.#tools = options.tools;
    this.#gate = options.permissionGate;
    this.#store = options.sessionStore;
    this.#contextFactory = options.contextFactory ?? (() => ({}));
  }

  async *run(sessionId: string, toolCall: ToolCall): AsyncGenerator<Event> {
    const extra = await this.#contextFactory(sessionId, toolCall);
    const ctx: ToolContext = { ...(extra ?? {}), sessionId, toolUseId: toolCall.toolUseId };

    const useEvent: Event = { type: "tool.use", toolUseId: toolCall.toolUseId, name: toolCall.name, input: toolCall.input, ts: now() };
    await this.#store.appendEvent(sessionId, useEvent);
    yield useEvent;

    const permCtx: PermissionContext = { sessionId, toolUseId: toolCall.toolUseId };
    const approval: ApprovalResult = await this.#gate.approve(toolCall.name, toolCall.input, permCtx);

    if (approval.question) {
      const q = approval.question as PermissionQuestion;
      const qEvent: Event = {
        type: "permission.question",
        questionId: q.questionId,
        toolName: q.toolName,
        prompt: q.prompt,
        ts: now(),
      } as any;
      await this.#store.appendEvent(sessionId, qEvent);
      yield qEvent;
    }

    const decisionEvent: Event = {
      type: "permission.decision",
      questionId: approval.question?.questionId ?? toolCall.toolUseId,
      allowed: approval.allowed,
      ts: now(),
    } as any;
    await this.#store.appendEvent(sessionId, decisionEvent);
    yield decisionEvent;

    if (!approval.allowed) {
      const denied: Event = {
        type: "tool.result",
        toolUseId: toolCall.toolUseId,
        output: null,
        isError: true,
        errorType: "PermissionDenied",
        errorMessage: approval.denyMessage ?? "tool use not approved",
        ts: now(),
      };
      await this.#store.appendEvent(sessionId, denied);
      yield denied;
      return;
    }

    const tool = this.#tools.get(toolCall.name);
    try {
      const output = await tool.run(approval.updatedInput ?? toolCall.input, ctx);
      const ok: Event = { type: "tool.result", toolUseId: toolCall.toolUseId, output, isError: false, ts: now() };
      await this.#store.appendEvent(sessionId, ok);
      yield ok;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      const bad: Event = {
        type: "tool.result",
        toolUseId: toolCall.toolUseId,
        output: null,
        isError: true,
        errorType: err.name,
        errorMessage: err.message,
        ts: now(),
      };
      await this.#store.appendEvent(sessionId, bad);
      yield bad;
    }
  }
}

import type { Event } from "@openagentic/sdk-core";

export type RuntimeLike = {
  runTurn(input: { sessionId?: string; userText: string }): AsyncIterable<Event>;
};

export type Controller = {
  send(text: string): Promise<void>;
};

export type ControllerDeps = {
  ensureRuntime: () => Promise<{ runtime: RuntimeLike; refreshFiles?: () => Promise<void> }>;
  onUserMessage: (text: string) => void;
  onAssistantDelta: (delta: string) => void;
  onAssistantFinal: (text: string) => void;
  setStatus: (text: string) => void;
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function createController(deps: ControllerDeps): Controller {
  let sessionId: string | undefined;

  return {
    async send(text: string) {
      const t = String(text ?? "").trim();
      if (!t) return;

      deps.onUserMessage(t);
      deps.setStatus("running...");

      try {
        const { runtime, refreshFiles } = await deps.ensureRuntime();
        for await (const ev of runtime.runTurn({ sessionId, userText: t })) {
          if (ev.type === "system.init") sessionId = (ev as any).sessionId as string;
          if (ev.type === "assistant.delta") deps.onAssistantDelta(String((ev as any).textDelta ?? ""));
          if (ev.type === "assistant.message") deps.onAssistantFinal(String((ev as any).text ?? ""));
        }
        if (refreshFiles) await refreshFiles();
        deps.setStatus(sessionId ? `session: ${sessionId}` : "ok");
      } catch (e) {
        deps.setStatus(errorMessage(e));
      }
    },
  };
}

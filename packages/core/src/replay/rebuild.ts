import type { Event } from "../events.js";

export type ChatMessage =
  | { role: "system" | "developer" | "user" | "assistant"; content: string }
  | { role: "tool"; tool_call_id: string; content: string };

export type ResponsesInputItem =
  | { role: "system" | "developer" | "user" | "assistant"; content: string }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "function_call_output"; call_id: string; output: string };

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(String(value));
  }
}

export function rebuildChatMessages(events: Event[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const e of events) {
    if (e.type === "system.init") {
      out.push({ role: "system", content: "[system.init]" });
      continue;
    }
    if (e.type === "user.message" && typeof (e as any).text === "string") {
      out.push({ role: "user", content: (e as any).text });
      continue;
    }
    if (e.type === "assistant.message" && typeof (e as any).text === "string") {
      out.push({ role: "assistant", content: (e as any).text });
      continue;
    }
    if (e.type === "tool.use") {
      const id = String((e as any).toolUseId ?? "");
      const name = String((e as any).name ?? "");
      if (id && name) {
        out.push({
          role: "assistant",
          content: "",
          // Keep OpenAI-compatible linkage by serializing tool calls into content for now.
        });
        out.push({ role: "tool", tool_call_id: id, content: `[tool.use] ${name}` });
      }
      continue;
    }
    if (e.type === "tool.result") {
      const id = String((e as any).toolUseId ?? "");
      if (id) out.push({ role: "tool", tool_call_id: id, content: safeJsonStringify((e as any).output) });
      continue;
    }
  }
  return out;
}

export function rebuildResponsesInput(events: Event[]): ResponsesInputItem[] {
  const out: ResponsesInputItem[] = [];
  for (const e of events) {
    if (e.type === "user.message" && typeof (e as any).text === "string") {
      out.push({ role: "user", content: (e as any).text });
      continue;
    }
    if (e.type === "assistant.message" && typeof (e as any).text === "string") {
      out.push({ role: "assistant", content: (e as any).text });
      continue;
    }
    if (e.type === "tool.use") {
      const id = String((e as any).toolUseId ?? "");
      const name = String((e as any).name ?? "");
      const args = safeJsonStringify((e as any).input ?? {});
      if (id && name) out.push({ type: "function_call", call_id: id, name, arguments: args });
      continue;
    }
    if (e.type === "tool.result") {
      const id = String((e as any).toolUseId ?? "");
      const output = safeJsonStringify((e as any).output);
      if (id) out.push({ type: "function_call_output", call_id: id, output });
      continue;
    }
  }
  return out;
}


import { describe, expect, it } from "vitest";

import { OpenAIResponsesProvider } from "../index.js";

describe("OpenAIResponsesProvider.stream", () => {
  it("parses SSE text deltas, tool calls, and done", async () => {
    const originalFetch = globalThis.fetch;
    try {
      const calls: Array<{ url: string; init?: RequestInit }> = [];

      const sse =
        [
          'data: {"type":"response.created","response":{"id":"resp_123"}}\n\n',
          'data: {"type":"response.output_text.delta","delta":"Hel"}\n\n',
          'data: {"type":"response.output_text.delta","delta":"lo"}\n\n',
          'data: {"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","call_id":"call_1","name":"Echo"}}\n\n',
          'data: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"{\\"text\\":\\"hi\\"}"}\n\n',
          'data: {"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","call_id":"call_1","name":"Echo","arguments":"{\\"text\\":\\"hi\\"}"}}\n\n',
          'data: {"type":"response.completed","response":{"id":"resp_123","usage":{"total_tokens":1}}}\n\n',
          "data: [DONE]\n\n",
        ].join("");

      globalThis.fetch = (async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        const encoder = new TextEncoder();
        async function* chunks() {
          yield encoder.encode(sse);
        }
        return { status: 200, body: chunks() } as any;
      }) as any;

      const p = new OpenAIResponsesProvider({ baseUrl: "https://api.openai.com/v1" });

      const events: any[] = [];
      for await (const ev of p.stream!({ model: "gpt-test", input: [], apiKey: "sk-test" })) events.push(ev);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.url).toBe("https://api.openai.com/v1/responses");
      expect((calls[0]!.init as any)?.method).toBe("POST");
      expect((calls[0]!.init as any)?.credentials).toBe("omit");

      expect(events).toEqual([
        { type: "text_delta", delta: "Hel" },
        { type: "text_delta", delta: "lo" },
        { type: "tool_call", toolCall: { toolUseId: "call_1", name: "Echo", input: { text: "hi" } } },
        { type: "done", responseId: "resp_123", usage: { total_tokens: 1 } },
      ]);
    } finally {
      globalThis.fetch = originalFetch as any;
    }
  });
});


import { describe, expect, it } from "vitest";

import { OpenAIResponsesProvider } from "../index.js";

describe("OpenAIResponsesProvider.complete", () => {
  it("POSTs /responses with credentials omitted and parses assistant text + tool calls", async () => {
    const originalFetch = globalThis.fetch;
    try {
      const calls: Array<{ url: string; init?: RequestInit }> = [];

      globalThis.fetch = (async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return {
          status: 200,
          async json() {
            return {
              id: "resp_123",
              output: [
                { type: "message", content: [{ type: "output_text", text: "Hello" }] },
                { type: "function_call", call_id: "call_1", name: "Echo", arguments: "{\"text\":\"hi\"}" },
              ],
              usage: { total_tokens: 1 },
            };
          },
        } as any;
      }) as any;

      const p = new OpenAIResponsesProvider({ baseUrl: "https://api.openai.com/v1" });
      const out = await p.complete({ model: "gpt-test", input: [], apiKey: "sk-test" });

      expect(calls).toHaveLength(1);
      expect(calls[0]!.url).toBe("https://api.openai.com/v1/responses");
      expect((calls[0]!.init as any)?.method).toBe("POST");
      expect((calls[0]!.init as any)?.credentials).toBe("omit");

      expect(out.assistantText).toBe("Hello");
      expect(out.toolCalls).toEqual([{ toolUseId: "call_1", name: "Echo", input: { text: "hi" } }]);
      expect(out.responseId).toBe("resp_123");
      expect(out.usage).toEqual({ total_tokens: 1 });
    } finally {
      globalThis.fetch = originalFetch as any;
    }
  });
});


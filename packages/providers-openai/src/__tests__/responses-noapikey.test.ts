import { describe, expect, it } from "vitest";

import { OpenAIResponsesProvider } from "../responses.js";

describe("OpenAIResponsesProvider (proxy mode)", () => {
  it("does not require apiKey when requireApiKey=false", async () => {
    const calls: any[] = [];
    const fetchImpl: typeof fetch = (async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          id: "r1",
          output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ) as any;
    }) as any;

    const p = new OpenAIResponsesProvider({ baseUrl: "https://api.openai.com/v1", fetchImpl, requireApiKey: false } as any);
    const out = await p.complete({ model: "gpt-test", input: [], tools: [], store: false } as any);

    expect(out.assistantText).toBe("ok");
    expect(calls.length).toBe(1);
    expect(calls[0]!.init.headers.authorization).toBeUndefined();
  });
});


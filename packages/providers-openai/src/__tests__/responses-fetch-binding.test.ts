import { describe, expect, it } from "vitest";

import { OpenAIResponsesProvider } from "../responses.js";

describe("OpenAIResponsesProvider (browser fetch binding)", () => {
  it("binds the default global fetch to avoid 'Illegal invocation'", async () => {
    const original = globalThis.fetch;
    try {
      // Simulate a Window.fetch that requires `this === globalThis`.
      globalThis.fetch = (async function (this: any, _url: any, _init: any) {
        if (this !== globalThis) throw new Error("Illegal invocation");
        return new Response(
          JSON.stringify({
            id: "r1",
            output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ) as any;
      }) as any;

      const p = new OpenAIResponsesProvider({ requireApiKey: false } as any);
      const out = await p.complete({ model: "gpt-test", input: [], tools: [], store: false } as any);
      expect(out.assistantText).toBe("ok");
    } finally {
      globalThis.fetch = original as any;
    }
  });
});


import { describe, expect, expectTypeOf, it } from "vitest";

import { DEFAULT_LLM_PROTOCOL } from "../index.js";
import type { ModelCompleteRequest, ModelOutput, ModelProvider, ModelStreamEvent } from "../index.js";

describe("llm provider types", () => {
  it("exposes a stable default protocol identifier", () => {
    expect(DEFAULT_LLM_PROTOCOL).toBe("responses");
  });

  it("allows implementing ModelProvider.complete()", async () => {
    const p: ModelProvider = {
      name: "test",
      async complete(_req: ModelCompleteRequest): Promise<ModelOutput> {
        return { assistantText: "ok", toolCalls: [] };
      },
    };

    const out = await p.complete({ model: "x", input: [] });
    expect(out.assistantText).toBe("ok");
  });

  it("discriminates ModelStreamEvent", () => {
    const ev: ModelStreamEvent = { type: "text_delta", delta: "hi" };
    if (ev.type === "text_delta") {
      expectTypeOf(ev.delta).toEqualTypeOf<string>();
      expect(ev.delta).toBe("hi");
    } else {
      // This branch should be unreachable for the assigned event.
      expect(false).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";

import * as stateMod from "../state.js";

describe("demo-web state", () => {
  it("reduces streamed deltas into a message", () => {
    const reduceChatState = (stateMod as any).reduceChatState as ((s: any, a: any) => any) | undefined;
    expect(typeof reduceChatState).toBe("function");
    if (typeof reduceChatState !== "function") return;

    const s0 = { messages: [] as any[] };
    const s1 = reduceChatState(s0, { type: "assistant_delta", delta: "he" });
    const s2 = reduceChatState(s1, { type: "assistant_delta", delta: "llo" });
    const s3 = reduceChatState(s2, { type: "assistant_final", text: "hello" });

    expect(s3.messages.at(-1)?.text).toBe("hello");
  });
});


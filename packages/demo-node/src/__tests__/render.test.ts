import { describe, expect, it } from "vitest";

import type { Event } from "@openagentic/sdk-core";

import * as renderMod from "../render.js";

describe("demo-node CLI renderer", () => {
  it("streams assistant deltas and ends with a newline", () => {
    const createCliRenderer = (renderMod as any).createCliRenderer as
      | ((io: { write: (s: string) => void }) => { onEvent: (e: Event) => void })
      | undefined;
    expect(typeof createCliRenderer).toBe("function");
    if (typeof createCliRenderer !== "function") return;

    let out = "";
    const r = createCliRenderer({ write: (s: string) => (out += s) });

    r.onEvent({ type: "assistant.delta", textDelta: "he", ts: 0 } as any);
    r.onEvent({ type: "assistant.delta", textDelta: "llo", ts: 0 } as any);
    r.onEvent({ type: "assistant.message", text: "hello", ts: 0 } as any);

    expect(out).toContain("hello");
    expect(out.endsWith("\n")).toBe(true);
  });
});


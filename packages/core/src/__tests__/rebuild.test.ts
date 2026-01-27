import { describe, expect, it } from "vitest";

import type { Event } from "../events.js";
import { rebuildResponsesInput } from "../replay/rebuild.js";

describe("rebuildResponsesInput", () => {
  it("rebuilds function_call and outputs in order", () => {
    const events: Event[] = [
      { type: "user.message", text: "hi" },
      { type: "tool.use", toolUseId: "call_1", name: "Read", input: { filePath: "a.txt" } },
      { type: "tool.result", toolUseId: "call_1", output: { content: "ok" } },
      { type: "assistant.message", text: "done" },
    ];

    expect(rebuildResponsesInput(events)).toEqual([
      { role: "user", content: "hi" },
      { type: "function_call", call_id: "call_1", name: "Read", arguments: "{\"filePath\":\"a.txt\"}" },
      { type: "function_call_output", call_id: "call_1", output: "{\"content\":\"ok\"}" },
      { role: "assistant", content: "done" },
    ]);
  });
});


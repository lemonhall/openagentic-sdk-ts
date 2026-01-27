import { describe, expect, it, vi } from "vitest";

import { AskOncePermissionGate } from "../permissions/gate.js";

describe("AskOncePermissionGate", () => {
  it("asks once per session+tool, then allows without asking", async () => {
    const approver = vi.fn(async () => true);
    const gate = new AskOncePermissionGate({ approver });

    const sessionId = "s1";
    const toolName = "Read";
    const toolInput = { filePath: "a.txt" };

    const r1 = await gate.approve(toolName, toolInput, { sessionId, toolUseId: "call_1" });
    expect(r1.allowed).toBe(true);
    expect(r1.question?.questionId).toBe("call_1");
    expect(approver).toHaveBeenCalledTimes(1);

    const r2 = await gate.approve(toolName, toolInput, { sessionId, toolUseId: "call_2" });
    expect(r2.allowed).toBe(true);
    expect(r2.question).toBeUndefined();
    expect(approver).toHaveBeenCalledTimes(1);
  });
});


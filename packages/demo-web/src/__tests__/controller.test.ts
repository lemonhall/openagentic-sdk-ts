import { describe, expect, it } from "vitest";

import * as controllerMod from "../controller.js";

describe("demo-web controller", () => {
  it("shows progress and error even when workspace init fails", async () => {
    const createController = (controllerMod as any).createController as ((deps: any) => any) | undefined;
    expect(typeof createController).toBe("function");
    if (typeof createController !== "function") return;

    const statuses: string[] = [];
    const users: string[] = [];

    const controller = createController({
      ensureRuntime: async () => {
        throw new Error("OPFS is not available");
      },
      onUserMessage: (t: string) => users.push(t),
      onAssistantDelta: () => {},
      onAssistantFinal: () => {},
      setStatus: (s: string) => statuses.push(s),
    });

    await controller.send("hi");

    expect(users).toEqual(["hi"]);
    expect(statuses[0]).toBe("running...");
    expect(statuses.at(-1)).toContain("OPFS");
  });
});


import { describe, expect, it } from "vitest";

describe("@openagentic/sdk-web exports", () => {
  it("exports createIndexedDbJsonlBackend", async () => {
    const m = await import("../index.js");
    expect(typeof (m as any).createIndexedDbJsonlBackend).toBe("function");
  });
});


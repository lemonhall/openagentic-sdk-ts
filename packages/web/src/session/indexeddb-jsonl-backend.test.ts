import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";

import { createIndexedDbJsonlBackend } from "./indexeddb-jsonl-backend.js";

function dbName(): string {
  return `oas-test-${Math.random().toString(16).slice(2)}`;
}

describe("IndexedDbJsonlBackend", () => {
  it("supports writeText/readText/appendText", async () => {
    const b = createIndexedDbJsonlBackend({ dbName: dbName() });
    await b.mkdirp("sessions");
    await b.writeText("sessions/a.jsonl", "a\n");
    await b.appendText("sessions/a.jsonl", "b\n");
    expect(await b.readText("sessions/a.jsonl")).toBe("a\nb\n");
  });

  it("readText throws ENOENT for missing path", async () => {
    const b = createIndexedDbJsonlBackend({ dbName: dbName() });
    await expect(() => b.readText("missing.jsonl")).rejects.toThrow(/ENOENT/);
  });
});

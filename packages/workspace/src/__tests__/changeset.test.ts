import { describe, expect, it } from "vitest";

import { computeChangeSet, snapshotWorkspace } from "../changeset.js";
import { MemoryWorkspace } from "../workspace/memory.js";

describe("changeset", () => {
  it("computes adds, deletes, modifies", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("a.txt", new TextEncoder().encode("a"));
    await ws.writeFile("old.txt", new TextEncoder().encode("old"));
    const base = await snapshotWorkspace(ws);

    await ws.writeFile("a.txt", new TextEncoder().encode("b"));
    await ws.deleteFile("old.txt");
    await ws.writeFile("b.txt", new TextEncoder().encode("new"));
    const current = await snapshotWorkspace(ws);

    const cs = computeChangeSet(base, current);
    expect(cs.adds.map((c) => c.path)).toEqual(["b.txt"]);
    expect(cs.deletes.map((c) => c.path)).toEqual(["old.txt"]);
    expect(cs.modifies.map((c) => c.path)).toEqual(["a.txt"]);
  });
});


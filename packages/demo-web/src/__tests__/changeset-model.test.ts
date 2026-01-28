import { describe, expect, it } from "vitest";

import { summarizeChangeSet } from "../changeset-model.js";

describe("summarizeChangeSet", () => {
  it("computes stable counts and a sorted list", () => {
    const s = summarizeChangeSet({
      adds: [{ kind: "add", path: "b.txt", after: { path: "b.txt", sha256: "2", size: 1 } }],
      deletes: [{ kind: "delete", path: "a.txt", before: { path: "a.txt", sha256: "1", size: 1 } }],
      modifies: [],
    } as any);
    expect(s.counts).toEqual({ add: 1, modify: 0, delete: 1 });
    expect(s.items.map((i) => i.path)).toEqual(["a.txt", "b.txt"]);
  });
});


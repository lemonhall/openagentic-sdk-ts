import { describe, expect, it } from "vitest";

import { clearDirectoryHandle } from "../fs-utils.js";

function makeDir(entries: Array<[string, { kind: "file" | "directory" }]>): any {
  const removed: Array<{ name: string; opts: any }> = [];
  return {
    removed,
    async *entries() {
      for (const e of entries) yield e as any;
    },
    async removeEntry(name: string, opts: any) {
      removed.push({ name, opts });
    },
  };
}

describe("fs-utils", () => {
  it("clears a directory handle recursively", async () => {
    const dir = makeDir([
      ["a.txt", { kind: "file" }],
      ["sub", { kind: "directory" }],
    ]);

    await clearDirectoryHandle(dir);

    expect(dir.removed).toEqual([
      { name: "a.txt", opts: { recursive: true } },
      { name: "sub", opts: { recursive: true } },
    ]);
  });
});


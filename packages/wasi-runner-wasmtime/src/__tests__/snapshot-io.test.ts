import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readSnapshotFromDir, writeSnapshotToDir } from "../snapshot-io.js";

describe("snapshot-io", () => {
  it("round-trips a snapshot through a directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "oas-snap-"));
    try {
      const snapshot = {
        files: {
          "a.txt": new TextEncoder().encode("hello"),
          "dir/b.bin": new Uint8Array([1, 2, 3]),
        },
      };
      await writeSnapshotToDir(dir, snapshot);
      const back = await readSnapshotFromDir(dir);
      expect(Object.keys(back.files).sort()).toEqual(["a.txt", "dir/b.bin"]);
      expect(Array.from(back.files["a.txt"])).toEqual(Array.from(snapshot.files["a.txt"]));
      expect(Array.from(back.files["dir/b.bin"])).toEqual([1, 2, 3]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});


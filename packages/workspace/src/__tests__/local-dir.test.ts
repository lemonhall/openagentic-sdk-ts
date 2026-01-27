import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LocalDirWorkspace } from "../node/local-dir.js";

describe("LocalDirWorkspace", () => {
  it("reads/writes/deletes within root and blocks traversal", async () => {
    const root = await mkdtemp(join(tmpdir(), "oas-ws-"));
    try {
      const ws = new LocalDirWorkspace(root);
      await ws.writeFile("a/b.txt", new TextEncoder().encode("ok"));
      const read = await ws.readFile("a/b.txt");
      expect(new TextDecoder().decode(read)).toBe("ok");

      expect(await ws.stat("a")).toEqual({ type: "dir" });
      expect((await ws.listDir("a")).map((e) => `${e.type}:${e.name}`)).toEqual(["file:b.txt"]);

      await ws.deleteFile("a/b.txt");
      expect(await ws.stat("a/b.txt")).toBeNull();

      await expect(ws.writeFile("../evil.txt", new Uint8Array())).rejects.toThrow(/traversal/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});


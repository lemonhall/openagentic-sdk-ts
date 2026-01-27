import { appendFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import type { Event } from "../events.js";
import type { JsonlBackend } from "../session/jsonl.js";
import { JsonlSessionStore } from "../session/jsonl.js";

function nodeBackend(rootDir: string): JsonlBackend {
  const resolve = (p: string) => join(rootDir, p);
  return {
    async mkdirp(dir: string) {
      await mkdir(resolve(dir), { recursive: true });
    },
    async readText(path: string) {
      return readFile(resolve(path), "utf8");
    },
    async writeText(path: string, text: string) {
      await mkdir(dirname(resolve(path)), { recursive: true });
      await writeFile(resolve(path), text, "utf8");
    },
    async appendText(path: string, text: string) {
      await mkdir(dirname(resolve(path)), { recursive: true });
      await appendFile(resolve(path), text, "utf8");
    },
  };
}

describe("session-jsonl", () => {
  it("creates stable session ids and preserves append/read order", async () => {
    const root = await mkdtemp(join(tmpdir(), "oas-ts-"));
    try {
      const store = new JsonlSessionStore(nodeBackend(root));
      const sessionId = await store.createSession({ metadata: { cwd: "/test" } });
      expect(sessionId).toMatch(/^[0-9a-f]{32}$/i);

      const init: Event = { type: "system.init", sessionId };
      const msg: Event = { type: "user.message", text: "hi" };

      await store.appendEvent(sessionId, init);
      await store.appendEvent(sessionId, msg);

      const events = await store.readEvents(sessionId);
      expect(events.map((e) => e.type)).toEqual(["system.init", "user.message"]);
      expect(events[0].seq).toBe(1);
      expect(events[1].seq).toBe(2);
      expect(typeof events[0].ts).toBe("number");
      expect(typeof events[1].ts).toBe("number");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns empty list for unknown session ids", async () => {
    const root = await mkdtemp(join(tmpdir(), "oas-ts-"));
    try {
      const store = new JsonlSessionStore(nodeBackend(root));
      const events = await store.readEvents("0123456789abcdef0123456789abcdef");
      expect(events).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

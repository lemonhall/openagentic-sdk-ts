import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { JsonlSessionStore } from "@openagentic/sdk-core";

import { createNodeJsonlBackend } from "../index.js";

describe("createNodeJsonlBackend", () => {
  it("works with JsonlSessionStore end-to-end", async () => {
    const root = await mkdtemp(join(tmpdir(), "oas-node-"));
    try {
      const store = new JsonlSessionStore(createNodeJsonlBackend(root));
      const sessionId = await store.createSession({ metadata: { cwd: "/tmp" } });
      await store.appendEvent(sessionId, { type: "system.init", sessionId });
      await store.appendEvent(sessionId, { type: "user.message", text: "hi" });
      const events = await store.readEvents(sessionId);
      expect(events.map((e) => e.type)).toEqual(["system.init", "user.message"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});


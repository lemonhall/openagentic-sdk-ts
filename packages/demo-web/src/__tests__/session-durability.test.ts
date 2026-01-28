import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";

import { createDemoSessionStore } from "../session-store.js";

describe("demo-web session store", () => {
  it("creates a session store backed by a durable backend", async () => {
    const store = createDemoSessionStore({ dbName: `oas-demo-${Math.random().toString(16).slice(2)}` });
    const sessionId = await store.createSession();
    await store.appendEvent(sessionId, { type: "user.message", text: "hi" } as any);
    const events = await store.readEvents(sessionId);
    expect(events.length).toBe(1);
    expect((events[0] as any).type).toBe("user.message");
  });
});


import { describe, expect, it } from "vitest";

import { createRegistryClient } from "../registry.js";

describe("createRegistryClient", () => {
  it("defaults to fetch credentials=omit", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    try {
      // @ts-expect-error test stub
      globalThis.fetch = (async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return {
          status: 200,
          async arrayBuffer() {
            return new TextEncoder().encode("{\"ok\":true}").buffer;
          },
          async text() {
            return "{\"ok\":true}";
          },
        } as any;
      }) as any;

      const client = createRegistryClient("https://reg.test");
      const json = await client.fetchJson("https://reg.test/manifest.json");
      expect(json).toEqual({ ok: true });
      expect(calls.length).toBe(1);
      expect(calls[0]!.init?.credentials).toBe("omit");
    } finally {
      globalThis.fetch = originalFetch as any;
    }
  });
});


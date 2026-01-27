import { describe, expect, it } from "vitest";

import { createNetFetch } from "../netfetch.js";

describe("netfetch policy", () => {
  it("enforces maxResponseBytes truncation", async () => {
    const fetchImpl: typeof fetch = (async () =>
      new Response(new Uint8Array(100).fill(97), { status: 200, headers: { "content-type": "text/plain" } })) as any;

    const nf = createNetFetch({ fetchImpl, policy: { maxResponseBytes: 10 } });
    const res = await nf.fetch({ url: "https://x.test" });
    expect(res.status).toBe(200);
    expect(res.body.byteLength).toBe(10);
    expect(res.truncated).toBe(true);
  });

  it("enforces maxRequests", async () => {
    const fetchImpl: typeof fetch = (async () => new Response("ok", { status: 200 })) as any;
    const nf = createNetFetch({ fetchImpl, policy: { maxRequests: 1 } });
    await nf.fetch({ url: "https://x.test/1" });
    await expect(nf.fetch({ url: "https://x.test/2" })).rejects.toThrow(/maxRequests/i);
  });
});


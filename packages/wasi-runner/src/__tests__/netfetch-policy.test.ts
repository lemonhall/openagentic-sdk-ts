import { describe, expect, it } from "vitest";

import { createNetFetch } from "../netfetch.js";

function makeFetch(body: Uint8Array, status = 200): typeof fetch {
  return (async (_url: any, _init: any) => {
    return {
      status,
      headers: new Headers({ "content-type": "text/plain" }),
      async arrayBuffer() {
        return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
      },
    } as any;
  }) as any;
}

describe("createNetFetch", () => {
  it("exposes the resolved policy on the returned object", async () => {
    const nf: any = createNetFetch({ fetchImpl: makeFetch(new Uint8Array([1, 2, 3])), policy: { maxRequests: 7 } });
    expect(nf.policy).toBeTruthy();
    expect(nf.policy.maxRequests).toBe(7);
  });

  it("enforces allow/deny URL policy hooks", async () => {
    const nf = createNetFetch({
      fetchImpl: makeFetch(new TextEncoder().encode("ok")),
      // allow only example.com
      allowUrl: (u) => new URL(u).hostname === "example.com",
    } as any);

    await expect(nf.fetch({ url: "https://example.com/" })).resolves.toBeTruthy();
    await expect(nf.fetch({ url: "https://blocked.test/" })).rejects.toThrow(/blocked/i);
  });
});


import { describe, expect, it } from "vitest";

import { createWebNetFetch } from "../netfetch.js";

describe("createWebNetFetch", () => {
  it("defaults to credentials=omit", async () => {
    let seenCredentials: any = undefined;
    const fetchImpl: typeof fetch = (async (_url, init: any) => {
      seenCredentials = init?.credentials;
      return new Response("ok", { status: 200 });
    }) as any;

    const nf = createWebNetFetch({ fetchImpl });
    await nf.fetch({ url: "https://x.test" });
    expect(seenCredentials).toBe("omit");
  });
});


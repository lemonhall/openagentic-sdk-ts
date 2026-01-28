import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";

import { createBrowserBundleCache } from "../bundle-cache.js";

describe("demo-web bundle cache", () => {
  it("persists bundle assets across cache instances", async () => {
    const base = "http://local";
    const key = "bundles/core-utils/0.0.0/echo.wasm";
    const bytes = new Uint8Array([1, 2, 3, 4]);

    const c1 = createBrowserBundleCache({ base });
    await c1.write(key, bytes);

    const c2 = createBrowserBundleCache({ base });
    const got = await c2.read(key);
    expect(Array.from(got ?? [])).toEqual([1, 2, 3, 4]);
  });
});


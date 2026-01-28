import { describe, expect, it } from "vitest";

import { defaultBundleBaseUrlFromProxy } from "../url-defaults.js";

describe("bundle base url defaults", () => {
  it("derives bundle base url from proxy /v1 base url", () => {
    expect(defaultBundleBaseUrlFromProxy("http://localhost:8787/v1")).toBe("http://localhost:8787");
    expect(defaultBundleBaseUrlFromProxy("http://localhost:8787/v1/")).toBe("http://localhost:8787");
  });
});


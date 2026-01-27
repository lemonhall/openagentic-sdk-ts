import { describe, expect, it } from "vitest";

import { hello } from "../index.js";

describe("sdk-core smoke", () => {
  it("exports hello()", () => {
    expect(hello().text).toBe("hello world");
  });
});


import { describe, expect, it } from "vitest";

import { canonicalJsonBytes } from "../canonical-json.js";

describe("canonicalJsonBytes", () => {
  it("produces deterministic UTF-8 JSON bytes with sorted keys", () => {
    const a = { b: 2, a: 1, nested: { z: 1, y: [3, 2, 1] } };
    const b = { nested: { y: [3, 2, 1], z: 1 }, a: 1, b: 2 };

    const bytesA = canonicalJsonBytes(a);
    const bytesB = canonicalJsonBytes(b);

    expect(new TextDecoder().decode(bytesA)).toBe('{"a":1,"b":2,"nested":{"y":[3,2,1],"z":1}}');
    expect(bytesA).toEqual(bytesB);
  });
});


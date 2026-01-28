import { describe, expect, it } from "vitest";

import { decodeTextPreview } from "../changeset-preview.js";

describe("decodeTextPreview", () => {
  it("returns null for binary-ish bytes", () => {
    const bytes = new Uint8Array([0, 255, 0, 255]);
    expect(decodeTextPreview(bytes)).toBeNull();
  });

  it("decodes utf8 and truncates", () => {
    const bytes = new TextEncoder().encode("hello");
    const p = decodeTextPreview(bytes, { maxChars: 3 });
    expect(p?.text).toBe("hel");
    expect(p?.truncated).toBe(true);
  });
});


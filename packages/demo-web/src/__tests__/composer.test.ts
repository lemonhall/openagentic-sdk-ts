import { describe, expect, it } from "vitest";

import { shouldSubmitOnKeydown } from "../composer.js";

describe("composer", () => {
  it("submits on Enter, not on Shift+Enter", () => {
    expect(shouldSubmitOnKeydown({ key: "Enter", shiftKey: false, isComposing: false })).toBe(true);
    expect(shouldSubmitOnKeydown({ key: "Enter", shiftKey: true, isComposing: false })).toBe(false);
  });

  it("does not submit during IME composition", () => {
    expect(shouldSubmitOnKeydown({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false);
  });
});


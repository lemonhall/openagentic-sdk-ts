import { describe, expect, it } from "vitest";

import { formatChangeSetSummary } from "../changeset-ui.js";

describe("formatChangeSetSummary", () => {
  it("formats counts", () => {
    const text = formatChangeSetSummary({ add: 1, modify: 2, delete: 3 });
    expect(text).toContain("+1");
    expect(text).toContain("~2");
    expect(text).toContain("-3");
  });
});

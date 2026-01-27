import { describe, expect, it } from "vitest";

import { iconKindForEntry, iconSvgForKind } from "../file-icons.js";

describe("file-icons", () => {
  it("chooses folder icon for dirs", () => {
    expect(iconKindForEntry({ type: "dir", name: "src" })).toBe("dir");
  });

  it("chooses type-specific icons for common extensions", () => {
    expect(iconKindForEntry({ type: "file", name: "main.ts" })).toBe("ts");
    expect(iconKindForEntry({ type: "file", name: "app.tsx" })).toBe("ts");
    expect(iconKindForEntry({ type: "file", name: "package.json" })).toBe("json");
    expect(iconKindForEntry({ type: "file", name: "README.md" })).toBe("md");
    expect(iconKindForEntry({ type: "file", name: "logo.svg" })).toBe("image");
    expect(iconKindForEntry({ type: "file", name: "mod.wasm" })).toBe("wasm");
  });

  it("returns an inline svg string for each kind", () => {
    expect(iconSvgForKind("dir")).toContain("<svg");
    expect(iconSvgForKind("ts")).toContain("<svg");
    expect(iconSvgForKind("file")).toContain("<svg");
  });
});


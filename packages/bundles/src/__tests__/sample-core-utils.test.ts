import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseBundleManifest } from "../manifest.js";
import { verifySha256 } from "../verify.js";

describe("sample core-utils bundle", () => {
  it("manifest sha256 matches bundled wasm files", async () => {
    const root = join(process.cwd(), "sample", "bundles", "core-utils", "0.0.0");
    const manifestRaw = JSON.parse(await readFile(join(root, "manifest.json"), "utf8")) as unknown;
    const manifest = parseBundleManifest(manifestRaw);

    expect(manifest.name).toBe("core-utils");
    expect(manifest.version).toBe("0.0.0");

    for (const asset of manifest.assets) {
      const bytes = new Uint8Array(await readFile(join(root, asset.path)));
      await verifySha256(bytes, asset.sha256);
    }
  });
});


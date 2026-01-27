import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseBundleManifest } from "../manifest.js";
import { installBundle } from "../installer.js";
import { createRegistryClient } from "../registry.js";
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

  it("installs with requireSignature=true (official dev key)", async () => {
    const sampleRoot = join(process.cwd(), "sample");
    const root = join(sampleRoot, "bundles", "core-utils", "0.0.0");

    const registry = createRegistryClient("https://sample.local", {
      fetcher: async (url) => {
        const prefix = "https://sample.local/";
        if (!url.startsWith(prefix)) return { status: 404, arrayBuffer: async () => new ArrayBuffer(0), text: async () => "" };
        const rel = url.slice(prefix.length);
        const fsPath = join(sampleRoot, rel);
        try {
          const buf = await readFile(fsPath);
          return {
            status: 200,
            async arrayBuffer() {
              return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            },
            async text() {
              return buf.toString("utf8");
            },
          };
        } catch {
          return { status: 404, arrayBuffer: async () => new ArrayBuffer(0), text: async () => "" };
        }
      },
      isOfficial: true,
    });

    const cache = new Map<string, Uint8Array>();
    const installed = await installBundle("core-utils", "0.0.0", {
      registry,
      cache: {
        async read(path) {
          return cache.get(path) ?? null;
        },
        async write(path, data) {
          cache.set(path, data);
        },
      },
      requireSignature: true,
    });

    expect(installed.rootPath).toBe("bundles/core-utils/0.0.0");
    expect(cache.has("bundles/core-utils/0.0.0/echo.wasm")).toBe(true);
    expect(await readFile(join(root, "manifest.json"), "utf8")).toContain("\"signature\"");
  });
});

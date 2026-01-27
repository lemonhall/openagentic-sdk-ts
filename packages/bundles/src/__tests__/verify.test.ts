import { describe, expect, it } from "vitest";

import { parseBundleManifest } from "../manifest.js";
import { installBundle } from "../installer.js";
import { sha256Hex } from "../verify.js";
import { createRegistryClient } from "../registry.js";

describe("bundles", () => {
  it("validates manifest shape", () => {
    expect(() => parseBundleManifest({})).toThrow(/name/i);
  });

  it("verifies sha256 during install using cache", async () => {
    const wasmBytes = new TextEncoder().encode("fake-wasm");
    const sha = await sha256Hex(wasmBytes);

    const manifest = {
      name: "core-utils",
      version: "0.0.0",
      assets: [{ path: "echo.wasm", sha256: sha, size: wasmBytes.byteLength }],
      commands: [{ name: "echo", modulePath: "echo.wasm" }],
    };

    const served: Record<string, Uint8Array | string> = {
      "https://reg.test/bundles/core-utils/0.0.0/manifest.json": JSON.stringify(manifest),
      "https://reg.test/bundles/core-utils/0.0.0/echo.wasm": wasmBytes,
    };

    const registry = createRegistryClient("https://reg.test", {
      fetcher: async (url) => {
        const v = served[url];
        if (v === undefined) return { status: 404, arrayBuffer: async () => new ArrayBuffer(0), text: async () => "" };
        if (typeof v === "string") {
          return { status: 200, arrayBuffer: async () => new TextEncoder().encode(v).buffer, text: async () => v };
        }
        return { status: 200, arrayBuffer: async () => v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength), text: async () => "" };
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
    });

    expect(installed.manifest.name).toBe("core-utils");
    expect(cache.has("bundles/core-utils/0.0.0/echo.wasm")).toBe(true);
  });
});


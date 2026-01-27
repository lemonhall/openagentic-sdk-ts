import { describe, expect, it } from "vitest";

import { installBundle } from "../installer.js";
import { canonicalJsonBytes } from "../canonical-json.js";
import { createRegistryClient } from "../registry.js";
import { sha256Hex } from "../verify.js";

function base64FromBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

describe("bundle manifest signatures", () => {
  it("verifies signatures for official registries when requireSignature=true", async () => {
    const wasmBytes = new TextEncoder().encode("fake-wasm");
    const sha = await sha256Hex(wasmBytes);

    const privateKey = await crypto.subtle.importKey(
      "jwk",
      {
        kty: "OKP",
        crv: "Ed25519",
        alg: "Ed25519",
        x: "ZzLClo23XmctaEt4zX--ubVfFQnuBEvHMSCwuLBpr4Q",
        d: "afLF4cSNmQbmgQRErTbg73s_vd5Lt_fBJKGB-Aw-qhI",
        ext: true,
        key_ops: ["sign"],
      },
      { name: "Ed25519" },
      false,
      ["sign"],
    );

    const unsigned = {
      name: "core-utils",
      version: "0.0.0",
      assets: [{ path: "echo.wasm", sha256: sha, size: wasmBytes.byteLength }],
      commands: [{ name: "echo", modulePath: "echo.wasm" }],
    };

    const payloadBytes = canonicalJsonBytes(unsigned);
    const sig = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, privateKey, payloadBytes));

    const manifest = { ...unsigned, signature: { keyId: "dev-2026-01", alg: "ed25519", sigBase64: base64FromBytes(sig) } };

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
    await expect(
      installBundle("core-utils", "0.0.0", {
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
      }),
    ).resolves.toBeDefined();
  });

  it("rejects missing signatures when requireSignature=true", async () => {
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
    await expect(
      installBundle("core-utils", "0.0.0", {
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
      }),
    ).rejects.toThrow(/signature required/i);
  });

  it("rejects invalid signatures", async () => {
    const wasmBytes = new TextEncoder().encode("fake-wasm");
    const sha = await sha256Hex(wasmBytes);

    const unsigned = {
      name: "core-utils",
      version: "0.0.0",
      assets: [{ path: "echo.wasm", sha256: sha, size: wasmBytes.byteLength }],
      commands: [{ name: "echo", modulePath: "echo.wasm" }],
    };

    const manifest = {
      ...unsigned,
      signature: { keyId: "dev-2026-01", alg: "ed25519", sigBase64: base64FromBytes(canonicalJsonBytes(unsigned)) },
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
    await expect(
      installBundle("core-utils", "0.0.0", {
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
      }),
    ).rejects.toThrow(/invalid manifest signature/i);
  });
});

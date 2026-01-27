import type { BundleManifest } from "./manifest.js";

export type Fetcher = (url: string) => Promise<{ status: number; arrayBuffer(): Promise<ArrayBuffer>; text(): Promise<string> }>;

export type BundleCache = {
  read(path: string): Promise<Uint8Array | null>;
  write(path: string, data: Uint8Array): Promise<void>;
};

export type RegistryClient = {
  fetchJson(url: string): Promise<unknown>;
  fetchBytes(url: string): Promise<Uint8Array>;
  baseUrl: string;
  isOfficial: boolean;
};

export type BundleInstallerOptions = {
  registry: RegistryClient;
  cache: BundleCache;
  publicKeys?: Record<string, CryptoKey | JsonWebKey>;
  requireSignature?: boolean;
};

export const OFFICIAL_MANIFEST_PUBLIC_KEYS_JWK: Record<string, JsonWebKey> = {
  // Dev/test key used for local bundles and CI. Rotate for real registries.
  "dev-2026-01": {
    kty: "OKP",
    crv: "Ed25519",
    alg: "Ed25519",
    x: "ZzLClo23XmctaEt4zX--ubVfFQnuBEvHMSCwuLBpr4Q",
    ext: true,
    key_ops: ["verify"],
  },
};

export type InstalledBundle = {
  manifest: BundleManifest;
  rootPath: string;
};

export function createRegistryClient(baseUrl: string, options: { fetcher?: Fetcher; isOfficial?: boolean } = {}): RegistryClient {
  const fetcher: Fetcher =
    options.fetcher ??
    (async (url) => {
      const res = await fetch(url, { credentials: "omit" });
      return {
        status: res.status,
        async arrayBuffer() {
          return res.arrayBuffer();
        },
        async text() {
          return res.text();
        },
      };
    });

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    isOfficial: Boolean(options.isOfficial),
    async fetchJson(url: string) {
      const res = await fetcher(url);
      if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      return JSON.parse(await res.text()) as unknown;
    },
    async fetchBytes(url: string) {
      const res = await fetcher(url);
      if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

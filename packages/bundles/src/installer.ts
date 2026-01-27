import { parseBundleManifest } from "./manifest.js";
import type { BundleInstallerOptions, InstalledBundle } from "./registry.js";
import { OFFICIAL_MANIFEST_PUBLIC_KEYS_JWK } from "./registry.js";
import { canonicalJsonBytes } from "./canonical-json.js";
import { unsignedManifestPayload } from "./manifest.js";
import { verifyEd25519Signature } from "./signature.js";
import { verifySha256 } from "./verify.js";

function joinUrl(baseUrl: string, path: string): string {
  const b = baseUrl.replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

export async function installBundle(
  name: string,
  version: string,
  options: BundleInstallerOptions,
): Promise<InstalledBundle> {
  const manifestUrl = joinUrl(options.registry.baseUrl, `bundles/${encodeURIComponent(name)}/${encodeURIComponent(version)}/manifest.json`);
  const raw = await options.registry.fetchJson(manifestUrl);
  const manifest = parseBundleManifest(raw);

  const rootPath = `bundles/${manifest.name}/${manifest.version}`;

  if (options.requireSignature) {
    const sig = manifest.signature;
    if (!sig) throw new Error("manifest signature required");
    if (sig.alg !== "ed25519") throw new Error("unsupported signature algorithm");

    const keys = options.registry.isOfficial
      ? { ...OFFICIAL_MANIFEST_PUBLIC_KEYS_JWK, ...(options.publicKeys ?? {}) }
      : options.publicKeys ?? {};
    const key = keys[sig.keyId];
    if (!key) throw new Error(`unknown signature keyId: ${sig.keyId}`);

    const message = canonicalJsonBytes(unsignedManifestPayload(manifest));
    const ok = await verifyEd25519Signature({ publicKey: key, message, signatureBase64: sig.sigBase64 });
    if (!ok) throw new Error("invalid manifest signature");
  }

  for (const asset of manifest.assets) {
    const assetPath = `${rootPath}/${asset.path}`;
    const cached = await options.cache.read(assetPath);
    if (cached) {
      await verifySha256(cached, asset.sha256);
      continue;
    }
    const bytes = await options.registry.fetchBytes(joinUrl(options.registry.baseUrl, assetPath));
    await verifySha256(bytes, asset.sha256);
    await options.cache.write(assetPath, bytes);
  }

  return { manifest, rootPath };
}

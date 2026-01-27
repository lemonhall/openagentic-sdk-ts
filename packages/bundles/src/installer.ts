import { parseBundleManifest } from "./manifest.js";
import type { BundleInstallerOptions, InstalledBundle } from "./registry.js";
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

  // Signature verification is deferred in v1: the registry plumbing exists,
  // but official signing keys and canonicalization are defined later.
  if (options.requireSignature && options.registry.isOfficial) {
    throw new Error("signature verification not implemented");
  }

  return { manifest, rootPath };
}

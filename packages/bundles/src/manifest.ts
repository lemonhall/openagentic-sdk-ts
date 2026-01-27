export type BundleManifestAsset = {
  path: string;
  sha256: string;
  size: number;
};

export type BundleManifestCommand = {
  name: string;
  modulePath: string;
};

export type BundleManifest = {
  name: string;
  version: string;
  assets: BundleManifestAsset[];
  commands: BundleManifestCommand[];
  signature?: {
    keyId: string;
    alg: "ed25519";
    sigBase64: string;
  };
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function mustString(v: unknown, field: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`BundleManifest: '${field}' must be a non-empty string`);
  return v;
}

function mustNumber(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error(`BundleManifest: '${field}' must be a non-negative number`);
  return v;
}

export function parseBundleManifest(raw: unknown): BundleManifest {
  if (!isRecord(raw)) throw new Error("BundleManifest: must be an object");
  const name = mustString(raw.name, "name");
  const version = mustString(raw.version, "version");

  const assetsRaw = raw.assets;
  if (!Array.isArray(assetsRaw)) throw new Error("BundleManifest: 'assets' must be an array");
  const assets: BundleManifestAsset[] = assetsRaw.map((a, i) => {
    if (!isRecord(a)) throw new Error(`BundleManifest: assets[${i}] must be an object`);
    return {
      path: mustString(a.path, `assets[${i}].path`),
      sha256: mustString(a.sha256, `assets[${i}].sha256`),
      size: mustNumber(a.size, `assets[${i}].size`),
    };
  });

  const commandsRaw = raw.commands;
  if (!Array.isArray(commandsRaw)) throw new Error("BundleManifest: 'commands' must be an array");
  const commands: BundleManifestCommand[] = commandsRaw.map((c, i) => {
    if (!isRecord(c)) throw new Error(`BundleManifest: commands[${i}] must be an object`);
    return {
      name: mustString(c.name, `commands[${i}].name`),
      modulePath: mustString(c.modulePath, `commands[${i}].modulePath`),
    };
  });

  const sigRaw = raw.signature;
  let signature: BundleManifest["signature"];
  if (sigRaw !== undefined) {
    if (!isRecord(sigRaw)) throw new Error("BundleManifest: 'signature' must be an object");
    signature = {
      keyId: mustString(sigRaw.keyId, "signature.keyId"),
      alg: mustString(sigRaw.alg, "signature.alg") as "ed25519",
      sigBase64: mustString(sigRaw.sigBase64, "signature.sigBase64"),
    };
    if (signature.alg !== "ed25519") throw new Error("BundleManifest: unsupported signature.alg");
  }

  return { name, version, assets, commands, ...(signature ? { signature } : {}) };
}


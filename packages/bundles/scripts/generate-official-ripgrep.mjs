import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

async function sha256Hex(data) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function canonicalStringify(value) {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "number") {
    if (!Number.isFinite(value)) throw new Error("canonical JSON does not support non-finite numbers");
    return JSON.stringify(value);
  }
  if (t === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map((v) => canonicalStringify(v)).join(",")}]`;
  if (t === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k])}`).join(",")}}`;
  }
  throw new Error(`canonical JSON does not support type: ${t}`);
}

async function signManifestPayloadEd25519(payload) {
  // Dev/test signing key used only for local bundles.
  const privateJwk = {
    kty: "OKP",
    crv: "Ed25519",
    alg: "Ed25519",
    x: "ZzLClo23XmctaEt4zX--ubVfFQnuBEvHMSCwuLBpr4Q",
    d: "afLF4cSNmQbmgQRErTbg73s_vd5Lt_fBJKGB-Aw-qhI",
    ext: true,
    key_ops: ["sign"],
  };

  const key = await globalThis.crypto.subtle.importKey("jwk", privateJwk, { name: "Ed25519" }, false, ["sign"]);
  const msg = new TextEncoder().encode(canonicalStringify(payload));
  const sig = new Uint8Array(await globalThis.crypto.subtle.sign({ name: "Ed25519" }, key, msg));
  return Buffer.from(sig).toString("base64");
}

async function writeBytes(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(here, "..", "..", "..");

  const wasmPath = process.env.RG_WASM || process.env.RIPGREP_WASM;
  if (!wasmPath) {
    throw new Error("RG_WASM (or RIPGREP_WASM) env var required: path to rg.wasm");
  }

  const version = (process.env.RG_VERSION || "15.1.0").trim() || "15.1.0";
  const name = "ripgrep";

  const officialRoot = join(repoRoot, "packages", "bundles", "official", "bundles", name, version);
  const webRoot = join(repoRoot, "packages", "demo-web", "public", "bundles", name, version);

  const wasmBytes = new Uint8Array(await readFile(wasmPath));

  await writeBytes(join(officialRoot, "rg.wasm"), wasmBytes);
  await writeBytes(join(webRoot, "rg.wasm"), wasmBytes);

  const unsigned = {
    name,
    version,
    assets: [
      {
        path: "rg.wasm",
        sha256: await sha256Hex(wasmBytes),
        size: wasmBytes.byteLength,
      },
    ],
    commands: [{ name: "rg", modulePath: "rg.wasm" }],
  };

  const manifest = {
    ...unsigned,
    signature: {
      keyId: "dev-2026-01",
      alg: "ed25519",
      sigBase64: await signManifestPayloadEd25519(unsigned),
    },
  };

  const manifestJson = JSON.stringify(manifest, null, 2) + "\n";
  await writeFile(join(officialRoot, "manifest.json"), manifestJson, "utf8");
  await writeFile(join(webRoot, "manifest.json"), manifestJson, "utf8");

  // eslint-disable-next-line no-console
  console.log(`Wrote ${name}@${version} to:\n- ${officialRoot}\n- ${webRoot}`);
}

await main();


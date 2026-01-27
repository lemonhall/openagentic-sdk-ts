import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import wabtInit from "wabt";

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
  // Dev/test signing key used only for local sample bundles.
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

async function compileWat(watPath) {
  const wat = await readFile(watPath, "utf8");
  const wabt = await wabtInit();
  const mod = wabt.parseWat(watPath, wat);
  const { buffer } = mod.toBinary({ log: false, write_debug_names: true });
  return new Uint8Array(buffer);
}

async function writeBytes(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(here, "..", "..", "..");
  const sampleRoot = join(repoRoot, "packages", "bundles", "sample");
  const webPublicRoot = join(repoRoot, "packages", "demo-web", "public");

  const version = "0.0.0";
  const bundleRoot = join(sampleRoot, "bundles", "core-utils", version);
  const webBundleRoot = join(webPublicRoot, "bundles", "core-utils", version);
  const watRoot = join(sampleRoot, "wat");

  const commands = [
    { name: "echo", wat: join(watRoot, "echo.wat"), wasm: join(bundleRoot, "echo.wasm") },
    { name: "cat", wat: join(watRoot, "cat.wat"), wasm: join(bundleRoot, "cat.wasm") },
    { name: "grep", wat: join(watRoot, "grep.wat"), wasm: join(bundleRoot, "grep.wasm") },
  ];

  const assets = [];
  for (const c of commands) {
    const bytes = await compileWat(c.wat);
    await writeBytes(c.wasm, bytes);
    await writeBytes(join(webBundleRoot, `${c.name}.wasm`), bytes);
    assets.push({
      path: `${c.name}.wasm`,
      sha256: await sha256Hex(bytes),
      size: bytes.byteLength,
    });
  }

  const unsigned = {
    name: "core-utils",
    version,
    assets: [...assets].sort((a, b) => a.path.localeCompare(b.path)),
    commands: commands.map((c) => ({ name: c.name, modulePath: `${c.name}.wasm` })).sort((a, b) => a.name.localeCompare(b.name)),
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
  await writeFile(join(bundleRoot, "manifest.json"), manifestJson, "utf8");
  await writeFile(join(webBundleRoot, "manifest.json"), manifestJson, "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${commands.length} wasm files + manifest to ${bundleRoot}`);
}

await main();

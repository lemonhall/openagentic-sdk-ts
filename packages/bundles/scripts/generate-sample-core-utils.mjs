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

  const version = "0.0.0";
  const bundleRoot = join(sampleRoot, "bundles", "core-utils", version);
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
    assets.push({
      path: `${c.name}.wasm`,
      sha256: await sha256Hex(bytes),
      size: bytes.byteLength,
    });
  }

  const manifest = {
    name: "core-utils",
    version,
    assets,
    commands: commands.map((c) => ({ name: c.name, modulePath: `${c.name}.wasm` })),
  };

  await writeFile(join(bundleRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${commands.length} wasm files + manifest to ${bundleRoot}`);
}

await main();

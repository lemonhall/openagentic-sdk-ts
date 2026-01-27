import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

import type { WasiFsSnapshot } from "@openagentic/wasi-runner";

function normalizeRelativePath(p: string): string | null {
  if (!p) return null;
  if (p.startsWith("/") || p.includes("\0")) return null;
  const parts = p.split("/").filter((x) => x.length > 0 && x !== ".");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") return null;
    out.push(part);
  }
  return out.join("/");
}

export async function writeSnapshotToDir(rootDir: string, snapshot: WasiFsSnapshot): Promise<void> {
  const entries = Object.entries(snapshot.files ?? {});
  for (const [path, bytes] of entries) {
    const normalized = normalizeRelativePath(path);
    if (!normalized) throw new Error(`Invalid snapshot path: ${path}`);
    const full = join(rootDir, ...normalized.split("/"));
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, bytes);
  }
}

export async function readSnapshotFromDir(rootDir: string): Promise<WasiFsSnapshot> {
  const files: Record<string, Uint8Array> = {};

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!ent.isFile()) continue;
      const rel = relative(rootDir, full);
      const normalized = normalizeRelativePath(rel.split(sep).join("/"));
      if (!normalized) continue;
      files[normalized] = new Uint8Array(await readFile(full));
    }
  }

  await walk(rootDir);
  return { files };
}

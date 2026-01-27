import type { Workspace } from "./workspace.js";
import { normalizeWorkspacePath } from "./path.js";
import { sha256Hex } from "./hash.js";

export type SnapshotEntry = {
  path: string;
  sha256: string;
  size: number;
};

export type Snapshot = {
  files: Record<string, SnapshotEntry>;
};

export type Change =
  | { kind: "add"; path: string; after: SnapshotEntry }
  | { kind: "delete"; path: string; before: SnapshotEntry }
  | { kind: "modify"; path: string; before: SnapshotEntry; after: SnapshotEntry };

export type ChangeSet = {
  adds: Change[];
  deletes: Change[];
  modifies: Change[];
};

export async function snapshotWorkspace(workspace: Workspace): Promise<Snapshot> {
  const files: Record<string, SnapshotEntry> = {};

  async function walk(dir: string): Promise<void> {
    const entries = await workspace.listDir(dir);
    for (const ent of entries) {
      const full = normalizeWorkspacePath(dir ? `${dir}/${ent.name}` : ent.name);
      if (ent.type === "dir") {
        await walk(full);
        continue;
      }
      const data = await workspace.readFile(full);
      files[full] = { path: full, size: data.byteLength, sha256: await sha256Hex(data) };
    }
  }

  await walk("");
  return { files };
}

export function computeChangeSet(base: Snapshot, current: Snapshot): ChangeSet {
  const baseFiles = base.files ?? {};
  const curFiles = current.files ?? {};

  const adds: Change[] = [];
  const deletes: Change[] = [];
  const modifies: Change[] = [];

  const allPaths = new Set<string>([...Object.keys(baseFiles), ...Object.keys(curFiles)].map(normalizeWorkspacePath));
  for (const p of Array.from(allPaths).sort()) {
    const before = baseFiles[p];
    const after = curFiles[p];
    if (!before && after) {
      adds.push({ kind: "add", path: p, after });
      continue;
    }
    if (before && !after) {
      deletes.push({ kind: "delete", path: p, before });
      continue;
    }
    if (before && after && (before.sha256 !== after.sha256 || before.size !== after.size)) {
      modifies.push({ kind: "modify", path: p, before, after });
    }
  }

  return { adds, deletes, modifies };
}

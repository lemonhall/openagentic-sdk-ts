import type { ChangeSet, Snapshot } from "../changeset.js";
import { computeChangeSet, snapshotWorkspace } from "../changeset.js";
import type { Workspace } from "../workspace.js";
import type { FileSystemDirectoryHandleLike } from "./fs-access-types.js";
import { basename, dirname, normalizeWorkspacePath } from "../path.js";
import { toArrayBufferBytes } from "../hash.js";

export type CommitOptions = {
  /**
   * Called once with the computed change set; return false to abort.
   * Use this to implement user review/approval.
   */
  approve?: (changeSet: ChangeSet) => Promise<boolean> | boolean;
};

async function ensureDir(root: FileSystemDirectoryHandleLike, path: string): Promise<FileSystemDirectoryHandleLike> {
  const p = normalizeWorkspacePath(path);
  if (!p) return root;
  let cur = root;
  for (const part of p.split("/")) cur = await cur.getDirectoryHandle(part, { create: true });
  return cur;
}

export async function commitToDirectoryHandle(
  realRoot: FileSystemDirectoryHandleLike,
  shadow: Workspace,
  baseSnapshot: Snapshot,
  options: CommitOptions = {},
): Promise<{ changeSet: ChangeSet }> {
  const current = await snapshotWorkspace(shadow);
  const changeSet = computeChangeSet(baseSnapshot, current);

  const approve = options.approve;
  const allowed = approve ? await approve(changeSet) : true;
  if (!allowed) return { changeSet };

  for (const c of changeSet.deletes) {
    const parent = await ensureDir(realRoot, dirname(c.path));
    await parent.removeEntry(basename(c.path), { recursive: true });
  }

  const applyFile = async (path: string) => {
    const bytes = await shadow.readFile(path);
    const parent = await ensureDir(realRoot, dirname(path));
    const fh = await parent.getFileHandle(basename(path), { create: true });
    const w = await fh.createWritable();
    await w.write(toArrayBufferBytes(bytes));
    await w.close();
  };

  for (const c of changeSet.adds) await applyFile(c.path);
  for (const c of changeSet.modifies) await applyFile(c.path);

  return { changeSet };
}

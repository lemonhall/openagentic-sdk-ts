import type { ChangeSet, Snapshot, Workspace } from "@openagentic/workspace";
import { computeChangeSet, snapshotWorkspace } from "@openagentic/workspace";
import { LocalDirWorkspace } from "@openagentic/workspace/node";

function isReservedPath(path: string): boolean {
  return path === ".openagentic" || path.startsWith(".openagentic/");
}

async function copyAll(src: Workspace, dst: Workspace, dir: string = ""): Promise<void> {
  const entries = await src.listDir(dir);
  for (const ent of entries) {
    const p = dir ? `${dir}/${ent.name}` : ent.name;
    if (isReservedPath(p)) continue;
    if (ent.type === "dir") {
      await copyAll(src, dst, p);
      continue;
    }
    const data = await src.readFile(p);
    await dst.writeFile(p, data);
  }
}

export async function importLocalDirToShadow(options: {
  realDir: string;
  shadow: Workspace;
}): Promise<{ baseSnapshot: Snapshot }> {
  const real = new LocalDirWorkspace(options.realDir);
  await copyAll(real, options.shadow);
  const baseSnapshot = await snapshotWorkspace(options.shadow);
  return { baseSnapshot };
}

export async function commitShadowToLocalDir(options: {
  realDir: string;
  shadow: Workspace;
  baseSnapshot: Snapshot;
}): Promise<{ changeSet: ChangeSet }> {
  const real = new LocalDirWorkspace(options.realDir);
  const current = await snapshotWorkspace(options.shadow);
  const changeSet = computeChangeSet(options.baseSnapshot, current);

  for (const d of changeSet.deletes) {
    if (isReservedPath(d.path)) continue;
    await real.deleteFile(d.path);
  }

  for (const c of [...changeSet.adds, ...changeSet.modifies]) {
    if (isReservedPath(c.path)) continue;
    const bytes = await options.shadow.readFile(c.path);
    await real.writeFile(c.path, bytes);
  }

  return { changeSet };
}

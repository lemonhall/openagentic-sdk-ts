import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import type { Workspace, WorkspaceEntry, WorkspaceStat } from "../workspace.js";
import { dirname, normalizeWorkspacePath } from "../path.js";

function toFsPath(rootDir: string, workspacePath: string): string {
  const rel = normalizeWorkspacePath(workspacePath);
  if (!rel) return rootDir;
  const full = join(rootDir, rel);
  const relBack = relative(rootDir, full);
  if (relBack.startsWith("..") || relBack.split(sep).includes("..")) {
    throw new Error("path traversal not allowed");
  }
  return full;
}

export class LocalDirWorkspace implements Workspace {
  readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  async readFile(path: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(toFsPath(this.rootDir, path)));
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const p = normalizeWorkspacePath(path);
    if (!p) throw new Error("path required");
    const parent = toFsPath(this.rootDir, dirname(p));
    await mkdir(parent, { recursive: true });
    await writeFile(toFsPath(this.rootDir, p), data);
  }

  async deleteFile(path: string): Promise<void> {
    const p = normalizeWorkspacePath(path);
    if (!p) throw new Error("path required");
    await rm(toFsPath(this.rootDir, p), { force: true });
  }

  async stat(path: string): Promise<WorkspaceStat | null> {
    const p = normalizeWorkspacePath(path);
    const full = toFsPath(this.rootDir, p);
    try {
      const st = await stat(full);
      if (st.isDirectory()) return { type: "dir" };
      if (st.isFile()) return { type: "file", size: st.size };
      return null;
    } catch {
      return null;
    }
  }

  async listDir(path: string = ""): Promise<WorkspaceEntry[]> {
    const p = normalizeWorkspacePath(path);
    const full = toFsPath(this.rootDir, p);
    try {
      const ents = await readdir(full, { withFileTypes: true });
      const out: WorkspaceEntry[] = [];
      for (const e of ents) {
        if (e.isDirectory()) out.push({ name: e.name, type: "dir" });
        else if (e.isFile()) out.push({ name: e.name, type: "file" });
      }
      out.sort((a, b) => a.name.localeCompare(b.name));
      return out;
    } catch {
      return [];
    }
  }
}

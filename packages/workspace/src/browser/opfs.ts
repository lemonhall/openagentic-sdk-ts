import type { FileSystemDirectoryHandleLike, FileSystemFileHandleLike } from "./fs-access-types.js";
import type { Workspace, WorkspaceEntry, WorkspaceStat } from "../workspace.js";
import { basename, dirname, normalizeWorkspacePath } from "../path.js";
import { toArrayBufferBytes } from "../hash.js";

export async function getOpfsRootDirectory(): Promise<FileSystemDirectoryHandleLike> {
  const nav: any = globalThis.navigator as any;
  const dir = await nav?.storage?.getDirectory?.();
  if (!dir) throw new Error("OPFS is not available (navigator.storage.getDirectory)");
  return dir as FileSystemDirectoryHandleLike;
}

async function ensureDir(root: FileSystemDirectoryHandleLike, path: string): Promise<FileSystemDirectoryHandleLike> {
  const p = normalizeWorkspacePath(path);
  if (!p) return root;
  let cur = root;
  for (const part of p.split("/")) {
    cur = await cur.getDirectoryHandle(part, { create: true });
  }
  return cur;
}

async function getFileHandle(root: FileSystemDirectoryHandleLike, path: string, create: boolean): Promise<FileSystemFileHandleLike> {
  const p = normalizeWorkspacePath(path);
  const parent = await ensureDir(root, dirname(p));
  return parent.getFileHandle(basename(p), { create });
}

export class OpfsWorkspace implements Workspace {
  #root: FileSystemDirectoryHandleLike;

  constructor(root: FileSystemDirectoryHandleLike) {
    this.#root = root;
  }

  static async open(): Promise<OpfsWorkspace> {
    return new OpfsWorkspace(await getOpfsRootDirectory());
  }

  async readFile(path: string): Promise<Uint8Array> {
    const fh = await getFileHandle(this.#root, path, false);
    const f = await fh.getFile();
    return new Uint8Array(await f.arrayBuffer());
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const fh = await getFileHandle(this.#root, path, true);
    const w = await fh.createWritable();
    await w.write(toArrayBufferBytes(data));
    await w.close();
  }

  async deleteFile(path: string): Promise<void> {
    const p = normalizeWorkspacePath(path);
    const parent = await ensureDir(this.#root, dirname(p));
    await parent.removeEntry(basename(p));
  }

  async stat(path: string): Promise<WorkspaceStat | null> {
    const p = normalizeWorkspacePath(path);
    if (!p) return { type: "dir" };
    try {
      const fh = await getFileHandle(this.#root, p, false);
      const f = await fh.getFile();
      const size = (f as any).size;
      return { type: "file", size: typeof size === "number" ? size : undefined };
    } catch {
      try {
        await ensureDir(this.#root, p);
        return { type: "dir" };
      } catch {
        return null;
      }
    }
  }

  async listDir(path: string = ""): Promise<WorkspaceEntry[]> {
    const p = normalizeWorkspacePath(path);
    const dir = await ensureDir(this.#root, p);
    const out: WorkspaceEntry[] = [];
    for await (const [name, handle] of dir.entries()) {
      out.push({ name, type: handle.kind === "directory" ? "dir" : "file" });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }
}

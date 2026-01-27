import type { WasiExecInput, WasiExecResult, WasiRunner } from "@openagentic/wasi-runner";

import { InProcessWasiRunner } from "../in-process.js";

export type WorkspaceEntry = { name: string; type: "file" | "dir" };

export type WorkspaceLike = {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listDir(path?: string): Promise<WorkspaceEntry[]>;
};

function normalizeWorkspacePath(p: string): string {
  const raw = String(p ?? "").replace(/^\/+/, "");
  const parts = raw.split("/").filter((x) => x && x !== ".");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") throw new Error("invalid path");
    out.push(part);
  }
  return out.join("/");
}

function dirname(p: string): string {
  const s = normalizeWorkspacePath(p);
  const i = s.lastIndexOf("/");
  return i === -1 ? "" : s.slice(0, i);
}

function basename(p: string): string {
  const s = normalizeWorkspacePath(p);
  const i = s.lastIndexOf("/");
  return i === -1 ? s : s.slice(i + 1);
}

async function ensureDir(root: FileSystemDirectoryHandle, path: string): Promise<FileSystemDirectoryHandle> {
  const p = normalizeWorkspacePath(path);
  if (!p) return root;
  let cur = root;
  for (const part of p.split("/")) cur = await cur.getDirectoryHandle(part, { create: true });
  return cur;
}

async function getFileHandle(root: FileSystemDirectoryHandle, path: string, create: boolean): Promise<FileSystemFileHandle> {
  const p = normalizeWorkspacePath(path);
  const parent = await ensureDir(root, dirname(p));
  return parent.getFileHandle(basename(p), { create });
}

export class OpfsWorkspaceLike implements WorkspaceLike {
  readonly #root: FileSystemDirectoryHandle;
  constructor(root: FileSystemDirectoryHandle) {
    this.#root = root;
  }

  async readFile(path: string): Promise<Uint8Array> {
    const fh = await getFileHandle(this.#root, path, false);
    const f = await fh.getFile();
    return new Uint8Array(await f.arrayBuffer());
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const fh = await getFileHandle(this.#root, path, true);
    const w = await fh.createWritable();
    // FileSystemWritableFileStream expects ArrayBuffer / ArrayBufferView backed by ArrayBuffer (not SAB).
    const buf = new Uint8Array(data).buffer;
    await w.write(buf);
    await w.close();
  }

  async deleteFile(path: string): Promise<void> {
    const p = normalizeWorkspacePath(path);
    const parent = await ensureDir(this.#root, dirname(p));
    await parent.removeEntry(basename(p));
  }

  async listDir(path: string = ""): Promise<WorkspaceEntry[]> {
    const p = normalizeWorkspacePath(path);
    const dir = await ensureDir(this.#root, p);
    const out: WorkspaceEntry[] = [];
    for await (const [name, handle] of (dir as any).entries()) {
      out.push({ name, type: handle.kind === "directory" ? "dir" : "file" });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }
}

export async function openOpfsWorkspace(dirName: string): Promise<OpfsWorkspaceLike> {
  const name = String(dirName ?? "").trim();
  if (!name) throw new Error("openOpfsWorkspace: dirName is required");
  const nav: any = globalThis.navigator as any;
  const root = (await nav?.storage?.getDirectory?.()) as FileSystemDirectoryHandle | undefined;
  if (!root) throw new Error("OPFS is not available (navigator.storage.getDirectory)");
  const dir = await root.getDirectoryHandle(name, { create: true });
  return new OpfsWorkspaceLike(dir);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a === b) return true;
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function snapshotWorkspaceFiles(workspace: WorkspaceLike): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};

  async function walk(dir: string): Promise<void> {
    const entries = await workspace.listDir(dir);
    for (const ent of entries) {
      const full = dir ? `${dir}/${ent.name}` : ent.name;
      if (ent.type === "dir") {
        await walk(full);
        continue;
      }
      files[normalizeWorkspacePath(full)] = await workspace.readFile(full);
    }
  }

  await walk("");
  return files;
}

export type WorkspaceMountedWasiRunnerOptions = {
  workspace: WorkspaceLike;
};

/**
 * Runs WASI preview1 modules against a cached in-memory snapshot, but persists deltas
 * back to the backing Workspace after each exec. This is the browser "mounted OPFS" path:
 * no per-command workspace snapshot round-trips on the main thread.
 */
export class WorkspaceMountedWasiRunner implements WasiRunner {
  readonly #workspace: WorkspaceLike;
  readonly #runner = new InProcessWasiRunner();
  #loaded = false;
  #fs: { files: Record<string, Uint8Array> } = { files: {} };

  constructor(options: WorkspaceMountedWasiRunnerOptions) {
    this.#workspace = options.workspace;
  }

  async #ensureLoaded(): Promise<void> {
    if (this.#loaded) return;
    this.#fs = { files: await snapshotWorkspaceFiles(this.#workspace) };
    this.#loaded = true;
  }

  async execModule(input: WasiExecInput): Promise<WasiExecResult> {
    await this.#ensureLoaded();
    const before = this.#fs.files;

    const res = await this.#runner.execModule({ ...input, fs: { files: before } });
    const after = res.fs?.files ?? before;
    this.#fs = { files: after };

    const beforePaths = new Set(Object.keys(before));
    const afterPaths = new Set(Object.keys(after));

    for (const p of beforePaths) {
      if (!afterPaths.has(p)) await this.#workspace.deleteFile(p);
    }
    for (const p of afterPaths) {
      const prev = before[p];
      const next = after[p]!;
      if (!prev || !bytesEqual(prev, next)) await this.#workspace.writeFile(p, next);
    }

    return { ...res, fs: undefined };
  }
}

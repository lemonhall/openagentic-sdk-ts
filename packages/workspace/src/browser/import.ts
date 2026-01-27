import type { Workspace } from "../workspace.js";
import type { FileSystemDirectoryHandleLike, FileSystemFileHandleLike, FileSystemHandleLike } from "./fs-access-types.js";
import { normalizeWorkspacePath } from "../path.js";

export type ImportOptions = {
  /**
   * Optional filter invoked with a normalized relative path.
   * Return false to skip the file/dir.
   */
  filter?: (path: string, kind: "file" | "dir") => boolean;
};

export async function importFromDirectoryHandle(
  sourceRoot: FileSystemDirectoryHandleLike,
  target: Workspace,
  options: ImportOptions = {},
): Promise<void> {
  const filter = options.filter;

  async function walk(dir: FileSystemDirectoryHandleLike, prefix: string): Promise<void> {
    for await (const [name, handle] of dir.entries()) {
      const rel = normalizeWorkspacePath(prefix ? `${prefix}/${name}` : name);
      if (handle.kind === "directory") {
        if (filter && !filter(rel, "dir")) continue;
        await walk(handle as FileSystemDirectoryHandleLike, rel);
        continue;
      }

      if (handle.kind !== "file") continue;
      const fh = handle as FileSystemFileHandleLike;
      if (filter && !filter(rel, "file")) continue;
      const file = await fh.getFile();
      const bytes = new Uint8Array(await file.arrayBuffer());
      await target.writeFile(rel, bytes);
    }
  }

  await walk(sourceRoot, "");
}

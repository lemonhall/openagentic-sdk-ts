import type { FileSystemDirectoryHandleLike } from "@openagentic/workspace";

export async function clearDirectoryHandle(dir: FileSystemDirectoryHandleLike): Promise<void> {
  const names: string[] = [];
  for await (const [name] of dir.entries()) names.push(name);
  for (const name of names) {
    await (dir as any).removeEntry(name, { recursive: true });
  }
}


export type FileSystemHandleKind = "file" | "directory";

export interface FileSystemHandleLike {
  kind: FileSystemHandleKind;
  name: string;
}

export interface FileSystemFileLike {
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

export interface FileSystemWritableFileStreamLike {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
}

export interface FileSystemFileHandleLike extends FileSystemHandleLike {
  kind: "file";
  getFile(): Promise<FileSystemFileLike>;
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}

export interface FileSystemDirectoryHandleLike extends FileSystemHandleLike {
  kind: "directory";
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandleLike>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  entries(): AsyncIterableIterator<[string, FileSystemHandleLike]>;
}


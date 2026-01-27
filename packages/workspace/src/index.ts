export type { Change, ChangeSet, Snapshot, SnapshotEntry } from "./changeset.js";
export { computeChangeSet, snapshotWorkspace } from "./changeset.js";

export type { Workspace, WorkspaceEntry, WorkspaceEntryType, WorkspaceStat } from "./workspace.js";
export { MemoryWorkspace } from "./workspace/memory.js";

export type { FileSystemDirectoryHandleLike, FileSystemFileHandleLike } from "./browser/fs-access-types.js";
export { OpfsWorkspace, getOpfsRootDirectory } from "./browser/opfs.js";
export { importFromDirectoryHandle } from "./browser/import.js";
export { commitToDirectoryHandle } from "./browser/commit.js";

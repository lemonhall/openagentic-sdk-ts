export type WorkspaceEntryType = "file" | "dir";

export type WorkspaceEntry = {
  name: string;
  type: WorkspaceEntryType;
};

export type WorkspaceStat = {
  type: WorkspaceEntryType;
  size?: number;
};

export interface Workspace {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  stat(path: string): Promise<WorkspaceStat | null>;
  listDir(path?: string): Promise<WorkspaceEntry[]>;
}


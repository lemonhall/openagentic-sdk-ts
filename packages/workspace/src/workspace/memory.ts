import type { Workspace, WorkspaceEntry, WorkspaceStat } from "../workspace.js";
import { basename, dirname, normalizeWorkspacePath } from "../path.js";

type Node = { type: "dir"; children: Map<string, Node> } | { type: "file"; data: Uint8Array };

function dirNode(): Node {
  return { type: "dir", children: new Map() };
}

export class MemoryWorkspace implements Workspace {
  #root: Node = dirNode();

  async readFile(path: string): Promise<Uint8Array> {
    const p = normalizeWorkspacePath(path);
    const node = this.#getNode(p);
    if (!node || node.type !== "file") throw new Error(`not a file: ${p}`);
    return node.data;
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const p = normalizeWorkspacePath(path);
    if (!p) throw new Error("path required");
    const parentDir = dirname(p);
    const name = basename(p);
    const parent = this.#ensureDir(parentDir);
    parent.children.set(name, { type: "file", data });
  }

  async deleteFile(path: string): Promise<void> {
    const p = normalizeWorkspacePath(path);
    if (!p) throw new Error("path required");
    const parentDir = dirname(p);
    const name = basename(p);
    const parent = this.#getNode(parentDir);
    if (!parent || parent.type !== "dir") return;
    parent.children.delete(name);
  }

  async stat(path: string): Promise<WorkspaceStat | null> {
    const p = normalizeWorkspacePath(path);
    const node = this.#getNode(p);
    if (!node) return null;
    if (node.type === "dir") return { type: "dir" };
    return { type: "file", size: node.data.byteLength };
  }

  async listDir(path: string = ""): Promise<WorkspaceEntry[]> {
    const p = normalizeWorkspacePath(path);
    const node = this.#getNode(p);
    if (!node) return [];
    if (node.type !== "dir") throw new Error(`not a dir: ${p}`);
    const out: WorkspaceEntry[] = [];
    for (const [name, child] of Array.from(node.children.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      out.push({ name, type: child.type === "dir" ? "dir" : "file" });
    }
    return out;
  }

  #getNode(path: string): Node | null {
    const p = normalizeWorkspacePath(path);
    if (p === "") return this.#root;
    const parts = p.split("/");
    let cur: Node = this.#root;
    for (const part of parts) {
      if (cur.type !== "dir") return null;
      const next = cur.children.get(part);
      if (!next) return null;
      cur = next;
    }
    return cur;
  }

  #ensureDir(path: string): Extract<Node, { type: "dir" }> {
    const p = normalizeWorkspacePath(path);
    if (p === "") return this.#root as Extract<Node, { type: "dir" }>;
    const parts = p.split("/");
    let cur: Node = this.#root;
    for (const part of parts) {
      if (cur.type !== "dir") throw new Error(`not a dir: ${path}`);
      let next = cur.children.get(part);
      if (!next) {
        next = dirNode();
        cur.children.set(part, next);
      }
      cur = next;
    }
    if (cur.type !== "dir") throw new Error(`not a dir: ${path}`);
    return cur;
  }
}


export function normalizeWorkspacePath(path: string): string {
  if (typeof path !== "string") throw new Error("path must be a string");
  let p = path.replaceAll("\\", "/").trim();
  if (p.startsWith("/")) p = p.slice(1);
  if (p === "") return "";
  if (p.includes("\0")) throw new Error("invalid path");

  const parts = p.split("/").filter((x) => x.length > 0);
  const out: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") throw new Error("path traversal not allowed");
    out.push(part);
  }
  return out.join("/");
}

export function dirname(path: string): string {
  const p = normalizeWorkspacePath(path);
  const idx = p.lastIndexOf("/");
  if (idx < 0) return "";
  return p.slice(0, idx);
}

export function basename(path: string): string {
  const p = normalizeWorkspacePath(path);
  const idx = p.lastIndexOf("/");
  return idx < 0 ? p : p.slice(idx + 1);
}


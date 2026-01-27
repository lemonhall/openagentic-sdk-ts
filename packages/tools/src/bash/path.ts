function normalizePart(part: string): string {
  if (!part) return "";
  if (part === ".") return "";
  if (part === "..") throw new Error("path traversal not allowed");
  if (part.includes("\0")) throw new Error("invalid path");
  return part;
}

export function normalizeWorkspacePathLike(path: string): string {
  let p = String(path ?? "").replaceAll("\\", "/").trim();
  while (p.startsWith("/")) p = p.slice(1);
  if (!p) return "";
  const parts = p.split("/").filter(Boolean).map(normalizePart).filter(Boolean);
  return parts.join("/");
}

export function resolveCwdPath(cwd: string, target: string): string {
  const t0 = String(target ?? "").trim();
  if (!t0 || t0 === ".") return normalizeWorkspacePathLike(cwd);
  if (t0.startsWith("/")) return normalizeWorkspacePathLike(t0);
  const base = normalizeWorkspacePathLike(cwd);
  return normalizeWorkspacePathLike(base ? `${base}/${t0}` : t0);
}


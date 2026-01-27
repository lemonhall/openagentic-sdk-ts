import type { Workspace, WorkspaceEntry } from "@openagentic/workspace";

function escapeRegexLiteral(ch: string): string {
  return /[\\.^$|?*+()[\]{}]/.test(ch) ? `\\${ch}` : ch;
}

export function globToRegExp(pattern: string): RegExp {
  const p = String(pattern ?? "").replaceAll("\\", "/").trim().replace(/^\/+/, "");
  let re = "^";
  for (let i = 0; i < p.length; i++) {
    const ch = p[i]!;
    if (ch === "*") {
      if (p[i + 1] === "*") {
        // ** or **/
        if (p[i + 2] === "/") {
          re += "(?:.*\\/)?";
          i += 2;
          continue;
        }
        re += ".*";
        i += 1;
        continue;
      }
      re += "[^/]*";
      continue;
    }
    if (ch === "?") {
      re += "[^/]";
      continue;
    }
    re += escapeRegexLiteral(ch);
  }
  re += "$";
  return new RegExp(re);
}

export function joinPath(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return `${a.replace(/\/+$/, "")}/${b.replace(/^\/+/, "")}`;
}

export async function listFilesRecursive(
  workspace: Workspace,
  rootDir: string,
  options: { maxFiles: number },
): Promise<string[]> {
  const out: string[] = [];
  const maxFiles = options.maxFiles;

  async function walk(dir: string): Promise<void> {
    if (out.length >= maxFiles) return;
    const entries: WorkspaceEntry[] = await workspace.listDir(dir);
    for (const ent of entries) {
      if (out.length >= maxFiles) return;
      const full = dir ? `${dir}/${ent.name}` : ent.name;
      if (ent.type === "dir") {
        await walk(full);
      } else {
        out.push(full);
      }
    }
  }

  await walk(rootDir);
  return out;
}


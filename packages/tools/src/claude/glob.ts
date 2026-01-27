import type { Tool, ToolContext } from "@openagentic/sdk-core";
import type { Workspace } from "@openagentic/workspace";

import { globToRegExp, joinPath, listFilesRecursive } from "./glob-match.js";

export class GlobTool implements Tool {
  readonly name = "Glob";
  readonly description = "Find files by glob pattern (workspace-relative).";
  readonly inputSchema = {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern (subset: *, ?, **)." },
      root: { type: "string", description: "Workspace-relative root dir (optional)." },
      path: { type: "string", description: "Alias of root." },
      max_files: { type: "integer", description: "Hard cap on scanned file count (optional)." },
    },
    required: ["pattern"],
  };

  readonly #maxFiles: number;

  constructor(options: { maxFiles?: number } = {}) {
    this.#maxFiles = typeof options.maxFiles === "number" && options.maxFiles > 0 ? Math.trunc(options.maxFiles) : 20_000;
  }

  async run(toolInput: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const workspace = (ctx as any).workspace as Workspace | undefined;
    if (!workspace) throw new Error("Glob: workspace is required in ToolContext");

    const patternRaw = toolInput.pattern;
    const pattern = typeof patternRaw === "string" ? patternRaw.trim() : "";
    if (!pattern) throw new Error("Glob: 'pattern' must be a non-empty string");

    const rootRaw = (toolInput.root ?? toolInput.path) as unknown;
    const root = typeof rootRaw === "string" ? rootRaw.trim().replace(/^\/+/, "") : "";

    const maxFilesIn = toolInput.max_files;
    const maxFiles = typeof maxFilesIn === "number" && Number.isFinite(maxFilesIn) && maxFilesIn > 0 ? Math.trunc(maxFilesIn) : this.#maxFiles;

    const rx = globToRegExp(pattern);
    const files = await listFilesRecursive(workspace, root, { maxFiles });
    const matches = files
      .map((p) => (root ? p.slice(root.length + 1) : p))
      .filter((rel) => rx.test(rel))
      .map((rel) => joinPath(root, rel))
      .sort((a, b) => a.localeCompare(b));

    return { root, matches, search_path: root, pattern, count: matches.length };
  }
}


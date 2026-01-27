import type { Tool, ToolContext } from "@openagentic/sdk-core";
import type { Workspace } from "@openagentic/workspace";

import { globToRegExp, listFilesRecursive } from "./glob-match.js";

export type GrepToolOptions = {
  maxMatches?: number;
  maxFiles?: number;
  maxBytesPerFile?: number;
};

export class GrepTool implements Tool {
  readonly name = "Grep";
  readonly description = "Search file contents with a regex over the shadow workspace.";
  readonly inputSchema = {
    type: "object",
    properties: {
      query: { type: "string", description: "Regex pattern." },
      file_glob: { type: "string", description: "Glob for files to search (default: **/*)." },
      root: { type: "string", description: "Workspace-relative root dir (optional)." },
      path: { type: "string", description: "Alias of root." },
      case_sensitive: { type: "boolean", description: "Case sensitive search (default: true)." },
      mode: { type: "string", description: "content | files_with_matches" },
      before_context: { type: "integer", description: "Lines of leading context (default: 0)." },
      after_context: { type: "integer", description: "Lines of trailing context (default: 0)." },
    },
    required: ["query"],
  };

  readonly #maxMatches: number;
  readonly #maxFiles: number;
  readonly #maxBytesPerFile: number;

  constructor(options: GrepToolOptions = {}) {
    this.#maxMatches = typeof options.maxMatches === "number" && options.maxMatches > 0 ? Math.trunc(options.maxMatches) : 5000;
    this.#maxFiles = typeof options.maxFiles === "number" && options.maxFiles > 0 ? Math.trunc(options.maxFiles) : 20_000;
    this.#maxBytesPerFile = typeof options.maxBytesPerFile === "number" && options.maxBytesPerFile > 0 ? Math.trunc(options.maxBytesPerFile) : 1024 * 1024;
  }

  async run(toolInput: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const workspace = (ctx as any).workspace as Workspace | undefined;
    if (!workspace) throw new Error("Grep: workspace is required in ToolContext");

    const queryRaw = toolInput.query;
    const query = typeof queryRaw === "string" ? queryRaw : "";
    if (!query) throw new Error("Grep: 'query' must be a non-empty string");

    const fileGlobRaw = toolInput.file_glob ?? "**/*";
    const fileGlob = typeof fileGlobRaw === "string" ? fileGlobRaw.trim() : "";
    if (!fileGlob) throw new Error("Grep: 'file_glob' must be a non-empty string");

    const rootRaw = (toolInput.root ?? toolInput.path) as unknown;
    const root = typeof rootRaw === "string" ? rootRaw.trim().replace(/^\/+/, "") : "";

    const caseSensitive = toolInput.case_sensitive !== false;
    const flags = caseSensitive ? "g" : "gi";
    let rx: RegExp;
    try {
      rx = new RegExp(query, flags);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      throw new Error(`Grep: invalid regex: ${err.message}`);
    }

    const modeRaw = toolInput.mode;
    const mode = typeof modeRaw === "string" && modeRaw.trim() ? modeRaw : "content";
    if (mode !== "content" && mode !== "files_with_matches") throw new Error("Grep: 'mode' must be 'content' or 'files_with_matches'");

    const beforeN = typeof toolInput.before_context === "number" ? Math.trunc(toolInput.before_context) : 0;
    const afterN = typeof toolInput.after_context === "number" ? Math.trunc(toolInput.after_context) : 0;
    if (beforeN < 0) throw new Error("Grep: 'before_context' must be a non-negative integer");
    if (afterN < 0) throw new Error("Grep: 'after_context' must be a non-negative integer");

    const fileRx = globToRegExp(fileGlob);
    const filesAll = await listFilesRecursive(workspace, root, { maxFiles: this.#maxFiles });
    const files = filesAll
      .map((p) => (root ? p.slice(root.length + 1) : p))
      .filter((rel) => fileRx.test(rel))
      .map((rel) => (root ? `${root}/${rel}` : rel))
      .sort((a, b) => a.localeCompare(b));

    const matches: Array<Record<string, unknown>> = [];
    const filesWithMatches = new Set<string>();

    for (const p of files) {
      let bytes = await workspace.readFile(p).catch(() => null);
      if (!bytes) continue;
      if (bytes.byteLength > this.#maxBytesPerFile) bytes = bytes.slice(0, this.#maxBytesPerFile);
      const text = new TextDecoder().decode(bytes);
      const lines = text.split(/\r?\n/);
      if (lines.length && lines.at(-1) === "") lines.pop();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        rx.lastIndex = 0;
        if (!rx.test(line)) continue;
        filesWithMatches.add(p);
        if (mode === "files_with_matches") continue;

        const lineNo = i + 1;
        const before = beforeN ? lines.slice(Math.max(0, i - beforeN), i) : null;
        const after = afterN ? lines.slice(i + 1, Math.min(lines.length, i + 1 + afterN)) : null;
        matches.push({ file_path: p, line: lineNo, text: line, before_context: before, after_context: after });
        if (matches.length >= this.#maxMatches) {
          return { root, query, matches, truncated: true };
        }
      }
    }

    if (mode === "files_with_matches") {
      const files2 = Array.from(filesWithMatches).sort((a, b) => a.localeCompare(b));
      return { root, query, files: files2, count: files2.length };
    }

    return { root, query, matches, truncated: false, total_matches: matches.length };
  }
}


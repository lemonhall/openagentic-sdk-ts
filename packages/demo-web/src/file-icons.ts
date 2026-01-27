import type { WorkspaceEntry } from "@openagentic/workspace";

export type FileIconKind =
  | "dir"
  | "file"
  | "ts"
  | "js"
  | "json"
  | "md"
  | "image"
  | "wasm"
  | "lock"
  | "config";

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0) return "";
  return name.slice(i + 1).toLowerCase();
}

export function iconKindForEntry(entry: Pick<WorkspaceEntry, "type" | "name">): FileIconKind {
  if (entry.type === "dir") return "dir";
  const n = entry.name.toLowerCase();
  if (n === "pnpm-lock.yaml" || n === "package-lock.json" || n === "yarn.lock") return "lock";
  if (n === ".env" || n.startsWith(".env.")) return "config";
  const e = ext(n);
  if (e === "ts" || e === "tsx") return "ts";
  if (e === "js" || e === "jsx" || e === "mjs" || e === "cjs") return "js";
  if (e === "json") return "json";
  if (e === "md" || e === "mdx") return "md";
  if (e === "png" || e === "jpg" || e === "jpeg" || e === "gif" || e === "webp" || e === "svg") return "image";
  if (e === "wasm") return "wasm";
  if (e === "yml" || e === "yaml" || e === "toml" || e === "ini") return "config";
  return "file";
}

function svg(
  pathD: string,
  options: { viewBox?: string; title?: string } = {},
): string {
  const viewBox = options.viewBox ?? "0 0 24 24";
  const title = options.title ? `<title>${options.title}</title>` : "";
  return `<svg class="oaIconSvg" viewBox="${viewBox}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${title}<path d="${pathD}"/></svg>`;
}

export function iconSvgForKind(kind: FileIconKind): string {
  switch (kind) {
    case "dir":
      return svg("M10 4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6z", { title: "Folder" });
    case "ts":
      return svg("M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1v5h5", { title: "TypeScript file" });
    case "js":
      return svg("M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1v5h5", { title: "JavaScript file" });
    case "json":
      return svg("M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1v5h5", { title: "JSON file" });
    case "md":
      return svg("M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1v5h5", { title: "Markdown file" });
    case "image":
      return svg("M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zm-3-11a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM5 19l4-5 3 4 2-3 5 4H5z", { title: "Image file" });
    case "wasm":
      return svg("M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1v5h5", { title: "WASM module" });
    case "lock":
      return svg("M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5zm3 8V7a3 3 0 0 0-6 0v3h6z", { title: "Lockfile" });
    case "config":
      return svg("M19.14 12.94a7.43 7.43 0 0 0 .05-.94 7.43 7.43 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.12 7.12 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 12.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.57.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L1.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.03.31-.05.63-.05.94s.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.06.71 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.8a.5.5 0 0 0 .49-.42l.36-2.54c.57-.23 1.12-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM11 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z", { title: "Config file" });
    case "file":
    default:
      return svg("M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1v5h5", { title: "File" });
  }
}


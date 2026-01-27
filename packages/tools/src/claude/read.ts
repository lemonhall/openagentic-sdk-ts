import type { Tool, ToolContext } from "@openagentic/sdk-core";
import type { Workspace } from "@openagentic/workspace";

function coerceInt(v: unknown, name: string): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number.parseInt(s, 10);
    if (Number.isFinite(n)) return n;
  }
  throw new Error(`Read: '${name}' must be an integer`);
}

function detectImageMime(path: string): string | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

function base64Encode(bytes: Uint8Array): string {
  // Browser + Node.
  const B = (globalThis as any).Buffer as (typeof Buffer) | undefined;
  if (typeof B?.from === "function") return B.from(bytes).toString("base64");
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  // eslint-disable-next-line no-restricted-globals
  const btoaFn = (globalThis as any).btoa as ((s: string) => string) | undefined;
  if (typeof btoaFn !== "function") throw new Error("Read: base64 encoding not available in this environment");
  return btoaFn(binary);
}

export class ReadTool implements Tool {
  readonly name = "Read";
  readonly description = "Read a file from the shadow workspace.";
  readonly inputSchema = {
    type: "object",
    properties: {
      file_path: { type: "string", description: "Workspace-relative path." },
      filePath: { type: "string", description: "Alias of file_path." },
      offset: { type: ["integer", "string"], description: "1-based line offset (optional)." },
      limit: { type: ["integer", "string"], description: "Max lines to return (optional)." },
    },
    required: [],
  };

  readonly #maxBytes: number;

  constructor(options: { maxBytes?: number } = {}) {
    this.#maxBytes = typeof options.maxBytes === "number" && options.maxBytes > 0 ? options.maxBytes : 1024 * 1024;
  }

  async run(toolInput: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const workspace = (ctx as any).workspace as Workspace | undefined;
    if (!workspace) throw new Error("Read: workspace is required in ToolContext");

    const filePathRaw = (toolInput.file_path ?? toolInput.filePath) as unknown;
    const filePath = typeof filePathRaw === "string" ? filePathRaw.trim() : "";
    if (!filePath) throw new Error("Read: 'file_path' must be a non-empty string");

    let offset = coerceInt(toolInput.offset, "offset");
    const limit = coerceInt(toolInput.limit, "limit");
    if (offset === 0) offset = 1;
    if (offset != null && offset < 1) throw new Error("Read: 'offset' must be a positive integer (1-based)");
    if (limit != null && limit < 0) throw new Error("Read: 'limit' must be a non-negative integer");

    let bytes = await workspace.readFile(filePath);
    if (bytes.byteLength > this.#maxBytes) bytes = bytes.slice(0, this.#maxBytes);

    const mime = detectImageMime(filePath);
    if (mime) {
      const image = base64Encode(bytes);
      return { file_path: filePath, image, mime_type: mime, file_size: bytes.byteLength };
    }

    const text = new TextDecoder().decode(bytes);
    const lines = text.split(/\r?\n/);
    if (lines.length && lines.at(-1) === "") lines.pop();

    if (offset != null || limit != null) {
      const start = offset != null ? offset - 1 : 0;
      const end = limit != null ? start + limit : lines.length;
      const slice = lines.slice(start, end);
      const numbered = slice.map((line, i) => `${start + i + 1}: ${line}`).join("\n");
      return { file_path: filePath, content: numbered, total_lines: lines.length, lines_returned: slice.length };
    }

    return { file_path: filePath, content: text };
  }
}

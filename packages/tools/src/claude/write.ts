import type { Tool, ToolContext } from "@openagentic/sdk-core";
import type { Workspace } from "@openagentic/workspace";

export class WriteTool implements Tool {
  readonly name = "Write";
  readonly description = "Create or overwrite a file in the shadow workspace.";
  readonly inputSchema = {
    type: "object",
    properties: {
      file_path: { type: "string", description: "Workspace-relative path." },
      filePath: { type: "string", description: "Alias of file_path." },
      content: { type: "string", description: "UTF-8 text content." },
      overwrite: { type: "boolean", description: "Allow overwriting an existing file (default: false)." },
    },
    required: ["content"],
  };

  async run(toolInput: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const workspace = (ctx as any).workspace as Workspace | undefined;
    if (!workspace) throw new Error("Write: workspace is required in ToolContext");

    const filePathRaw = (toolInput.file_path ?? toolInput.filePath) as unknown;
    const filePath = typeof filePathRaw === "string" ? filePathRaw.trim() : "";
    if (!filePath) throw new Error("Write: 'file_path' must be a non-empty string");

    const content = toolInput.content;
    if (typeof content !== "string") throw new Error("Write: 'content' must be a string");

    const overwrite = Boolean(toolInput.overwrite ?? false);
    const existing = await workspace.stat(filePath);
    if (existing && !overwrite) throw new Error(`Write: file exists: ${filePath}`);

    const bytes = new TextEncoder().encode(content);
    await workspace.writeFile(filePath, bytes);

    return { message: `Wrote ${bytes.byteLength} bytes`, file_path: filePath, bytes_written: bytes.byteLength };
  }
}

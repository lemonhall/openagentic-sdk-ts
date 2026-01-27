import type { Tool, ToolContext } from "@openagentic/sdk-core";
import type { Workspace } from "@openagentic/workspace";

export class WriteFileTool implements Tool {
  readonly name = "WriteFile";
  readonly description = "Write (create/overwrite) a file in the shadow workspace.";
  readonly inputSchema = {
    type: "object",
    properties: {
      path: { type: "string", description: "Workspace-relative path." },
      content: { type: "string", description: "File contents." },
    },
    required: ["path", "content"],
  };

  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const workspace = (ctx as any).workspace as Workspace | undefined;
    if (!workspace) throw new Error("WriteFile: workspace is required in ToolContext");

    const path = input.path;
    if (typeof path !== "string" || !path.trim()) throw new Error("WriteFile: 'path' must be a non-empty string");

    const content = input.content;
    if (typeof content !== "string") throw new Error("WriteFile: 'content' must be a string");

    const bytes = new TextEncoder().encode(content);
    await workspace.writeFile(path, bytes);
    return { ok: true, path };
  }
}

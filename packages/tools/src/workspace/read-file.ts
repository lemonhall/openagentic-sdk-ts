import type { Tool, ToolContext } from "@openagentic/sdk-core";
import type { Workspace } from "@openagentic/workspace";

export class ReadFileTool implements Tool {
  readonly name = "ReadFile";
  readonly description = "Read a file from the shadow workspace.";
  readonly inputSchema = {
    type: "object",
    properties: {
      path: { type: "string", description: "Workspace-relative path." },
    },
    required: ["path"],
  };

  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const workspace = (ctx as any).workspace as Workspace | undefined;
    if (!workspace) throw new Error("ReadFile: workspace is required in ToolContext");

    const path = input.path;
    if (typeof path !== "string" || !path.trim()) throw new Error("ReadFile: 'path' must be a non-empty string");

    const bytes = await workspace.readFile(path);
    const text = new TextDecoder().decode(bytes);
    return { path, content: text, encoding: "utf8" };
  }
}

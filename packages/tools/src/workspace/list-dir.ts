import type { Tool, ToolContext } from "@openagentic/sdk-core";
import type { Workspace } from "@openagentic/workspace";

export class ListDirTool implements Tool {
  readonly name = "ListDir";
  readonly description = "List a directory in the shadow workspace.";
  readonly inputSchema = {
    type: "object",
    properties: {
      path: { type: "string", description: "Workspace-relative directory path (default: empty root)." },
    },
  };

  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const workspace = (ctx as any).workspace as Workspace | undefined;
    if (!workspace) throw new Error("ListDir: workspace is required in ToolContext");

    const path = typeof input.path === "string" ? input.path : "";
    const entries = await workspace.listDir(path);
    return { path, entries };
  }
}


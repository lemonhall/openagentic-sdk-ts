import type { Tool, ToolContext } from "@openagentic/sdk-core";
import type { Workspace } from "@openagentic/workspace";

export class SlashCommandTool implements Tool {
  readonly name = "SlashCommand";
  readonly description = "Load a .claude slash command by name (from the shadow workspace).";
  readonly inputSchema = {
    type: "object",
    properties: {
      name: { type: "string", description: "Slash command name (without .md)." },
    },
    required: ["name"],
  };

  async run(toolInput: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const workspace = (ctx as any).workspace as Workspace | undefined;
    if (!workspace) throw new Error("SlashCommand: workspace is required in ToolContext");

    const nameRaw = toolInput.name;
    const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
    if (!name) throw new Error("SlashCommand: 'name' must be a non-empty string");

    const path = `.claude/commands/${name}.md`;
    const bytes = await workspace.readFile(path).catch(() => null);
    if (!bytes) throw new Error(`SlashCommand: not found: ${path}`);
    const content = new TextDecoder().decode(bytes);
    return { name, path, content };
  }
}


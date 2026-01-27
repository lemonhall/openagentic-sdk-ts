import type { Tool, ToolContext } from "@openagentic/sdk-core";

import { BUILTIN_SKILLS } from "./skills/builtin.js";

function skillListForDescription(): string {
  const names = BUILTIN_SKILLS.map((s) => s.name).sort((a, b) => a.localeCompare(b));
  return names.length ? names.join(", ") : "none";
}

export class SkillTool implements Tool {
  readonly name = "Skill";
  readonly description = `Load a Skill by name. Available skills: ${skillListForDescription()}`;
  readonly inputSchema = {
    type: "object",
    properties: {
      name: { type: "string", description: "Skill name." },
    },
    required: ["name"],
  };

  async run(toolInput: Record<string, unknown>, _ctx: ToolContext): Promise<unknown> {
    const nameRaw = toolInput.name;
    const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
    if (!name) throw new Error("Skill: 'name' must be a non-empty string");

    const match = BUILTIN_SKILLS.find((s) => s.name === name);
    if (!match) {
      throw new Error(`Skill: not found: ${name}. Available skills: ${skillListForDescription()}`);
    }

    const output = [`## Skill: ${match.name}`, "", match.body].join("\n").trim();
    return {
      title: `Loaded skill: ${match.name}`,
      output,
      metadata: { name: match.name, dir: "builtin" },
      name: match.name,
      description: match.description,
      summary: match.summary ?? null,
      checklist: match.checklist ?? [],
      path: `builtin:${match.name}`,
    };
  }
}


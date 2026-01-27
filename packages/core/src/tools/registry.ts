import type { Tool } from "./types.js";

export class ToolRegistry {
  #tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (!tool?.name || typeof tool.name !== "string") throw new Error("ToolRegistry.register: tool.name required");
    this.#tools.set(tool.name, tool);
  }

  get(name: string): Tool {
    const tool = this.#tools.get(name);
    if (!tool) throw new Error(`unknown tool: ${name}`);
    return tool;
  }

  names(): string[] {
    return Array.from(this.#tools.keys()).sort();
  }
}


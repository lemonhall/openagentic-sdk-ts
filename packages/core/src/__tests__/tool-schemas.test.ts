import { describe, expect, it } from "vitest";

import { ToolRegistry, toolSchemasForOpenAIResponses } from "../index.js";
import type { Tool, ToolContext } from "../index.js";

describe("toolSchemasForOpenAIResponses", () => {
  it("maps ToolRegistry to OpenAI Responses tool schemas", () => {
    const echo: Tool = {
      name: "Echo",
      description: "Echo input text",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
      async run(_input: Record<string, unknown>, _ctx: ToolContext) {
        return null;
      },
    };

    const registry = new ToolRegistry();
    registry.register(echo);
    const tools = toolSchemasForOpenAIResponses(registry);

    expect(tools).toEqual([
      {
        type: "function",
        name: "Echo",
        description: "Echo input text",
        parameters: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      },
    ]);
  });
});

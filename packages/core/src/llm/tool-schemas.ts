import type { JsonSchema, Tool } from "../tools/types.js";
import { ToolRegistry } from "../tools/registry.js";

export type OpenAIResponsesToolSchema = {
  type: "function";
  name: string;
  description?: string;
  parameters: JsonSchema;
};

function defaultParameters(): JsonSchema {
  return { type: "object", properties: {} };
}

function isJsonSchemaObject(value: unknown): value is JsonSchema {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toToolSchema(tool: Tool): OpenAIResponsesToolSchema {
  const parameters = isJsonSchemaObject(tool.inputSchema) ? tool.inputSchema : defaultParameters();
  const out: OpenAIResponsesToolSchema = { type: "function", name: tool.name, parameters };
  if (typeof tool.description === "string" && tool.description) out.description = tool.description;
  return out;
}

export function toolSchemasForOpenAIResponses(
  registry: ToolRegistry,
  options: { allowedToolNames?: string[] } = {},
): OpenAIResponsesToolSchema[] {
  const requested = options.allowedToolNames ?? registry.names();
  const seen = new Set<string>();
  const out: OpenAIResponsesToolSchema[] = [];

  for (const name of requested) {
    if (typeof name !== "string" || !name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const tool = registry.get(name);
    out.push(toToolSchema(tool));
  }

  return out;
}


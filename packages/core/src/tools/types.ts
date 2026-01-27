export type JsonSchema = Record<string, unknown>;

export type ToolContext = {
  sessionId: string;
  toolUseId: string;
  [key: string]: unknown;
};

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema?: JsonSchema;
  readonly outputSchema?: JsonSchema;
  run(input: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
}

export type ToolCall = {
  toolUseId: string;
  name: string;
  input: Record<string, unknown>;
};


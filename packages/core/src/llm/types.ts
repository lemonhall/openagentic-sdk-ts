import type { ToolCall } from "../tools/types.js";

export type ModelToolCall = ToolCall;

export type ModelOutput = {
  assistantText: string | null;
  toolCalls: ModelToolCall[];
  usage?: Record<string, unknown>;
  raw?: unknown;
  responseId?: string | null;
  providerMetadata?: Record<string, unknown>;
};

export type ModelStreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_call"; toolCall: ModelToolCall }
  | { type: "done"; responseId?: string | null; usage?: Record<string, unknown> };

export type ModelCompleteRequest<InputItem = unknown> = {
  model: string;
  input: InputItem[];
  instructions?: string | null;
  tools?: unknown[];
  apiKey?: string | null;
  previousResponseId?: string | null;
  store?: boolean;
  include?: string[];
};

export interface ModelProvider<InputItem = unknown> {
  readonly name: string;
  complete(req: ModelCompleteRequest<InputItem>): Promise<ModelOutput>;
  stream?(req: ModelCompleteRequest<InputItem>): AsyncIterable<ModelStreamEvent>;
}


import type { ModelCompleteRequest, ModelOutput, ModelProvider } from "@openagentic/sdk-core";

export type OpenAIResponsesProviderOptions = {
  baseUrl?: string;
  apiKeyHeader?: string;
  fetchImpl?: typeof fetch;
};

function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
      return { _raw: parsed } as Record<string, unknown>;
    } catch {
      return { _raw: raw };
    }
  }
  return { _raw: raw };
}

function parseAssistantText(output: unknown): string | null {
  if (!Array.isArray(output)) return null;
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const it = item as any;
    if (it.type !== "message") continue;
    if (!Array.isArray(it.content)) continue;
    for (const part of it.content) {
      if (!part || typeof part !== "object") continue;
      const p = part as any;
      if (p.type === "output_text" && typeof p.text === "string" && p.text) parts.push(p.text);
    }
  }
  return parts.length ? parts.join("") : null;
}

export class OpenAIResponsesProvider implements ModelProvider {
  readonly name = "openai-responses";
  readonly #baseUrl: string;
  readonly #apiKeyHeader: string;
  readonly #fetch: typeof fetch;

  constructor(options: OpenAIResponsesProviderOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    this.#apiKeyHeader = options.apiKeyHeader ?? "authorization";
    this.#fetch = options.fetchImpl ?? globalThis.fetch;
    if (typeof this.#fetch !== "function") throw new Error("OpenAIResponsesProvider: fetch is required");
  }

  async complete(req: ModelCompleteRequest): Promise<ModelOutput> {
    const apiKey = req.apiKey;
    if (!apiKey) throw new Error("OpenAIResponsesProvider: apiKey is required");

    const url = `${this.#baseUrl}/responses`;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.#apiKeyHeader.toLowerCase() === "authorization") headers.authorization = `Bearer ${apiKey}`;
    else headers[this.#apiKeyHeader] = apiKey;

    const payload: Record<string, unknown> = {
      model: req.model,
      input: Array.isArray(req.input) ? req.input : [],
      store: typeof req.store === "boolean" ? req.store : true,
    };
    if (typeof req.instructions === "string" && req.instructions.trim()) payload.instructions = req.instructions;
    if (Array.isArray(req.tools) && req.tools.length) payload.tools = req.tools;
    if (req.previousResponseId) payload.previous_response_id = req.previousResponseId;
    if (Array.isArray(req.include) && req.include.length) payload.include = req.include;

    const res = await this.#fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      // Browser hard requirement: never send cookies.
      credentials: "omit",
    });
    if ((res as any).status >= 400) throw new Error(`OpenAIResponsesProvider: HTTP ${(res as any).status}`);

    const obj = (await (res as any).json()) as any;
    const outputItems = Array.isArray(obj?.output) ? obj.output : [];

    const assistantText = parseAssistantText(outputItems);

    const toolCalls: Array<{ toolUseId: string; name: string; input: Record<string, unknown> }> = [];
    for (const item of outputItems) {
      if (!item || typeof item !== "object") continue;
      const it = item as any;
      if (it.type !== "function_call") continue;
      const callId = it.call_id;
      const name = it.name;
      if (typeof callId !== "string" || !callId) continue;
      if (typeof name !== "string" || !name) continue;
      toolCalls.push({ toolUseId: callId, name, input: parseToolArguments(it.arguments) });
    }

    return {
      assistantText,
      toolCalls,
      usage: obj?.usage && typeof obj.usage === "object" ? (obj.usage as Record<string, unknown>) : undefined,
      raw: obj,
      responseId: typeof obj?.id === "string" ? obj.id : null,
      providerMetadata: undefined,
    };
  }
}

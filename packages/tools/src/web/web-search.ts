import type { Tool, ToolContext } from "@openagentic/sdk-core";

type FetchLike = (url: string, init?: RequestInit) => Promise<{
  status: number;
  headers?: { get(name: string): string | null };
  json?(): Promise<unknown>;
  text?(): Promise<string>;
}>;

function bindDefaultFetch(): FetchLike {
  const f = globalThis.fetch;
  if (typeof f !== "function") throw new Error("WebSearch: fetch is not available in this environment");
  return f.bind(globalThis) as any;
}

function hostOf(url: string): string {
  try {
    return (new URL(url).hostname || "").toLowerCase();
  } catch {
    return "";
  }
}

function domainAllowed(url: string, allowed: Set<string>, blocked: Set<string>): boolean {
  const host = hostOf(url);
  if (!host) return allowed.size === 0;
  for (const b of blocked) {
    if (host === b || host.endsWith(`.${b}`)) return false;
  }
  if (allowed.size === 0) return true;
  for (const a of allowed) {
    if (host === a || host.endsWith(`.${a}`)) return true;
  }
  return false;
}

export type WebSearchToolOptions = {
  fetchImpl?: FetchLike;
  tavilyApiKey?: string;
  endpoint?: string;
};

export class WebSearchTool implements Tool {
  readonly name = "WebSearch";
  readonly description = "Search the web (Tavily). Requires TAVILY_API_KEY (provided by the host).";
  readonly inputSchema = {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query." },
      max_results: { type: "integer", description: "Max results (default: 5)." },
      allowed_domains: { type: "array", items: { type: "string" }, description: "Allowlist domains (optional)." },
      blocked_domains: { type: "array", items: { type: "string" }, description: "Blocklist domains (optional)." },
    },
    required: ["query"],
  };

  readonly #fetch: FetchLike;
  readonly #apiKey?: string;
  readonly #endpoint: string;

  constructor(options: WebSearchToolOptions = {}) {
    this.#fetch = options.fetchImpl ?? bindDefaultFetch();
    this.#apiKey = typeof options.tavilyApiKey === "string" && options.tavilyApiKey.trim() ? options.tavilyApiKey.trim() : undefined;
    this.#endpoint = (options.endpoint ?? "https://api.tavily.com/search").toString();
  }

  async run(toolInput: Record<string, unknown>, _ctx: ToolContext): Promise<unknown> {
    const queryRaw = toolInput.query;
    const query = typeof queryRaw === "string" ? queryRaw.trim() : "";
    if (!query) throw new Error("WebSearch: 'query' must be a non-empty string");

    const maxResultsRaw = toolInput.max_results ?? 5;
    const maxResults = typeof maxResultsRaw === "number" && Number.isFinite(maxResultsRaw) ? Math.trunc(maxResultsRaw) : 5;
    if (maxResults <= 0) throw new Error("WebSearch: 'max_results' must be a positive integer");

    const allowedDomains = toolInput.allowed_domains;
    const blockedDomains = toolInput.blocked_domains;
    if (allowedDomains != null && !Array.isArray(allowedDomains)) throw new Error("WebSearch: 'allowed_domains' must be a list of strings");
    if (blockedDomains != null && !Array.isArray(blockedDomains)) throw new Error("WebSearch: 'blocked_domains' must be a list of strings");
    const allowed = new Set((allowedDomains ?? []).map((d) => String(d).toLowerCase()));
    const blocked = new Set((blockedDomains ?? []).map((d) => String(d).toLowerCase()));

    const apiKey = this.#apiKey;
    if (!apiKey) throw new Error("WebSearch: missing TAVILY_API_KEY (host must provide it)");

    const payload = { api_key: apiKey, query, max_results: maxResults };
    const res = await this.#fetch(this.#endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "omit",
    });
    if (Number(res.status ?? 0) >= 400) throw new Error(`WebSearch: HTTP ${res.status}`);

    const obj = res.json ? await res.json() : JSON.parse((await res.text?.()) ?? "{}");
    const resultsIn = (obj as any)?.results;

    const results: Array<Record<string, unknown>> = [];
    if (Array.isArray(resultsIn)) {
      for (const r of resultsIn) {
        if (!r || typeof r !== "object") continue;
        const url = (r as any).url;
        if (typeof url !== "string" || !url) continue;
        if (!domainAllowed(url, allowed, blocked)) continue;
        results.push({ title: (r as any).title, url, content: (r as any).content ?? (r as any).snippet ?? null, source: "tavily" });
      }
    }

    return { query, results, total_results: results.length };
  }
}


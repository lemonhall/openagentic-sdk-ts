import type { Tool, ToolContext } from "@openagentic/sdk-core";

type FetchLike = (url: string, init?: RequestInit) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

function bindDefaultFetch(): FetchLike {
  const f = globalThis.fetch;
  if (typeof f !== "function") throw new Error("WebFetch: fetch is not available in this environment");
  return f.bind(globalThis) as any;
}

function isIpv4(host: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
}

function parseIpv4(host: string): number[] | null {
  if (!isIpv4(host)) return null;
  const parts = host.split(".").map((x) => Number.parseInt(x, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return null;
  return parts;
}

function isPrivateIpv4(host: string): boolean {
  const p = parseIpv4(host);
  if (!p) return false;
  const [a, b] = p;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::1") return true;
  if (h.startsWith("fe80:")) return true; // link-local
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local")) return true;
  if (isPrivateIpv4(host)) return true;
  if (host.includes(":") && isPrivateIpv6(host)) return true;
  return false;
}

function validateUrl(url: string, allowPrivateNetworks: boolean): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("WebFetch: invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("WebFetch: only http/https URLs are allowed");
  if (!parsed.hostname) throw new Error("WebFetch: URL must include a hostname");
  if (!allowPrivateNetworks && isBlockedHost(parsed.hostname)) throw new Error("WebFetch: blocked hostname");
  return parsed;
}

export type WebFetchToolOptions = {
  fetchImpl?: FetchLike;
  maxBytes?: number;
  maxRedirects?: number;
  allowPrivateNetworks?: boolean;
};

export class WebFetchTool implements Tool {
  readonly name = "WebFetch";
  readonly description = "Fetch a URL over HTTP(S).";
  readonly inputSchema = {
    type: "object",
    properties: {
      url: { type: "string", description: "http(s) URL." },
      headers: { type: "object", additionalProperties: { type: "string" }, description: "Request headers (optional)." },
    },
    required: ["url"],
  };

  readonly #fetch: FetchLike;
  readonly #maxBytes: number;
  readonly #maxRedirects: number;
  readonly #allowPrivateNetworks: boolean;

  constructor(options: WebFetchToolOptions = {}) {
    this.#fetch = options.fetchImpl ?? bindDefaultFetch();
    this.#maxBytes = typeof options.maxBytes === "number" && options.maxBytes > 0 ? Math.trunc(options.maxBytes) : 1024 * 1024;
    this.#maxRedirects = typeof options.maxRedirects === "number" && options.maxRedirects >= 0 ? Math.trunc(options.maxRedirects) : 5;
    this.#allowPrivateNetworks = Boolean(options.allowPrivateNetworks ?? false);
  }

  async run(toolInput: Record<string, unknown>, _ctx: ToolContext): Promise<unknown> {
    const urlRaw = toolInput.url;
    const requestedUrl = typeof urlRaw === "string" ? urlRaw.trim() : "";
    if (!requestedUrl) throw new Error("WebFetch: 'url' must be a non-empty string");

    validateUrl(requestedUrl, this.#allowPrivateNetworks);

    const headersIn = toolInput.headers ?? {};
    if (headersIn != null && (typeof headersIn !== "object" || Array.isArray(headersIn))) throw new Error("WebFetch: 'headers' must be an object");
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(headersIn as any)) headers[String(k).toLowerCase()] = String(v);

    const chain: string[] = [requestedUrl];
    let current = requestedUrl;
    const emitEvent = (_ctx as any)?.emitEvent as ((ev: any) => Promise<void>) | undefined;

    for (let i = 0; i <= this.#maxRedirects; i++) {
      const started = Date.now();
      const res = await this.#fetch(current, { method: "GET", headers, redirect: "manual", credentials: "omit" });
      const status = Number(res.status ?? 0);
      const location = res.headers?.get?.("location");
      const durationMs = Date.now() - started;

      if ([301, 302, 303, 307, 308].includes(status) && typeof location === "string" && location) {
        if (emitEvent) {
          await emitEvent({
            type: "net.fetch",
            toolUseId: (_ctx as any).toolUseId,
            url: current,
            status,
            bytes: 0,
            truncated: false,
            durationMs,
            ts: Date.now(),
          });
        }
        if (i === this.#maxRedirects) throw new Error(`WebFetch: too many redirects (>${this.#maxRedirects})`);
        const next = new URL(location, current).toString();
        validateUrl(next, this.#allowPrivateNetworks);
        current = next;
        chain.push(current);
        continue;
      }

      let body = new Uint8Array(await res.arrayBuffer());
      const truncated = body.byteLength > this.#maxBytes;
      if (truncated) body = body.slice(0, this.#maxBytes);

      if (emitEvent) {
        await emitEvent({
          type: "net.fetch",
          toolUseId: (_ctx as any).toolUseId,
          url: current,
          status,
          bytes: body.byteLength,
          truncated,
          durationMs,
          ts: Date.now(),
        });
      }

      const contentType = res.headers?.get?.("content-type") ?? null;
      const text = new TextDecoder().decode(body);
      return {
        requested_url: requestedUrl,
        url: current,
        final_url: current,
        redirect_chain: chain,
        status,
        content_type: contentType,
        text,
      };
    }

    throw new Error(`WebFetch: too many redirects (>${this.#maxRedirects})`);
  }
}

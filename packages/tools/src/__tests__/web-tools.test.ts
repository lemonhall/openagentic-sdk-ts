import { describe, expect, it } from "vitest";

import { WebFetchTool } from "../web/web-fetch.js";
import { WebSearchTool } from "../web/web-search.js";

describe("Web tools", () => {
  it("WebFetch follows redirects with credentials omitted", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (url: any, init?: any) => {
      calls.push({ url: String(url), init });
      if (String(url) === "https://example.com/start") {
        return {
          status: 302,
          headers: { get: (k: string) => (k.toLowerCase() === "location" ? "/next" : null) },
          async arrayBuffer() {
            return new ArrayBuffer(0);
          },
        } as any;
      }
      return {
        status: 200,
        headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "text/plain" : null) },
        async arrayBuffer() {
          return new TextEncoder().encode("ok").buffer;
        },
      } as any;
    }) as any;

    const tool = new WebFetchTool({ fetchImpl, maxRedirects: 5 });
    const out = (await tool.run({ url: "https://example.com/start" }, { sessionId: "s", toolUseId: "t" } as any)) as any;

    expect(out.requested_url).toBe("https://example.com/start");
    expect(out.final_url).toBe("https://example.com/next");
    expect(out.redirect_chain).toEqual(["https://example.com/start", "https://example.com/next"]);
    expect(out.status).toBe(200);
    expect(out.text).toBe("ok");
    expect(calls[0]!.init?.credentials).toBe("omit");
  });

  it("WebFetch blocks localhost by default", async () => {
    const tool = new WebFetchTool({ fetchImpl: (async () => ({ status: 200, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) })) as any });
    await expect(tool.run({ url: "http://localhost:1234/" }, { sessionId: "s", toolUseId: "t" } as any)).rejects.toThrow(/blocked/i);
  });

  it("WebSearch calls Tavily and filters domains", async () => {
    const fetchImpl = (async (_url: any, init?: any) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body.api_key).toBe("k");
      expect(body.query).toBe("q");
      return {
        status: 200,
        headers: { get: () => "application/json" },
        async json() {
          return {
            results: [
              { title: "A", url: "https://allowed.com/a", content: "x" },
              { title: "B", url: "https://blocked.com/b", content: "y" },
            ],
          };
        },
      } as any;
    }) as any;

    const tool = new WebSearchTool({ fetchImpl, tavilyApiKey: "k" });
    const out = (await tool.run(
      { query: "q", max_results: 5, allowed_domains: ["allowed.com"], blocked_domains: ["blocked.com"] },
      { sessionId: "s", toolUseId: "t" } as any,
    )) as any;

    expect(out.total_results).toBe(1);
    expect(out.results[0].url).toBe("https://allowed.com/a");
  });
});


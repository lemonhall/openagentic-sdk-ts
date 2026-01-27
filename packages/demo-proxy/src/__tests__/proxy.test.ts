import { describe, expect, it } from "vitest";

import type { IncomingMessage } from "node:http";
import { Readable, Writable } from "node:stream";

import * as serverMod from "../server.js";

describe("demo-proxy", () => {
  it("forwards POST /v1/responses and adds authorization header", async () => {
    const createProxyHandler = (serverMod as any).createProxyHandler as
      | ((opts: { apiKey: string; fetchImpl: typeof fetch }) => (req: IncomingMessage, res: any) => void)
      | undefined;
    expect(typeof createProxyHandler).toBe("function");
    if (typeof createProxyHandler !== "function") return;

    const calls: any[] = [];
    const fakeFetch: typeof fetch = (async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      const text = 'data: {"type":"response.output_text.delta","delta":"hi"}\\n\\n' + "data: [DONE]\\n\\n";
      return new Response(text, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }) as any;
    }) as any;

    const handler = createProxyHandler({ apiKey: "k", fetchImpl: fakeFetch });

    const body = Buffer.from(JSON.stringify({ model: "x", input: [] }), "utf8");
    const req = Readable.from([body]) as any;
    req.method = "POST";
    req.url = "/v1/responses";
    req.headers = { "content-type": "application/json" };

    const headers: Record<string, string> = {};
    const chunks: Buffer[] = [];
    const res = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.from(chunk));
        cb();
      },
    }) as any;
    res.setHeader = (k: string, v: string) => (headers[k.toLowerCase()] = String(v));
    res.getHeader = (k: string) => headers[k.toLowerCase()];
    res.statusCode = 0;

    handler(req, res);
    await new Promise<void>((resolve) => res.on("finish", resolve));

    const text = Buffer.concat(chunks).toString("utf8");
    expect(res.statusCode).toBe(200);
    expect(headers["access-control-allow-origin"]).toBe("*");
    expect(text).toContain("data:");

    expect(calls.length).toBe(1);
    expect(calls[0]!.url).toMatch(/\/v1\/responses$/);
    expect(calls[0]!.init.headers.authorization).toBe("Bearer k");
  });
});

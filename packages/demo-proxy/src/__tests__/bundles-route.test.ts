import { describe, expect, it } from "vitest";

import type { IncomingMessage } from "node:http";
import { Readable, Writable } from "node:stream";

describe("demo-proxy bundles route", () => {
  it("serves an official manifest.json via GET /bundles/...", async () => {
    const serverMod: any = await import("../server.js");
    const createProxyHandler = serverMod.createProxyHandler as
      | ((opts: { apiKey: string; fetchImpl: typeof fetch }) => (req: IncomingMessage, res: any) => void)
      | undefined;
    expect(typeof createProxyHandler).toBe("function");
    if (typeof createProxyHandler !== "function") return;

    const handler = createProxyHandler({
      apiKey: "x",
      fetchImpl: async () => new Response("", { status: 500 }) as any,
    });

    const req = Readable.from([]) as any;
    req.method = "GET";
    req.url = "/bundles/core-utils/0.0.0/manifest.json";
    req.headers = {};

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

    expect(res.statusCode).toBe(200);
    expect(headers["content-type"]).toContain("application/json");
    const text = Buffer.concat(chunks).toString("utf8");
    expect(text).toContain("\"signature\"");
    expect(text).toContain("\"core-utils\"");
  });
});

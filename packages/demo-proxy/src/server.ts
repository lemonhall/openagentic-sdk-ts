import type { IncomingMessage } from "node:http";
import { createServer } from "node:http";
import { Readable } from "node:stream";

export type ProxyServerOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  upstreamOrigin?: string;
};

export type ProxyServer = {
  readonly port: number;
  listen(port: number): Promise<void>;
  close(): Promise<void>;
};

function setCors(res: import("node:http").ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, authorization");
  res.setHeader("access-control-max-age", "86400");
}

async function readBody(req: IncomingMessage): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) chunks.push(chunk as any);
  return Buffer.concat(chunks);
}

export function createProxyHandler(options: ProxyServerOptions): (req: IncomingMessage, res: import("node:http").ServerResponse) => void {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("demo-proxy: fetch is required");

  const upstreamOrigin = (options.upstreamOrigin ?? "https://api.openai.com").replace(/\/+$/, "");
  const upstreamUrl = `${upstreamOrigin}/v1/responses`;

  return async (req, res) => {
    try {
      setCors(res);

      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method !== "POST" || (req.url ?? "") !== "/v1/responses") {
        res.statusCode = 404;
        res.end("not found");
        return;
      }

      const body = await readBody(req);
      const upstream = await fetchImpl(upstreamUrl, {
        method: "POST",
        headers: {
          "content-type": String(req.headers["content-type"] ?? "application/json"),
          authorization: `Bearer ${options.apiKey}`,
        },
        body,
        credentials: "omit",
      } as any);

      res.statusCode = (upstream as any).status ?? 502;
      const ct = (upstream as any).headers?.get?.("content-type");
      if (ct) res.setHeader("content-type", ct);

      const upstreamBody = (upstream as any).body;
      if (!upstreamBody) {
        res.end();
        return;
      }

      Readable.fromWeb(upstreamBody as any).pipe(res);
    } catch (e) {
      res.statusCode = 502;
      res.end(e instanceof Error ? e.message : String(e));
    }
  };
}

export function createProxyServer(options: ProxyServerOptions): ProxyServer {
  const handler = createProxyHandler(options);
  const server = createServer(handler);

  let listeningPort = 0;

  return {
    get port() {
      return listeningPort;
    },
    async listen(port: number) {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, () => {
          const addr = server.address();
          listeningPort = typeof addr === "object" && addr && "port" in addr ? Number((addr as any).port) : port;
          resolve();
        });
      });
    },
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

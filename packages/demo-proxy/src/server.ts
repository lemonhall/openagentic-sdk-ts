import type { IncomingMessage } from "node:http";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

export type ProxyServerOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  /**
   * OpenAI-compatible base URL including the `/v1` prefix.
   * Example: `https://api.openai.com/v1`
   */
  upstreamBaseUrl?: string;
};

export type ProxyServer = {
  readonly port: number;
  listen(port: number): Promise<void>;
  close(): Promise<void>;
};

function setCors(res: import("node:http").ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, authorization");
  res.setHeader("access-control-max-age", "86400");
}

async function readBody(req: IncomingMessage): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) chunks.push(chunk as any);
  return Buffer.concat(chunks);
}

function repoRootFromHere(): string {
  const here = fileURLToPath(new URL(".", import.meta.url));
  return join(here, "..", "..", "..");
}

function bundlesRoot(): string {
  // Prefer official bundles if present; fall back to the dev sample bundles.
  const official = join(repoRootFromHere(), "packages", "bundles", "official", "bundles");
  if (existsSync(official)) return official;

  return join(repoRootFromHere(), "packages", "bundles", "sample", "bundles");
}

function isSafeBundlesPath(urlPath: string): boolean {
  if (!urlPath.startsWith("/bundles/")) return false;
  if (urlPath.includes("..")) return false;
  if (urlPath.includes("\\")) return false;
  return true;
}

function contentTypeForPath(path: string): string {
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".wasm")) return "application/wasm";
  return "application/octet-stream";
}

export function createProxyHandler(options: ProxyServerOptions): (req: IncomingMessage, res: import("node:http").ServerResponse) => void {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("demo-proxy: fetch is required");

  const upstreamBaseUrl = (options.upstreamBaseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const upstreamUrl = `${upstreamBaseUrl}/responses`;
  const bundlesRootDir = bundlesRoot();
  const bundlesRootNorm = normalize(bundlesRootDir);

  return async (req, res) => {
    try {
      setCors(res);

      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }

      const urlPath = String(req.url ?? "").split("?")[0] ?? "";
      if (req.method === "GET" && urlPath.startsWith("/bundles/")) {
        if (!isSafeBundlesPath(urlPath)) {
          res.statusCode = 400;
          res.end("invalid bundles path");
          return;
        }
        const rel = urlPath.replace(/^\/bundles\//, "");
        const full = normalize(join(bundlesRootDir, rel));
        if (!full.startsWith(bundlesRootNorm + sep) && full !== bundlesRootNorm) {
          res.statusCode = 400;
          res.end("invalid bundles path");
          return;
        }
        try {
          const bytes = await readFile(full);
          res.statusCode = 200;
          res.setHeader("content-type", contentTypeForPath(full));
          res.end(bytes);
        } catch {
          res.statusCode = 404;
          res.end("not found");
        }
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

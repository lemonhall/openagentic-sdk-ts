import { createProxyServer } from "./server.js";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("demo-proxy: OPENAI_API_KEY is required");

const upstreamBaseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const port = Number(process.env.PORT ?? "8787");
const srv = createProxyServer({ apiKey, upstreamBaseUrl });
await srv.listen(port);

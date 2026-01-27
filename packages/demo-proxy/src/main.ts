import { createProxyServer } from "./server.js";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("demo-proxy: OPENAI_API_KEY is required");

const port = Number(process.env.PORT ?? "8787");
const srv = createProxyServer({ apiKey });
await srv.listen(port);


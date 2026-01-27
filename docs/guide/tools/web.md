# Web Tools

## `WebFetch`

Fetches an `http(s)` URL.

**Security defaults**
- Cookies are not sent (`credentials: "omit"`).
- Redirects are followed up to a limit.
- Obvious local targets are blocked by default (e.g. `localhost`, `.localhost`, many private IPs).

**Input**
- `url` (string, required)
- `headers` (object<string,string>, optional)

**Output**
- `requested_url`, `final_url`, `redirect_chain`
- `status`, `content_type`, `text`

**Notes**
- In browsers, CORS still applies. If a site blocks cross-origin fetches, the host may need to proxy.
- Host blocking is best-effort; v2 does not do DNS-based private-network detection.

## `WebSearch` (Tavily)

Performs web search using the Tavily API.

**Requirements**
- `TAVILY_API_KEY` must be provided by the host (Node demo: env var; browser demo: typically server-side only).
  - Unlike the Python SDK, v2 does not ship a DuckDuckGo fallback.

**Input**
- `query` (string, required)
- `max_results` (int, default `5`)
- `allowed_domains` / `blocked_domains` (string[], optional)

**Output**
- `{ query, results: [{ title, url, content, source }], total_results }`

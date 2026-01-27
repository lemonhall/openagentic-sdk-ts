# Security Model

## Shadow workspace isolation

Tools operate on a *shadow workspace* (in-memory on Node demos, OPFS in browser demos). The real filesystem is only modified on explicit commit actions.

## Network safety

All SDK fetches default to:

```
credentials: "omit"
```

This prevents cookies from being sent automatically.

### URL restrictions (TS tools)

- `WebFetch` blocks `localhost`, `.local`, and private IP ranges by default.
- Browser demos never send cookies.

### Network auditing

When the runtime’s `ToolContext` includes an `emitEvent(ev)` hook, network activity can be recorded in the session event log via:

- `net.fetch` (URL, status, bytes, truncated, duration)

For WASI modules, the web runner returns per-call audits via `WasiExecResult.netFetchAudits`, and the `Command` tool can forward those into `net.fetch` events.

## API keys

- Node demos read the OpenAI key from `OPENAI_API_KEY`.
- Browser demos use `packages/demo-proxy` so the key stays server-side.

Do not embed long-lived API keys in browser code.

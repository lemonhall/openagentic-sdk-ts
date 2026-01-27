# Security Model

## Shadow workspace isolation

Tools operate on a *shadow workspace* (in-memory on Node demos, OPFS in browser demos). The real filesystem is only modified on explicit commit actions.

## Outer sandboxing (server hardening)

WASI is the portable baseline sandbox. On the server you can optionally add a second isolation boundary around the WASI runner process (“sandbox stacking”).

See `docs/guide/sandboxing.md` for the full model.

### Bubblewrap (`bwrap`) (Linux-only)

The Node demo can run `wasmtime` under Bubblewrap:

- Enable: `OPENAGENTIC_PROCESS_SANDBOX=bwrap`
- Require it (fail fast if unavailable): `OPENAGENTIC_PROCESS_SANDBOX_REQUIRED=1`
- Override binary: `OPENAGENTIC_BWRAP_PATH=bwrap`
- Network policy: `OPENAGENTIC_BWRAP_NETWORK=allow|deny`
- Read-only system binds (comma-separated): `OPENAGENTIC_BWRAP_RO_BINDS=/usr,/bin,/lib,/lib64,/etc`

If Bubblewrap is not available (or not supported on the current OS), the demo prints a warning and continues without the outer sandbox unless it is required.

## Native engine (Linux-only) tradeoffs

If you opt into `OPENAGENTIC_TOOL_ENGINE=native`, the `Bash` tool runs host-native commands under Bubblewrap instead of running signed WASI bundles.

Implications:

- Tool availability/behavior depends on the host (less reproducible than bundles).
- Isolation relies on Bubblewrap policy (mounts, network namespace, limits).
- Prefer `OPENAGENTIC_BWRAP_NETWORK=deny` unless the workflow requires network.

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

### Sandbox auditing (server)

When `wasmtime` is wrapped by an outer sandbox (e.g. Bubblewrap), `WasmtimeWasiRunner.execModule()` returns `WasiExecResult.sandboxAudits` describing the wrapper and the wrapped invocation (with host-path redaction).

## API keys

- Node demos read the OpenAI key from `OPENAI_API_KEY`.
- Browser demos use `packages/demo-proxy` so the key stays server-side.

Do not embed long-lived API keys in browser code.

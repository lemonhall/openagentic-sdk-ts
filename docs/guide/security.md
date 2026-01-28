# Security Model

## Shadow workspace isolation

Tools operate on a *shadow workspace* (in-memory on Node demos, OPFS in browser demos). The real filesystem is only modified on explicit commit actions.

## Server sandboxing (hardening)

As of v13 (2026-01-28), this repo runs tools on Node/server as **host-native processes**. Hardening comes from wrapping execution with an OS sandbox backend (when available) and restricting the filesystem view to the shadow workspace directory.

See `docs/guide/sandboxing.md` for the full model.

### Bubblewrap (`bwrap`) (Linux-only)

The Node demo can run host tools under Bubblewrap:

- Enable: `OPENAGENTIC_SANDBOX_BACKEND=bwrap`
- Require it (fail fast if unavailable): `OPENAGENTIC_SANDBOX_REQUIRED=1`
- Override binary: `OPENAGENTIC_BWRAP_PATH=bwrap`
- Network policy: `OPENAGENTIC_BWRAP_NETWORK=allow|deny`
- Read-only system binds (comma-separated): `OPENAGENTIC_BWRAP_RO_BINDS=/usr,/bin,/lib,/lib64,/etc`

If Bubblewrap is not available (or not supported on the current OS), the demo prints a warning and continues without the sandbox unless it is required.

## Native engine tradeoffs

Implications:

- Tool availability/behavior depends on the host (less reproducible than vendored toolchains).
- Isolation relies on sandbox policy (mounts, network namespace, limits).
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

## API keys

- Node demos read the OpenAI key from `OPENAI_API_KEY`.
- Browser demos use `packages/demo-proxy` so the key stays server-side.

Do not embed long-lived API keys in browser code.

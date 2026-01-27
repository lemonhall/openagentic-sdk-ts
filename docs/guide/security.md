# Security Model

## Shadow workspace isolation

Tools operate on a *shadow workspace* (in-memory on Node demos, OPFS in browser demos). The real filesystem is only modified on explicit commit actions.

## Network safety

All SDK fetches default to:

```
credentials: "omit"
```

This prevents cookies from being sent automatically.

## API keys

- Node demos read the OpenAI key from `OPENAI_API_KEY`.
- Browser demos use `packages/demo-proxy` so the key stays server-side.

Do not embed long-lived API keys in browser code.


# OpenAgentic SDK (TypeScript) — Vision & Plans

This repo is the TypeScript port of the Python `openagentic-sdk`, focused on keeping the **core SDK runtime** while making it easy to run in:

- Browsers (including WebWorkers)
- WASM/WASI-based sandboxed runtimes
- Servers (with a WASI host such as `wasmtime`)

The centerpiece is a **tool-first agent runtime**: sessions are event-sourced, resumable, and all tool executions are sandboxed, permission-gated, and auditable.

## Docs

- Project vision + core design: `docs/plan/2026-01-27-vision-and-core-design.md`
- v1 executable plans index: `docs/plan/index.md`


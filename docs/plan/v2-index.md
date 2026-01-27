# v2 Plans Index — “Runnable Agent” Slice

> Goal of v2: make this repo **actually run an agent** end-to-end against a real LLM backend, including **multi-turn**, **tool calling**, **streaming**, and **session persistence**, while keeping the tool sandbox model (shadow workspace + WASI runner).

## What v1 already has

- Event model + session store abstraction (`@openagentic/sdk-core`)
- Permission-gated tool runner (`@openagentic/sdk-core`)
- Shadow workspace abstractions (Memory/OPFS/LocalDir) (`@openagentic/workspace`)
- WASI runners (web + wasmtime) + netfetch capability (`@openagentic/wasi-runner*`)
- Tool bundles registry/cache plumbing (`@openagentic/bundles`)
- `Command(argv)` + `Shell(script)` tools over WASI (`@openagentic/tools`)

## What’s missing vs the Python SDK to be “runnable”

Python `openagentic_sdk`’s “it runs” path is roughly:

1. Build a system prompt + environment context
2. Persist events (append-only session log)
3. Rebuild provider input from events
4. Call a provider (OpenAI Responses / OpenAI-compatible) — stream deltas and/or tool calls
5. Execute tool calls (permission gated), append tool results, continue
6. Stop conditions: end/max-steps/interrupt

In TS we still need (minimum viable):

- LLM provider interfaces + at least one concrete provider (OpenAI Responses)
- Tool schema generation for provider tool calling
- An agent runtime loop that ties together: session store + provider + tool runner
- A minimal Node runner/demo that proves the stack works end-to-end
- A minimal browser runner/demo (optional but preferred in v2)

## v2 feature plans (execution order)

1. `v2-feature-00-runnable-slice-definition.md` — acceptance criteria + baseline architecture for “runnable”
2. `v2-feature-01-llm-provider-types.md` — core provider types (complete + stream) and shared utilities
3. `v2-feature-02-openai-responses-provider.md` — OpenAI Responses provider implementation (fetch + SSE streaming)
4. `v2-feature-03-tool-schemas-for-openai.md` — convert `ToolRegistry` → OpenAI tool schemas (Responses + optional chat-compat)
5. `v2-feature-04-agent-runtime-loop.md` — event-sourced agent runtime (multi-turn, tools, streaming)
6. `v2-feature-05-basic-workspace-tools.md` — non-WASI “file tools” on the shadow workspace (Read/Write/List/Glob/Grep)
7. `v2-feature-06-node-runner.md` — Node runnable demo: session store + shadow workspace + real OpenAI call
8. `v2-feature-07-browser-runner.md` — Browser runnable demo: OPFS shadow workspace + real OpenAI call (no cookies)
9. `v2-feature-08-guides-and-quickstart.md` — user-facing quickstarts (Node + browser) and security/tooling guides

## Non-goals for v2 (explicitly deferred)

- Full OpenCode/.claude compatibility prompt system (v3+)
- Compaction/summarization and long-context overflow handling (v3+)
- MCP server/client integrations (v3+)
- A full “official tool bundle image” with many Unix tools (v3+)

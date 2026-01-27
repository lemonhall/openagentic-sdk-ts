# v4 Feature 00: “WASI Complete” Runnable Slice Definition

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Define what “初心完成（可跑 + 同语义 WASI + 隔离）” means for v4, and lock scope so we don’t drift.

## Acceptance (v4)

### Runtime

- Multi-turn agent loop works in Node + browser (already v2), including:
  - tool calling
  - session persistence / replay
  - streaming deltas (provider-dependent)

### Shadow workspace

- Tools operate only on a shadow workspace:
  - browser: OPFS-backed shadow workspace
  - node: LocalDir-backed shadow dir workspace
- Real filesystem mutation occurs only on explicit commit boundary (demo UX).

### WASI tooling (default path)

- `Bash` is WASI-first by default (when runner + bundle baseline available).
- `Shell(script)` compiles to `Command(argv)` over installed bundles.
- Baseline `core-utils` bundle covers common work.

### Registry security

- Official registry installs enforce:
  - asset sha256 verification
  - manifest signature verification (Ed25519 over canonical JSON)
- Demos default to official registry only.

### WASI network

- WASI modules can use host-injected `fetch` with:
  - `credentials: "omit"`
  - strict limits (timeout, max bytes)
  - audit events recorded (request meta + response meta, no secrets)

### Python (phase A)

- A `Python` tool exists and runs Python code inside WASI with the same sandbox semantics:
  - reads/writes shadow workspace only
  - no host Python

## Non-goals (v4)

- Full Bash semantics (job control, command substitution, heredocs).
- Docker/container execution.
- Full CPython + `pip` (tracked separately; MicroPython first).
- Multi-agent orchestration UI.

## Wiring strategy (high level)

- Keep v2 runnable path intact as a fallback:
  - if WASI runner or bundles are missing, use TS-native tools.
- Add “capability discovery” so tools can decide:
  - which backend to use (WASI vs TS)
  - which bundle commands are available

## Deliverables

- This doc (done)
- A v4 index linking the execution plans


# v9 Plans Index — Convergence Pass (Python, Bundles, Server netFetch, Release Hardening)

> **Status:** ABANDONED as of v13 (2026-01-28). v13 removes WASI toolchains/bundles/registries and uses host-native execution on Node/server and TS-native tools in the browser.

> Goal of v9: converge “vision ⇄ repo reality ⇄ default runnable paths” so a new user can run real workloads with minimal footguns, and remaining prototype-grade gaps are either shipped or explicitly scoped.

## Why v9 exists

v1–v8 delivered a runnable agent loop (Node + browser), a tool-first runtime with audit + permissions, a shadow workspace with reviewable commits, and a WASI-first toolchain with signed bundle verification.

However, a few remaining gaps still prevent the repo from feeling “production-shippable” end-to-end:

1. **Python runtime is still a demo stub**: `lang-python@0.0.0` intentionally supports only a tiny subset.
2. **“Official bundles” are still local-first**: bundles can be served locally by the proxy under `/bundles/...`, but the project still needs a stable “official bundles” artifact story (layout, versioning, and a future public mirror).
3. **Server `netFetch` has an incomplete “fast + safe” story**: `wasmtime` CLI is fast and isolatable, but cannot support custom host imports; in-process runners can, but change the security/perf envelope.
4. **Release hardening is incomplete**: defaults, docs, and e2e tests need to be strong enough that drift is caught early.

## v9 success criteria (hard)

1. Vision + docs accurately describe repo behavior “as of v8” and explicitly describe remaining v9 scope.
2. A real sandboxed Python runtime is available as a WASI bundle, with clear limits and tests (or a documented, enforced disable-by-default if not shipped yet).
3. A first-class “official bundles” layout exists (even if initially local-only), with a clear future mirror story.
4. Server `netFetch` support is explicit and practical:
   - `wasmtime` CLI runner fails fast (already) and docs are unambiguous.
   - A supported server runner path exists for `netFetch` workloads, with clear tradeoffs and tests.
5. E2E guardrails exist for both Node + browser that exercise “multi-turn → tool call → tool exec → tool result → continue”.

## Plans (suggested execution order)

1. `v9-feature-00-vision-docs-truth-pass.md`
2. `v9-feature-01-official-bundles-v1.md`
3. `v9-feature-02-python-runtime-bundle.md`
4. `v9-feature-03-server-netfetch-runner.md`
5. `v9-feature-04-release-and-e2e-hardening.md`

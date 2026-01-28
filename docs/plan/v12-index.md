# v12 Plans Index — Full `rg` (ripgrep) Parity

> **Status:** ABANDONED as of v13 (2026-01-28). v13 removes WASI toolchains/bundles/registries; this v12 plan is kept for historical context.

> Goal of v12: make `rg` in `BashTool` behave like upstream ripgrep **15.1.0** (CLI surface + behavior), so real-world scripts and developer workflows stop hitting “missing flag / different output / different exit code” traps.

## Spec (source of truth)

v12 targets **ripgrep 15.1.0** semantics, as documented by:

- The upstream `rg` release tag **15.1.0**.
- The `rg(1)` manual page for ripgrep **15.1.0**, which is documented as equivalent to `rg --help` (and `rg -h` as condensed help).

We treat this as the contract for:

- Accepted flags and parsing rules
- Default behaviors (ignore rules, hidden/binary filtering, tty output differences, etc.)
- Output formats (`--json`, `--vimgrep`, `--pcre2`, `--engine`, etc.)
- Exit status rules (0/1/2)

## Why v12 exists

Today, our `rg` is a TS-native builtin that only supports a tiny subset (`-n` and a basic `PATTERN [ROOT]` flow). This is useful as a deterministic fallback, but it is **very far** from real ripgrep.

This gap shows up as:

- scripts failing with “unknown flag”
- unexpected file filtering behavior (ignore rules, hidden files, binary detection, follow symlinks, etc.)
- output format mismatches (file headings, `--json`, context, counts, stats, etc.)

## Strategy

Avoid re-implementing ripgrep in TypeScript.

Instead, ship **the real ripgrep** as a WASI module (a bundle command), then make `BashTool`’s `rg` resolve to that implementation by default when WASI is enabled.

Keep the TS builtin only as a fallback for environments that explicitly disable WASI.

## v12 success criteria (hard)

1. `rg --version` reports ripgrep 15.1.0 (or our pinned build metadata for it).
2. `rg --help` / `rg -h` output matches upstream 15.1.0 (golden snapshots).
3. Core behavior parity:
   - ignore / hidden / binary defaults and `-u` / `-uu` / `-uuu`
   - exit codes 0/1/2
   - `--files`, `--type-list`, `--type-add`, `--type-clear`
   - `--json` output for basic searches
4. Bundle + cache semantics:
   - `.wasm` assets are cached durably in demo-web (no “re-fetch everything every prompt” on reload).
5. Test evidence:
   - node tests (WASI runner) + demo-web tests cover the pinned behavior.

## Plans (suggested execution order)

1. `v12-feature-00-rg-spec-and-golden-snapshots.md`
2. `v12-feature-01-rg-wasi-bundle.md`
3. `v12-feature-02-rg-wiring-and-fallbacks.md`
4. `v12-feature-03-rg-integration-tests.md`
5. `v12-feature-04-rg-performance-and-scaling.md`

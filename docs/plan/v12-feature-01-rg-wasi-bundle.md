# v12 Feature 01: WASI `rg` Bundle (ripgrep 15.1.0)

> **Status:** ABANDONED as of v13 (2026-01-28). v13 removes WASI toolchains/bundles/registries; this plan is kept for historical context.

## Goal

Ship the real ripgrep `rg` as a WASI module so we get full CLI surface and behavior without re-implementing it in TypeScript.

## Scope

- Build ripgrep **15.1.0** as a WASI module (`rg.wasm`) with a pinned Rust toolchain.
- Add a bundle manifest that exposes a `rg` command.
- Ensure bundle assets can be installed and cached (demo-web: durable cache; node: file cache or memory cache depending on runner).

## Notes / Constraints

- Some `rg` features depend on external helper programs (`-z/--search-zip` expects decompression binaries in `PATH`, and `--pre` expects a command). We consider the CLI “fully implemented” when:
  - `rg` itself is present and behaves like upstream, and
  - missing helper binaries fail the same way upstream does on a system without them.

If we decide to ship decompression helpers, that will be a separate v12 feature slice (likely in v12-feature-04).

## Acceptance

- `rg` is present in the installed bundles set and runs under `CommandTool`.
- `rg --version` reports 15.1.0.
- `rg --help` and `rg -h` match the golden snapshots from v12-feature-00.

## Files

- Add a new bundle (either):
  - extend `core-utils` bundle to include `rg`, OR
  - create a new official bundle `ripgrep` containing `rg.wasm`
- Update bundle registry hosting if needed:
  - `packages/bundles/` (manifest + installer)
  - `packages/demo-proxy/` (serving bundles)

## Steps (TDD)

1. RED: golden snapshot tests from v12-feature-00 should fail with “Command: unknown command 'rg'”.
2. GREEN: add `rg` command to bundles and make it runnable via `CommandTool`.
3. GREEN proof: re-run snapshot tests.
4. Ship:
   - `git commit -m "v12: add rg WASI bundle"`
   - `git push`

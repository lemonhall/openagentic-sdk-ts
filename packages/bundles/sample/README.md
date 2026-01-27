# Sample Tool Bundle

This folder contains a minimal development bundle that matches the installer URL layout:

`bundles/<name>/<version>/manifest.json` and corresponding WASI modules.

Current sample:

- `bundles/core-utils/0.0.0/echo.wasm` — prints `hi\n` to stdout.
- `bundles/core-utils/0.0.0/cat.wasm` — copies stdin → stdout (used by `ShellTool` pipelines and redirects).
- `bundles/core-utils/0.0.0/grep.wasm` — minimal line filter over stdin (`argv[1]` substring match).

This is intended for local development and tests; production distribution is via an official registry URL.

## Regenerating wasm + manifest

Run from repo root:

`pnpm -C packages/bundles generate:sample-core-utils`

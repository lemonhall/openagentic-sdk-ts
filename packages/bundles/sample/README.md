# Sample Tool Bundle

This folder contains a minimal development bundle that matches the installer URL layout:

`bundles/<name>/<version>/manifest.json` and corresponding WASI modules.

Current sample:

- `bundles/core-utils/0.0.0/echo.wasm` — prints `hi\n` to stdout via WASI `fd_write`.

This is intended for local development and tests; production distribution is via an official registry URL.


# Official Bundles

This directory is the canonical on-disk layout for **official** signed WASI tool bundles.

Layout:

- `official/bundles/<name>/<version>/manifest.json`
- `official/bundles/<name>/<version>/<asset files>`

Notes:

- Manifests are verified (signature + sha256) before installation/execution.
- In local development, `packages/demo-proxy` serves these files under `/bundles/...`.
- Today these are **dev-signed** bundles intended for local dev/CI; treat them as a placeholder for a future real release signing/mirroring pipeline.

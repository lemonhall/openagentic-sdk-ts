# v1-feature-05 — Tool Bundles & Registry

> **Status:** ABANDONED as of v13 (2026-01-28). v13 removes the bundles/registry “distro” direction entirely and pivots to host-native execution on Node/server and TS-native tools in the browser (see `docs/plan/v13-index.md`).

## Goal

Implement Tool Bundles (WASI modules + manifest) and installation/caching with integrity verification.

## Deliverables

- Bundle manifest schema:
  - commands → module path
  - sha256 per asset
  - sizes, version, suggested limits
- Bundle manager:
  - install (download assets)
  - verify (sha256; signature for official)
  - cache (OPFS in browser; local dir on server)
- Registry client:
  - official registry with signature + sha256 required
  - third-party registry supported with sha256 required (signature optional; “no warranty”)

## Files

Create/modify (suggested):

- `packages/bundles/src/manifest.ts`
- `packages/bundles/src/registry.ts`
- `packages/bundles/src/installer.ts`
- `packages/bundles/src/__tests__/verify.test.ts`

## Steps (TDD)

1. Red: manifest validation tests
2. Red: sha256 verification tests
3. Green: implement verification and installer
4. Add a minimal sample bundle for development (tiny wasm command)

## Acceptance checks

- Browser installs bundles at runtime and caches in OPFS.
- Server loads bundles from a local cache directory.

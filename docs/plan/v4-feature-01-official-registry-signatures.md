# v4 Feature 01: Official Registry Signature Verification (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Enforce manifest signature verification for the official tool bundle registry (sha256 is not enough).

## Problem / Current State

- `@openagentic/bundles` verifies sha256 for each asset.
- `installBundle(..., { requireSignature: true })` currently throws for official registries.
- There is no canonical signing scheme documented/implemented.

## Design (recommended)

### Payload to sign

Sign the manifest **without** the `signature` field:

- `{ name, version, assets, commands }`
- Normalize before signing:
  - sort `assets` by `path`
  - sort `commands` by `name`

### Canonical JSON

Use deterministic canonical JSON bytes:

- UTF-8 encoding
- Object keys sorted lexicographically
- Arrays preserved (after normalization)
- No whitespace, no `undefined`

### Algorithm / keys

- Algorithm: Ed25519
- Official key set: built-in `keyId -> publicKey` mapping (bytes or JWK)
- Verification:
  - Official registries (`registry.isOfficial === true`) must verify against built-in keys by default.
  - Third-party registries may be supported with user-provided keys, but demos enforce official-only.

## Tasks

### Task 1: Canonical JSON + payload builder

**Files:**
- Create: `packages/bundles/src/canonical-json.ts`
- Modify: `packages/bundles/src/manifest.ts` (add `unsignedManifestPayload(manifest)` helper)
- Test: `packages/bundles/src/__tests__/canonical-json.test.ts`

**Red:** canonicalization test fails (module missing).  
**Green:** deterministic output for nested objects/arrays.

### Task 2: Signature verification (Ed25519)

**Files:**
- Create: `packages/bundles/src/signature.ts`
- Modify: `packages/bundles/src/installer.ts` (verify manifest signature before downloading assets)
- Modify: `packages/bundles/src/registry.ts` (official key set + key type)
- Test: `packages/bundles/src/__tests__/signature.test.ts`

**Red:** installing an official bundle with `requireSignature: true` fails without implementation.  
**Green:** valid signature passes; invalid signature fails.

### Task 3: Enforce in demos + docs

**Files:**
- Modify: `packages/demo-node/src/runtime.ts`
- Modify: `packages/demo-web/src/agent.ts`
- Modify: `docs/guide/tools/README.md`

Acceptance:
- Demos only install from official registry by default, requiring signatures.

**Commit:** `feat(bundles): verify official registry signatures`


# v3 Feature 05: Official Registry Signature Verification (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Status:** ABANDONED as of v13 (2026-01-28). The “official registry + signature enforced installs” direction is abandoned; v13 pivots to a pinned toolchain + finite `Bash` contract.
> **Goal:** Enforce signature verification for the official tool bundle registry (sha256 is not enough).

## Problem / Current State

- `@openagentic/bundles` verifies sha256 for each asset.
- Official-registry signature verification is explicitly unimplemented (`installBundle(..., { requireSignature: true })` throws).

sha256 verifies integrity *after* you know what you should be downloading; signatures provide authenticity for the manifest and prevent registry tampering.

## Deliverables

- A canonical manifest signing scheme for the official registry:
  - algorithm: Ed25519
  - canonicalization rules (stable JSON)
  - signature over a defined payload (e.g. canonical JSON bytes)
- A built-in official public key (or key set) in the SDK.
- `installBundle(..., { requireSignature: true })` verifies signatures when `registry.isOfficial === true`.
- Tests that verify:
  - valid signature passes,
  - invalid signature fails,
  - third-party registries are rejected in the default mode (official-only policy).

## Tasks

### Task 1: Define manifest canonicalization + signing payload

**Files (suggested):**
- Create: `packages/bundles/src/canonical-json.ts`
- Modify: `packages/bundles/src/manifest.ts` (define `unsignedPayload` shape)
- Test: `packages/bundles/src/__tests__/canonical-json.test.ts`

Acceptance:
- Canonicalization is deterministic across Node and browser.

### Task 2: Implement Ed25519 verification

**Files (suggested):**
- Create: `packages/bundles/src/signature.ts`
- Modify: `packages/bundles/src/installer.ts`
- Test: `packages/bundles/src/__tests__/signature-verify.test.ts`

Implementation notes:
- Prefer WebCrypto where available; fall back to a small audited library when needed.

### Task 3: Enforce “official only” in demos

**Files (suggested):**
- Modify: `packages/demo-node/src/runtime.ts`
- Modify: `packages/demo-web/src/agent.ts`
- Modify: `docs/guide/tools/README.md` (document official-only registry)

**Commit:** `feat(bundles): verify official registry signatures`

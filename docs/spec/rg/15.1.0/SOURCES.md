# ripgrep `rg` spec (15.1.0)

This folder pins the intended `rg` behavior for v12.

## Pinned version

- ripgrep 15.1.0

## Canonical references

- `rg(1)` manual page (ripgrep 15.1.0)
- `rg --help` output (documented as equivalent to the man page)
- `rg -h` output (condensed help)

## Update workflow (version bump)

When bumping ripgrep:

1. Update the pinned version in `docs/plan/v12-index.md`.
2. Refresh the golden snapshots:
   - `rg --version`
   - `rg --help`
   - `rg -h`
   - `rg --type-list`
3. Update/extend `rg` compat fixtures if behavior changes.


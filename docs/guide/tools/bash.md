# `Bash` (Restricted Shell)

`Bash` runs a **restricted shell** over the **shadow workspace**. It is intentionally *not* host bash: it cannot see your real filesystem, cannot spawn host processes, and only supports a small built-in command set.

## Supported syntax

- Pipelines: `|`
- Conditionals: `&&`, `||`
- Redirects: `<`, `>`, `>>`
- Env var expansion: `$NAME`
- Minimal globbing: `*` (expanded against the shadow workspace)

## Built-in commands (v2)

- `echo`
- `pwd`
- `cd`
- `ls`
- `cat`
- `grep` (regex over lines)

## Examples

- Create a file:
  - `echo hello > notes.txt`
- Read a file:
  - `cat notes.txt`
- Pipe + grep:
  - `cat notes.txt | grep hell`
- Combine steps:
  - `cd src && ls`

## Limitations

- No command substitution, no `;`, no subshells.
- Not all bash quoting/escaping rules are implemented.
- Command set is intentionally small in v2; v3+ can swap built-ins for WASI tool bundles.

## WASI backend (v3+)

The `Bash` tool can be configured to execute commands via WASI bundles (`Shell(script)` → `Command(argv)`), while keeping the same shadow-workspace isolation model. This is the path to “same semantics” across browser and server (e.g. via `wasmtime` on the server).

# `Bash`

`Bash` runs over the **shadow workspace** (not your host filesystem). The exact behavior depends on the environment:

- **Browser demo:** a restricted, deterministic TS-native shell + builtins.
- **Node/server demo:** host-native `bash -lc "<script>"` executed under a sandbox backend (when available).

## Supported syntax

- Pipelines: `|`
- Conditionals: `&&`, `||`
- Redirects: `<`, `>`, `>>`
- Env var expansion: `$NAME`
- Minimal globbing: `*` (expanded against the shadow workspace)

## Browser mode (restricted)

In the browser demo, `Bash` is intentionally finite. The intent is to stop “infinite Linux compatibility work” and instead document exactly what exists.

### Builtins

- `:` `true` `false`
- `cd` `pwd`
- `test` / `[`
- `export` `unset`
- `set` `shift`
- `command -v`
- `echo` `printf`
- `ls` `cat` `grep`

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
- Command set is intentionally small.

## Node/server mode (host-native)

In the Node demo, `Bash` uses host-native `bash` (full shell syntax). This is more powerful, but explicitly **not portable** to the browser.

# Tools (v2)

## Philosophy

Tools are argv-first and operate inside a constrained environment. In v2 demos we keep the tool surface intentionally small.

## Currently enabled in demos

- `ReadFile` — read a file from the shadow workspace
- `WriteFile` — write/overwrite a file in the shadow workspace
- `ListDir` — list a directory in the shadow workspace

## Shell tools

`Command` / `Shell` over WASI are implemented in the SDK, but an official tool bundle distribution story is tracked for later versions. The demos do not enable them by default.


# Python

`Python` runs Python code in a sandboxed runtime via WASI bundles (the same isolation model as `Command` / WASI-backed `Bash`).

## Input

```json
{
  "code": "print('hello')",
  "args": ["a", "b"],
  "stdin": ""
}
```

- `code` (required): passed as `python -c <code>`
- `args` (optional): appended after `-c`
- `stdin` (optional): provided to the process stdin

## Notes

- The demo bundles currently ship a **minimal placeholder** `lang-python` runtime to validate bundle/tool wiring. Swap it with a real MicroPython/CPython WASI runtime bundle for production use.


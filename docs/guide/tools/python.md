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

- The demo `lang-python` bundle ships a **minimal** WASI runtime intended for demos and tests.
  - Currently supported subset: `python -c "print(<int expr>)"` where `<int expr>` uses digits and `+ - * /` (no full CPython/MicroPython semantics).
  - Production use should swap this for a real MicroPython/CPython WASI runtime bundle with a clear packaging policy.

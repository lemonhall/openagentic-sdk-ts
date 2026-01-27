import { describe, expect, it } from "vitest";

import { buildWasmtimeCliArgs } from "../wasmtime-args.js";

describe("buildWasmtimeCliArgs", () => {
  it("uses `--` to separate WASI argv", () => {
    const args = buildWasmtimeCliArgs({
      wasmPath: "/tmp/module.wasm",
      argv: ["echo", "hello"],
    });
    expect(args).toEqual(["run", "/tmp/module.wasm", "--", "echo", "hello"]);
  });

  it("adds --env entries when provided", () => {
    const args = buildWasmtimeCliArgs({
      wasmPath: "/tmp/module.wasm",
      argv: ["echo"],
      env: { A: "1", B: "two" },
    });
    expect(args).toContain("--env");
    expect(args).toContain("A=1");
    expect(args).toContain("B=two");
  });

  it("adds --dir when provided", () => {
    const args = buildWasmtimeCliArgs({
      wasmPath: "/tmp/module.wasm",
      argv: ["echo"],
      preopenDir: "/sandbox",
    });
    expect(args).toContain("--dir");
    expect(args).toContain("/sandbox");
  });
});


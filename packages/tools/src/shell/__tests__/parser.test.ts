import { describe, expect, it } from "vitest";

import { parseScript, tokenize } from "../parser.js";

describe("shell parser (v10)", () => {
  it("tokenizes ';' as a separator (even without surrounding spaces)", () => {
    const toks = tokenize("echo a;echo b");
    expect(toks.some((t) => t.kind === "op" && t.value === ";")).toBe(true);
  });

  it("treats unquoted '#' as a comment and keeps newline as a separator", () => {
    const toks = tokenize("echo a # comment\n echo b");
    expect(toks.some((t) => t.kind === "word" && t.value === "#")).toBe(false);
    expect(toks.some((t) => t.kind === "op" && t.value === ";")).toBe(true);
  });

  it("splits scripts into multiple sequences on ';' and newline", () => {
    const ast = parseScript("echo a; echo b # comment\n echo c");
    expect(ast.sequences).toHaveLength(3);
    expect(ast.sequences[0]?.head.commands[0]?.argv.map((w) => w.value)).toEqual(["echo", "a"]);
    expect(ast.sequences[1]?.head.commands[0]?.argv.map((w) => w.value)).toEqual(["echo", "b"]);
    expect(ast.sequences[2]?.head.commands[0]?.argv.map((w) => w.value)).toEqual(["echo", "c"]);
  });

  it("supports backslash-escaping spaces in unquoted words", () => {
    const ast = parseScript("echo a\\ b");
    expect(ast.sequences[0]?.head.commands[0]?.argv.map((w) => w.value)).toEqual(["echo", "a b"]);
  });

  it("supports backslash-escaping quotes inside double quotes", () => {
    const ast = parseScript("echo \"a\\\"b\"");
    expect(ast.sequences[0]?.head.commands[0]?.argv.map((w) => w.value)).toEqual(["echo", "a\"b"]);
  });

  it("concatenates mixed quoted/unquoted segments into one word", () => {
    const ast = parseScript("echo foo\"bar\"baz");
    expect(ast.sequences[0]?.head.commands[0]?.argv.map((w) => w.value)).toEqual(["echo", "foobarbaz"]);
  });

  it("preserves empty double-quoted words", () => {
    const ast = parseScript("echo \"\"");
    expect(ast.sequences[0]?.head.commands[0]?.argv.map((w) => w.value)).toEqual(["echo", ""]);
  });

  it("parses assignment prefixes (FOO=bar cmd ...) as assigns", () => {
    const ast = parseScript("FOO=bar echo hi");
    const cmd = ast.sequences[0]?.head.commands[0]!;
    expect(cmd.assigns?.map((w) => w.value)).toEqual(["FOO=bar"]);
    expect(cmd.argv.map((w) => w.value)).toEqual(["echo", "hi"]);
  });

  it("allows standalone assignments (FOO=bar) as a simple command", () => {
    const ast = parseScript("FOO=bar");
    const cmd = ast.sequences[0]?.head.commands[0]!;
    expect(cmd.assigns?.map((w) => w.value)).toEqual(["FOO=bar"]);
    expect(cmd.argv).toHaveLength(0);
  });

  it("allows assignment prefixes before subshell groups (FOO=bar (...))", () => {
    const ast = parseScript("FOO=bar (echo hi)");
    const cmd = ast.sequences[0]?.head.commands[0]!;
    expect(cmd.assigns?.map((w) => w.value)).toEqual(["FOO=bar"]);
    expect(cmd.subshell?.sequences[0]?.head.commands[0]?.argv.map((w) => w.value)).toEqual(["echo", "hi"]);
  });
});

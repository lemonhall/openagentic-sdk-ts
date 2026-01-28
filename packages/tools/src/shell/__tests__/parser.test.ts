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
});

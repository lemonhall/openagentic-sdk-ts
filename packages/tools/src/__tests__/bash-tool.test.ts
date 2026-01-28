import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "@openagentic/workspace";

import { BashTool } from "../bash/bash.js";

describe("BashTool (workspace-native)", () => {
  it("supports pipes + grep over workspace files", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("a.txt", new TextEncoder().encode("one\ntwo\nthree\n"));

    const bash = new BashTool();
    const out = (await bash.run(
      { command: "cat a.txt | grep tw" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("two\n");
    expect(out.stderr).toBe("");
  });

  it("supports redirects to files", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run(
      { command: "echo hi > out.txt" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("");
    expect(new TextDecoder().decode(await ws.readFile("out.txt"))).toBe("hi\n");
  });

  it("supports cd + ls with &&", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("src/a.txt", new TextEncoder().encode("x"));

    const bash = new BashTool();
    const out = (await bash.run(
      { command: "cd src && ls" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout.trim().split(/\\s+/).sort()).toEqual(["a.txt"]);
  });

  it("supports ';' sequencing and '#' comments", async () => {
    const ws = new MemoryWorkspace();

    const bash = new BashTool();
    const out = (await bash.run(
      { command: "echo a; echo b # comment\n echo c" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("a\nb\nc\n");
    expect(out.stderr).toBe("");
  });

  it("supports backslash escapes (unquoted and double-quoted)", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out1 = (await bash.run(
      { command: "echo a\\ b" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;
    expect(out1.exit_code).toBe(0);
    expect(out1.stdout).toBe("a b\n");

    const out2 = (await bash.run(
      { command: "echo \"a\\\"b\"" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;
    expect(out2.exit_code).toBe(0);
    expect(out2.stdout).toBe("a\"b\n");
  });

  it("supports word concatenation across quotes and preserves empty args", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out1 = (await bash.run(
      { command: "echo foo\"bar\"baz" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;
    expect(out1.exit_code).toBe(0);
    expect(out1.stdout).toBe("foobarbaz\n");

    const out2 = (await bash.run(
      { command: "echo \"\"" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;
    expect(out2.exit_code).toBe(0);
    expect(out2.stdout).toBe("\n");
  });

  it("supports subshell grouping with () and does not leak cwd", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("src/a/x.txt", new TextEncoder().encode("x"));
    const bash = new BashTool();

    const out = (await bash.run(
      { command: "pwd; (cd a; pwd); pwd", cwd: "src" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("src\nsrc/a\nsrc\n");
  });

  it("supports subshells inside pipelines", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run(
      { command: "echo hi | (grep hi)" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("hi\n");
  });

  it("supports stderr redirect '2>'", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run(
      { command: "grep 2>err.txt || true; cat err.txt" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stderr).toBe("");
    expect(out.stdout).toBe("grep: pattern required");
  });

  it("supports stderr-to-stdout redirect '2>&1' for piping", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run(
      { command: "grep 2>&1 | cat" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stderr).toBe("");
    expect(out.stdout).toBe("grep: pattern required");
  });

  it("prints '.' for pwd at workspace root", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run({ command: "pwd" }, { sessionId: "s", toolUseId: "t", workspace: ws } as any)) as any;
    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe(".\n");
  });

  it("supports head in pipelines", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run(
      { command: 'printf "a\\nb\\nc\\n" | head -n 2' },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("a\nb\n");
  });

  it("supports minimal find with -maxdepth and -type", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("a.txt", new TextEncoder().encode("a"));
    await ws.writeFile("b/c.txt", new TextEncoder().encode("c"));
    await ws.writeFile("b/d/e.txt", new TextEncoder().encode("e"));
    const bash = new BashTool();

    const out = (await bash.run(
      { command: "find . -maxdepth 2 -type f" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("a.txt\nb/c.txt\n");
  });

  it("applies redirections in order for '>file 2>&1'", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run(
      { command: "grep >out.txt 2>&1 || true; cat out.txt" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stderr).toBe("");
    expect(out.stdout).toBe("grep: pattern required");
  });

  it("supports stdout-to-stderr redirect '1>&2'", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run(
      { command: "echo hi 1>&2" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("");
    expect(out.stderr).toBe("hi\n");
  });

  it("supports printf builtin", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run(
      { command: "printf \"%s %s\\n\" a b" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stderr).toBe("");
    expect(out.stdout).toBe("a b\n");
  });

  it("supports test and [ builtins", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("a.txt", new TextEncoder().encode("x"));
    await ws.writeFile("dir/x.txt", new TextEncoder().encode("y"));

    const bash = new BashTool();
    const out = (await bash.run(
      { command: "test -n hi && echo ok; test -z \"\" && echo ok; test -f a.txt && echo ok; [ -d dir ] && echo ok; [ -n \"\" ] || echo ok" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stderr).toBe("");
    expect(out.stdout).toBe("ok\nok\nok\nok\nok\n");
  });

  it("supports export and unset builtins", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run(
      { command: "export FOO=bar; echo $FOO; unset FOO; echo $FOO" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stderr).toBe("");
    expect(out.stdout).toBe("bar\n\n");
  });

  it("supports assignment prefixes (FOO=bar cmd) and standalone assignments (FOO=bar)", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run(
      { command: "FOO=bar echo $FOO; FOO=bar; echo $FOO; BAR=baz; FOO=$BAR; echo $FOO" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stderr).toBe("");
    // Prefix assignment should not affect expansion of later argv words in the same simple command.
    expect(out.stdout).toBe("\nbar\nbaz\n");
  });
});

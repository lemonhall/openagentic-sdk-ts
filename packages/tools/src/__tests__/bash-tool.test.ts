import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { BundleCache, InstalledBundle } from "@openagentic/bundles";
import { parseBundleManifest } from "@openagentic/bundles";
import { MemoryWorkspace } from "@openagentic/workspace";
import { InProcessWasiRunner } from "@openagentic/wasi-runner-web";

import { BashTool } from "../bash/bash.js";
import { CommandTool } from "../command.js";

function sampleBundleRoot(): string {
  return join(process.cwd(), "..", "bundles", "sample");
}

function fileCache(rootDir: string): BundleCache {
  return {
    async read(path) {
      try {
        const full = join(rootDir, path);
        return new Uint8Array(await readFile(full));
      } catch {
        return null;
      }
    },
    async write() {
      throw new Error("not used in this test");
    },
  };
}

async function loadCoreUtilsBundle(root: string): Promise<InstalledBundle> {
  const manifestRaw = JSON.parse(
    await readFile(join(root, "bundles", "core-utils", "0.0.0", "manifest.json"), "utf8"),
  ) as unknown;
  const manifest = parseBundleManifest(manifestRaw);
  return { manifest, rootPath: "bundles/core-utils/0.0.0" };
}

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
});

describe("BashTool (WASI backend)", () => {
  it("supports pipes via core-utils bundle", async () => {
    const root = sampleBundleRoot();
    const bundle = await loadCoreUtilsBundle(root);
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [bundle], cache: fileCache(root) });

    const ws = new MemoryWorkspace();
    const bash = new BashTool({ wasiCommand: command } as any);
    const out = (await bash.run(
      { command: "echo hi | grep hi" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("hi\n");
  });

  it("does not error when an unquoted variable expands to empty", async () => {
    const root = sampleBundleRoot();
    const bundle = await loadCoreUtilsBundle(root);
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [bundle], cache: fileCache(root) });

    const ws = new MemoryWorkspace();
    const bash = new BashTool({ wasiCommand: command } as any);
    const out = (await bash.run(
      { command: "echo $SHELL" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stderr).toBe("");
  });

  it("supports command -v for builtin and bundle commands", async () => {
    const root = sampleBundleRoot();
    const bundle = await loadCoreUtilsBundle(root);
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [bundle], cache: fileCache(root) });

    const ws = new MemoryWorkspace();
    const bash = new BashTool({ wasiCommand: command } as any);
    const out = (await bash.run(
      { command: "command -v echo command date" },
      { sessionId: "s", toolUseId: "t", workspace: ws, env: { SOURCE_DATE_EPOCH: "0" } } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout.split("\n").filter(Boolean)).toEqual(["echo", "command", "date"]);
  });

  it("supports date (deterministic via SOURCE_DATE_EPOCH)", async () => {
    const root = sampleBundleRoot();
    const bundle = await loadCoreUtilsBundle(root);
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [bundle], cache: fileCache(root) });

    const ws = new MemoryWorkspace();
    const bash = new BashTool({ wasiCommand: command } as any);
    const out = (await bash.run(
      { command: "date", env: { SOURCE_DATE_EPOCH: "0" } },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("1970-01-01T00:00:00.000Z\n");
  });

  it("supports rg -n for recursive workspace search", async () => {
    const root = sampleBundleRoot();
    const bundle = await loadCoreUtilsBundle(root);
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [bundle], cache: fileCache(root) });

    const ws = new MemoryWorkspace();
    await ws.writeFile("a.txt", new TextEncoder().encode("hello\nworld\n"));
    await ws.writeFile("sub/b.txt", new TextEncoder().encode("hello again\n"));

    const bash = new BashTool({ wasiCommand: command } as any);
    const out = (await bash.run(
      { command: "rg -n hello ." },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toContain("a.txt:1:hello");
    expect(out.stdout).toContain("sub/b.txt:1:hello again");
  });
});

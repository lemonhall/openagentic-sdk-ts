import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "@openagentic/workspace";

import { execSequence } from "../exec.js";
import { parseScript } from "../parser.js";

describe("shell expansion (v10)", () => {
  it("expands $? to the previous command's exit code across ';' sequencing", async () => {
    const ws = new MemoryWorkspace();
    const ast = parseScript("false; echo $?");

    const res = await execSequence(ast, { env: {}, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv) => {
        const cmd = argv[0] ?? "";
        const args = argv.slice(1);
        if (cmd === "false") return { exitCode: 1, stdout: "", stderr: "" };
        if (cmd === "echo") return { exitCode: 0, stdout: `${args.join(" ")}\n`, stderr: "" };
        throw new Error(`unknown command: ${cmd}`);
      },
    });

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe("1\n");
  });

  it("expands $? correctly after short-circuiting '&&' and '||'", async () => {
    const ws = new MemoryWorkspace();
    const ast = parseScript("false && echo skipped; echo $?; true || echo skipped; echo $?");

    const res = await execSequence(ast, { env: {}, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv) => {
        const cmd = argv[0] ?? "";
        const args = argv.slice(1);
        if (cmd === "false") return { exitCode: 1, stdout: "", stderr: "" };
        if (cmd === "true") return { exitCode: 0, stdout: "", stderr: "" };
        if (cmd === "echo") return { exitCode: 0, stdout: `${args.join(" ")}\n`, stderr: "" };
        throw new Error(`unknown command: ${cmd}`);
      },
    });

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe("1\n0\n");
  });

  it("drops empty unquoted expansions but preserves empty quoted expansions", async () => {
    const ws = new MemoryWorkspace();
    const ast = parseScript("argc $NOPE; argc \"$NOPE\"");

    const res = await execSequence(ast, { env: {}, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv) => {
        const cmd = argv[0] ?? "";
        if (cmd === "argc") {
          return { exitCode: 0, stdout: `${Math.max(0, argv.length - 1)}\n`, stderr: "" };
        }
        throw new Error(`unknown command: ${cmd}`);
      },
    });

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe("0\n1\n");
  });

  it("supports ${var} and ${var:-default}", async () => {
    const ws = new MemoryWorkspace();

    const ast1 = parseScript("echo ${X:-fallback}");
    const res1 = await execSequence(ast1, { env: {}, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv) => {
        const cmd = argv[0] ?? "";
        const args = argv.slice(1);
        if (cmd === "echo") return { exitCode: 0, stdout: `${args.join(" ")}\n`, stderr: "" };
        throw new Error(`unknown command: ${cmd}`);
      },
    });
    expect(res1.stdout).toBe("fallback\n");

    const ast2 = parseScript("echo ${X} ${X:-fallback}");
    const res2 = await execSequence(ast2, { env: { X: "hi" }, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv) => {
        const cmd = argv[0] ?? "";
        const args = argv.slice(1);
        if (cmd === "echo") return { exitCode: 0, stdout: `${args.join(" ")}\n`, stderr: "" };
        throw new Error(`unknown command: ${cmd}`);
      },
    });
    expect(res2.stdout).toBe("hi hi\n");

    const ast3 = parseScript("echo ${X:-fallback}");
    const res3 = await execSequence(ast3, { env: { X: "" }, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv) => {
        const cmd = argv[0] ?? "";
        const args = argv.slice(1);
        if (cmd === "echo") return { exitCode: 0, stdout: `${args.join(" ")}\n`, stderr: "" };
        throw new Error(`unknown command: ${cmd}`);
      },
    });
    expect(res3.stdout).toBe("fallback\n");
  });

  it("supports $(...) command substitution (captures stdout and trims trailing newline)", async () => {
    const ws = new MemoryWorkspace();
    const ast = parseScript("echo $(echo hi); echo x$(echo hi)y");

    const res = await execSequence(ast, { env: {}, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv) => {
        const cmd = argv[0] ?? "";
        const args = argv.slice(1);
        if (cmd === "echo") return { exitCode: 0, stdout: `${args.join(" ")}\n`, stderr: "" };
        throw new Error(`unknown command: ${cmd}`);
      },
    });

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe("hi\nxhiy\n");
  });
});

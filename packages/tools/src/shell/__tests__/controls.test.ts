import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "@openagentic/workspace";

import { execSequence } from "../exec.js";
import { parseScript } from "../parser.js";

describe("shell execution controls (v11)", () => {
  it("supports exit [code] and stops the script", async () => {
    const ws = new MemoryWorkspace();
    const ast = parseScript("exit 7; echo after");

    const res = await execSequence(ast, { env: {}, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv) => {
        throw new Error(`unknown command: ${argv[0] ?? ""}`);
      },
    });

    expect(res.exitCode).toBe(7);
    expect(res.stdout).toBe("");
    expect(res.stderr).toBe("");
  });

  it("supports set -e (errexit) and stops on a failing simple command", async () => {
    const ws = new MemoryWorkspace();
    const ast = parseScript("set -e; false; echo after");

    const res = await execSequence(ast, { env: {}, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv, io0) => {
        const io = io0 as any;
        const cmd = argv[0] ?? "";
        const args = argv.slice(1);
        if (cmd === "set") {
          if (args.includes("-e")) {
            io.options = io.options ?? { errexit: false, nounset: false };
            io.options.errexit = true;
          }
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        if (cmd === "false") return { exitCode: 1, stdout: "", stderr: "" };
        if (cmd === "echo") return { exitCode: 0, stdout: `${args.join(" ")}\n`, stderr: "" };
        throw new Error(`unknown command: ${cmd}`);
      },
    });

    expect(res.exitCode).toBe(1);
    expect(res.stdout).toBe("");
    expect(res.stderr).toBe("");
  });

  it("supports set -u (nounset) and errors on unbound $var", async () => {
    const ws = new MemoryWorkspace();
    const ast = parseScript("set -u; echo $NOPE; echo after");

    const res = await execSequence(ast, { env: {}, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv, io0) => {
        const io = io0 as any;
        const cmd = argv[0] ?? "";
        const args = argv.slice(1);
        if (cmd === "set") {
          if (args.includes("-u")) {
            io.options = io.options ?? { errexit: false, nounset: false };
            io.options.nounset = true;
          }
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        if (cmd === "echo") return { exitCode: 0, stdout: `${args.join(" ")}\n`, stderr: "" };
        throw new Error(`unknown command: ${cmd}`);
      },
    });

    expect(res.exitCode).toBe(1);
    expect(res.stdout).toBe("");
    expect(res.stderr).toBe("Shell: NOPE: unbound variable\n");
  });
});

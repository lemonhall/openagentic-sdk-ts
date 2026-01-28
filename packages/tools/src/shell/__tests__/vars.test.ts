import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "@openagentic/workspace";

import { execSequence } from "../exec.js";
import { parseScript } from "../parser.js";

describe("shell vars vs env (v11)", () => {
  it("does not export shell assignments to subprocesses unless exported", async () => {
    const ws = new MemoryWorkspace();
    const ast = parseScript("FOO=bar; showenv; export FOO; showenv");

    const res = await execSequence(ast, { env: {}, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv, io0) => {
        const io = io0 as any;
        const cmd = argv[0] ?? "";
        if (cmd === "showenv") return { exitCode: 0, stdout: `${io.env.FOO ?? ""}\n`, stderr: "" };
        if (cmd === "export") {
          const name = argv[1] ?? "";
          io.env[name] = io.vars?.[name] ?? "";
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        throw new Error(`unknown command: ${cmd}`);
      },
    });

    expect(res.stdout).toBe("\nbar\n");
  });

  it("prefix assignments apply to subprocess env but do not persist", async () => {
    const ws = new MemoryWorkspace();
    const ast = parseScript("FOO=bar showenv; showenv");

    const res = await execSequence(ast, { env: {}, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv, io) => {
        const cmd = argv[0] ?? "";
        if (cmd === "showenv") return { exitCode: 0, stdout: `${io.env.FOO ?? ""}\n`, stderr: "" };
        throw new Error(`unknown command: ${cmd}`);
      },
    });

    expect(res.stdout).toBe("bar\n\n");
  });
});

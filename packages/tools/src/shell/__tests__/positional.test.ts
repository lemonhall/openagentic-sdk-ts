import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "@openagentic/workspace";

import { execSequence } from "../exec.js";
import { parseScript } from "../parser.js";

describe("shell positional params (v11)", () => {
  it("supports $1..$N and $# via set -- and shift", async () => {
    const ws = new MemoryWorkspace();
    const ast = parseScript("set -- a b; echo $1 $2 $#; shift; echo $1 $#");

    const res = await execSequence(ast, { env: {}, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv, io0) => {
        const io = io0 as any;
        const cmd = argv[0] ?? "";
        const args = argv.slice(1);
        if (cmd === "set") {
          if (args[0] !== "--") return { exitCode: 2, stdout: "", stderr: "set: only '--' supported" };
          io.positional = [...args.slice(1)];
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        if (cmd === "shift") {
          io.positional = (io.positional ?? []).slice(1);
          return { exitCode: 0, stdout: "", stderr: "" };
        }
        if (cmd === "echo") return { exitCode: 0, stdout: `${args.join(" ")}\n`, stderr: "" };
        throw new Error(`unknown command: ${cmd}`);
      },
    });

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe("a b 2\nb 1\n");
  });
});


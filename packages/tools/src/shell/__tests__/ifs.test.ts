import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "@openagentic/workspace";

import { execSequence } from "../exec.js";
import { parseScript } from "../parser.js";

describe("shell field splitting (v11)", () => {
  it("splits unquoted expansions on IFS whitespace but preserves quoted expansions", async () => {
    const ws = new MemoryWorkspace();
    const ast = parseScript('X="a b"; argc $X; argc "$X"');

    const res = await execSequence(ast, { env: {}, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv) => {
        const cmd = argv[0] ?? "";
        if (cmd === "argc") return { exitCode: 0, stdout: `${Math.max(0, argv.length - 1)}\n`, stderr: "" };
        throw new Error(`unknown command: ${cmd}`);
      },
    });

    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe("2\n1\n");
  });
});


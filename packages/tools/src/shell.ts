import type { Tool, ToolContext } from "@openagentic/sdk-core";
import type { Workspace } from "@openagentic/workspace";

import type { CommandTool } from "./command.js";
import { execSequence } from "./shell/exec.js";
import { parse } from "./shell/parser.js";

export type ShellToolOptions = {
  command: CommandTool;
};

export class ShellTool implements Tool {
  readonly name = "Shell";
  readonly description = "Run a restricted shell script compiled to Command(argv) calls.";

  readonly #command: CommandTool;

  constructor(options: ShellToolOptions) {
    this.#command = options.command;
  }

  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const script = input.script;
    if (typeof script !== "string" || !script.trim()) throw new Error("Shell: 'script' must be a non-empty string");

    const workspace = (ctx as any).workspace as Workspace | undefined;
    if (!workspace) throw new Error("Shell: workspace is required in ToolContext");

    const env = typeof input.env === "object" && input.env ? (input.env as Record<string, string>) : {};
    const cwd = typeof input.cwd === "string" ? input.cwd : "";

    const ast = parse(script);
    const res = await execSequence(ast, { env, cwd }, { command: this.#command, workspace });
    return res;
  }
}


import type { Tool, ToolContext } from "@openagentic/sdk-core";

export type PythonToolOptions = {
  command: Tool;
};

export class PythonTool implements Tool {
  readonly name = "Python";
  readonly description = "Run Python code in a sandboxed runtime (WASI).";
  readonly inputSchema = {
    type: "object",
    properties: {
      code: { type: "string", description: "Python source to execute (passed as `python -c`)." },
      args: { type: "array", items: { type: "string" }, description: "Optional argv passed after `-c`." },
      stdin: { type: "string", description: "Optional stdin." },
    },
    required: ["code"],
  };

  readonly #command: Tool;

  constructor(options: PythonToolOptions) {
    this.#command = options.command;
  }

  async run(input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const codeRaw = input.code;
    const code = typeof codeRaw === "string" ? codeRaw : "";
    if (!code) throw new Error("Python: 'code' must be a non-empty string");

    const argsIn = input.args;
    const args =
      Array.isArray(argsIn) && argsIn.every((x) => typeof x === "string") ? (argsIn as string[]) : [];

    const stdin = typeof input.stdin === "string" ? input.stdin : undefined;

    return this.#command.run(
      {
        argv: ["python", "-c", code, ...args],
        ...(stdin != null ? { stdin } : {}),
      },
      ctx,
    );
  }
}


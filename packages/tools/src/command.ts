import type { BundleCache, InstalledBundle } from "@openagentic/bundles";
import type { Tool, ToolContext } from "@openagentic/sdk-core";
import type { WasiRunner } from "@openagentic/wasi-runner";

export type CommandToolOptions = {
  runner: WasiRunner;
  bundles: InstalledBundle[];
  cache: BundleCache;
};

export type CommandToolInput = {
  argv: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  limits?: { maxStdoutBytes?: number; maxStderrBytes?: number };
};

export type CommandToolOutput = {
  exitCode: number;
  stdout: string;
  stderr: string;
  truncatedStdout: boolean;
  truncatedStderr: boolean;
};

export class CommandTool implements Tool {
  readonly name = "Command";
  readonly description = "Run a sandboxed command (WASI).";

  readonly #runner: WasiRunner;
  readonly #bundles: InstalledBundle[];
  readonly #cache: BundleCache;

  constructor(options: CommandToolOptions) {
    this.#runner = options.runner;
    this.#bundles = options.bundles;
    this.#cache = options.cache;
  }

  async run(input: Record<string, unknown>, _ctx: ToolContext): Promise<unknown> {
    const argv = input.argv;
    if (!Array.isArray(argv) || argv.length === 0 || !argv.every((x) => typeof x === "string" && x.length > 0)) {
      throw new Error("Command: 'argv' must be a non-empty string[]");
    }

    const commandName = argv[0];
    const bundles = this.#bundles;
    for (const b of bundles) {
      const cmd = b.manifest.commands.find((c) => c.name === commandName);
      if (!cmd) continue;

      const moduleKey = `${b.rootPath}/${cmd.modulePath}`;
      const bytes = await this.#cache.read(moduleKey);
      if (!bytes) throw new Error(`Command: module not found in cache: ${moduleKey}`);

      const res = await this.#runner.execModule({
        module: { kind: "bytes", bytes },
        argv,
        env: typeof input.env === "object" && input.env ? (input.env as Record<string, string>) : undefined,
        cwd: typeof input.cwd === "string" ? input.cwd : undefined,
        stdin: typeof input.stdin === "string" ? new TextEncoder().encode(input.stdin) : undefined,
        limits:
          typeof input.limits === "object" && input.limits
            ? {
                maxStdoutBytes: typeof (input.limits as any).maxStdoutBytes === "number" ? (input.limits as any).maxStdoutBytes : undefined,
                maxStderrBytes: typeof (input.limits as any).maxStderrBytes === "number" ? (input.limits as any).maxStderrBytes : undefined,
              }
            : undefined,
      });

      return {
        exitCode: res.exitCode,
        stdout: new TextDecoder().decode(res.stdout),
        stderr: new TextDecoder().decode(res.stderr),
        truncatedStdout: res.truncatedStdout,
        truncatedStderr: res.truncatedStderr,
      } satisfies CommandToolOutput;
    }

    throw new Error(`Command: unknown command '${commandName}'`);
  }
}

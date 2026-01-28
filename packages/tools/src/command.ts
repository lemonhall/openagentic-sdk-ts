import type { BundleCache, InstalledBundle } from "@openagentic/bundles";
import type { Tool, ToolContext } from "@openagentic/sdk-core";
import type { WasiRunner } from "@openagentic/wasi-runner";
import type { Workspace } from "@openagentic/workspace";

async function snapshotWorkspaceFiles(workspace: Workspace): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};

  async function walk(dir: string): Promise<void> {
    const entries = await workspace.listDir(dir);
    for (const ent of entries) {
      const full = dir ? `${dir}/${ent.name}` : ent.name;
      if (ent.type === "dir") {
        await walk(full);
        continue;
      }
      files[full] = await workspace.readFile(full);
    }
  }

  await walk("");
  return files;
}

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

  hasCommand(name: string): boolean {
    for (const b of this.#bundles) {
      if (b.manifest.commands.some((c) => c.name === name)) return true;
    }
    return false;
  }

  async run(input: Record<string, unknown>, _ctx: ToolContext): Promise<unknown> {
    const workspace = (_ctx as any).workspace as Workspace | undefined;
    if (!workspace) throw new Error("Command: workspace is required in ToolContext");

    const preopenDir = (_ctx as any)?.wasi?.preopenDir;
    const mountDir = typeof preopenDir === "string" && preopenDir.trim() ? preopenDir : null;
    const netFetch = (_ctx as any)?.netFetch;
    const emitEvent = (_ctx as any)?.emitEvent as ((ev: any) => Promise<void>) | undefined;

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

      const beforeFs = mountDir ? null : { files: await snapshotWorkspaceFiles(workspace) };

      const res = await this.#runner.execModule({
        module: { kind: "bytes", bytes },
        argv,
        env: typeof input.env === "object" && input.env ? (input.env as Record<string, string>) : undefined,
        cwd: typeof input.cwd === "string" ? input.cwd : undefined,
        stdin: typeof input.stdin === "string" ? new TextEncoder().encode(input.stdin) : undefined,
        netFetch: netFetch ?? undefined,
        fs: beforeFs ?? undefined,
        preopenDir: mountDir ?? undefined,
        limits:
          typeof input.limits === "object" && input.limits
            ? {
                maxStdoutBytes: typeof (input.limits as any).maxStdoutBytes === "number" ? (input.limits as any).maxStdoutBytes : undefined,
                maxStderrBytes: typeof (input.limits as any).maxStderrBytes === "number" ? (input.limits as any).maxStderrBytes : undefined,
              }
            : undefined,
      });

      if (!mountDir) {
        const after = res.fs?.files ?? beforeFs!.files;
        const beforePaths = new Set(Object.keys(beforeFs!.files));
        const afterPaths = new Set(Object.keys(after));
        for (const p of beforePaths) {
          if (!afterPaths.has(p)) await workspace.deleteFile(p);
        }
        for (const p of afterPaths) {
          await workspace.writeFile(p, after[p]!);
        }
      }

      if (emitEvent && Array.isArray((res as any).netFetchAudits)) {
        for (const a of (res as any).netFetchAudits as any[]) {
          await emitEvent({
            type: "net.fetch",
            toolUseId: (_ctx as any).toolUseId,
            url: String(a.url ?? ""),
            status: Number(a.status ?? 0),
            bytes: Number(a.bytes ?? 0),
            truncated: Boolean(a.truncated ?? false),
            durationMs: Number(a.durationMs ?? 0),
            ts: Date.now(),
          });
        }
      }

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

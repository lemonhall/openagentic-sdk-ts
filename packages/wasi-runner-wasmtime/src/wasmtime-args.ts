export type BuildWasmtimeCliArgsOptions = {
  wasmPath: string;
  argv: string[];
  env?: Record<string, string>;
  preopenDir?: string;
};

export function buildWasmtimeCliArgs(options: BuildWasmtimeCliArgsOptions): string[] {
  const args: string[] = ["run"];

  if (options.preopenDir) {
    args.push("--dir", options.preopenDir);
  }

  if (options.env) {
    for (const key of Object.keys(options.env).sort()) {
      args.push("--env", `${key}=${options.env[key] ?? ""}`);
    }
  }

  args.push(options.wasmPath, "--", ...options.argv);
  return args;
}


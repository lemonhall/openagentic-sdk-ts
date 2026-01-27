import type { SandboxAuditRecord } from "@openagentic/wasi-runner";

export type ProcessSandboxMount = {
  kind: "dir";
  label?: string;
  hostPath: string;
  guestPath: string;
  mode: "rw" | "ro";
};

export type ProcessSandboxCommand = {
  cmd: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
  mounts?: ProcessSandboxMount[];
};

export type ProcessSandboxWrappedCommand = {
  cmd: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
};

export interface ProcessSandbox {
  name: string;
  wrap(command: ProcessSandboxCommand): ProcessSandboxWrappedCommand;
}

function redactArgs(args: string[], secrets: string[]): string[] {
  if (secrets.length === 0) return args;
  return args.map((a) => (secrets.includes(a) ? "<redacted>" : a));
}

export function applyProcessSandbox(options: {
  sandbox?: ProcessSandbox;
  command: ProcessSandboxCommand;
  redactHostPaths?: string[];
}): { spawn: ProcessSandboxCommand; audit?: SandboxAuditRecord } {
  if (!options.sandbox) return { spawn: options.command };

  const wrapped = options.sandbox.wrap(options.command);

  const spawn: ProcessSandboxCommand = {
    cmd: wrapped.cmd,
    args: wrapped.args,
    env: wrapped.env ?? options.command.env,
    cwd: wrapped.cwd ?? options.command.cwd,
    mounts: options.command.mounts,
  };

  const redactHostPaths = options.redactHostPaths ?? [];
  const audit: SandboxAuditRecord = {
    kind: "process-sandbox",
    wrapperName: options.sandbox.name,
    wrappedCmd: spawn.cmd,
    wrappedArgs: redactArgs(spawn.args, redactHostPaths),
    mounts: (options.command.mounts ?? []).map((m) => ({ label: m.label, guestPath: m.guestPath, mode: m.mode })),
  };

  return { spawn, audit };
}


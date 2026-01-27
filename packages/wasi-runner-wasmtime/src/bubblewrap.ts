import type { ProcessSandbox, ProcessSandboxCommand, ProcessSandboxMount } from "./process-sandbox.js";

export type BubblewrapNetworkMode = "allow" | "deny";

export type BubblewrapProcessSandboxOptions = {
  bwrapPath?: string;
  network?: BubblewrapNetworkMode;
  roBinds?: string[];
  procPath?: string;
  devPath?: string;
  tmpPath?: string;
  /**
   * When mounts include a `shadow-workspace` label, the wrapper will `--chdir`
   * to this guest path by default.
   */
  defaultCwdLabel?: string;
};

function defaultOptions(): Required<
  Pick<
    BubblewrapProcessSandboxOptions,
    "bwrapPath" | "network" | "roBinds" | "procPath" | "devPath" | "tmpPath" | "defaultCwdLabel"
  >
> {
  return {
    bwrapPath: "bwrap",
    network: "allow",
    roBinds: ["/usr", "/bin", "/lib", "/lib64", "/etc"],
    procPath: "/proc",
    devPath: "/dev",
    tmpPath: "/tmp",
    defaultCwdLabel: "shadow-workspace",
  };
}

function rewriteArgPaths(args: string[], mounts: ProcessSandboxMount[]): string[] {
  if (mounts.length === 0) return args;

  const candidates = [...mounts].sort((a, b) => b.hostPath.length - a.hostPath.length);
  return args.map((a) => {
    for (const m of candidates) {
      if (a === m.hostPath) return m.guestPath;
      const prefix = m.hostPath.endsWith("/") ? m.hostPath : `${m.hostPath}/`;
      if (a.startsWith(prefix)) return `${m.guestPath}/${a.slice(prefix.length)}`;
    }
    return a;
  });
}

export function createBubblewrapProcessSandbox(opts: BubblewrapProcessSandboxOptions = {}): ProcessSandbox {
  const options = { ...defaultOptions(), ...opts };

  return {
    name: "bubblewrap",
    wrap(command: ProcessSandboxCommand) {
      const mounts = command.mounts ?? [];

      const bwrapArgs: string[] = [
        "--die-with-parent",
        "--new-session",
        ...(options.network === "deny" ? ["--unshare-net"] : []),
        "--proc",
        options.procPath,
        "--dev",
        options.devPath,
        "--tmpfs",
        options.tmpPath,
      ];

      for (const p of options.roBinds) {
        bwrapArgs.push("--ro-bind", p, p);
      }

      for (const m of mounts) {
        bwrapArgs.push(m.mode === "ro" ? "--ro-bind" : "--bind", m.hostPath, m.guestPath);
      }

      const cwdMount = mounts.find((m) => m.label === options.defaultCwdLabel);
      if (cwdMount) {
        bwrapArgs.push("--chdir", cwdMount.guestPath);
      }

      const innerArgs = rewriteArgPaths(command.args, mounts);

      return {
        cmd: options.bwrapPath,
        args: [...bwrapArgs, command.cmd, ...innerArgs],
        env: command.env,
        cwd: command.cwd,
      };
    },
  };
}


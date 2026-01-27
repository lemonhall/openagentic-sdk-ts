export type SandboxNetworkMode = "allow" | "deny";

export type SandboxBackendName =
  | "none"
  | "bwrap"
  | "nsjail"
  | "sandbox-exec"
  | "jobobject"
  | "systemd-run";

export type SandboxBackendConfig =
  | { backend: "none"; options: {} }
  | {
      backend: "bwrap";
      options: {
        bwrapPath: string;
        network: SandboxNetworkMode;
        roBinds: string[];
      };
    }
  | {
      backend: "nsjail";
      options: {
        nsjailPath: string;
        network: SandboxNetworkMode;
        roBinds: string[];
      };
    }
  | {
      backend: "sandbox-exec";
      options: {
        sandboxExecPath: string;
        network: SandboxNetworkMode;
      };
    }
  | {
      backend: "jobobject";
      options: {
        timeoutMs: number;
      };
    }
  | {
      backend: "systemd-run";
      options: {
        systemdRunPath: string;
        network: SandboxNetworkMode;
        roBinds: string[];
      };
    };

export type ParseSandboxConfigInput = {
  backend?: string;
  options?: Record<string, unknown>;
};

const BACKENDS: SandboxBackendName[] = ["none", "bwrap", "nsjail", "sandbox-exec", "jobobject", "systemd-run"];

function asNetworkMode(value: unknown, fallback: SandboxNetworkMode): SandboxNetworkMode {
  return value === "allow" || value === "deny" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string" && v.trim().length > 0) as string[];
}

function asTimeoutMs(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return fallback;
}

export function parseSandboxConfig(input: ParseSandboxConfigInput): SandboxBackendConfig {
  const backend = (input.backend ?? "none") as SandboxBackendName;
  if (!BACKENDS.includes(backend)) throw new Error(`sandbox: unsupported backend: ${String(input.backend)}`);

  const options = input.options ?? {};

  switch (backend) {
    case "none":
      return { backend: "none", options: {} };
    case "bwrap":
      return {
        backend: "bwrap",
        options: {
          bwrapPath: (options.bwrapPath as string) || "bwrap",
          network: asNetworkMode(options.network, "deny"),
          roBinds: asStringArray(options.roBinds),
        },
      };
    case "nsjail":
      return {
        backend: "nsjail",
        options: {
          nsjailPath: (options.nsjailPath as string) || "nsjail",
          network: asNetworkMode(options.network, "deny"),
          roBinds: asStringArray(options.roBinds),
        },
      };
    case "sandbox-exec":
      return {
        backend: "sandbox-exec",
        options: {
          sandboxExecPath: (options.sandboxExecPath as string) || "sandbox-exec",
          network: asNetworkMode(options.network, "deny"),
        },
      };
    case "jobobject":
      return {
        backend: "jobobject",
        options: {
          timeoutMs: asTimeoutMs(options.timeoutMs, 60_000),
        },
      };
    case "systemd-run":
      return {
        backend: "systemd-run",
        options: {
          systemdRunPath: (options.systemdRunPath as string) || "systemd-run",
          network: asNetworkMode(options.network, "deny"),
          roBinds: asStringArray(options.roBinds),
        },
      };
  }
}


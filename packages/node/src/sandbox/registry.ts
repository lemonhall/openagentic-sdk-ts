import type { NativeRunner } from "@openagentic/native-runner";
import { BubblewrapNativeRunner } from "@openagentic/native-runner";
import type { ProcessSandbox } from "@openagentic/wasi-runner-wasmtime";
import { createBubblewrapProcessSandbox } from "@openagentic/wasi-runner-wasmtime";

import type { SandboxBackendConfig, SandboxBackendName } from "./config.js";
import { createNsjailProcessSandbox, NsjailNativeRunner } from "./linux-nsjail.js";
import { createSandboxExecProcessSandbox, SandboxExecNativeRunner } from "./macos-sandbox-exec.js";
import { createWindowsJobObjectNativeRunner } from "./windows-jobobject.js";

export type SandboxBackend = {
  name: SandboxBackendName;
  createProcessSandbox(options: { config: SandboxBackendConfig }): ProcessSandbox | undefined;
  createNativeRunner(options: { config: SandboxBackendConfig; shadowDir: string }): NativeRunner | undefined;
};

const backend: Record<SandboxBackendName, SandboxBackend> = {
  none: {
    name: "none",
    createProcessSandbox() {
      return undefined;
    },
    createNativeRunner() {
      return undefined;
    },
  },
  bwrap: {
    name: "bwrap",
    createProcessSandbox({ config }) {
      if (config.backend !== "bwrap") throw new Error("sandbox: backend mismatch (expected bwrap)");
      return createBubblewrapProcessSandbox({
        bwrapPath: config.options.bwrapPath,
        network: config.options.network,
        ...(config.options.roBinds.length ? { roBinds: config.options.roBinds } : {}),
      });
    },
    createNativeRunner({ config, shadowDir }) {
      if (config.backend !== "bwrap") throw new Error("sandbox: backend mismatch (expected bwrap)");
      return new BubblewrapNativeRunner({
        bwrapPath: config.options.bwrapPath,
        network: config.options.network,
        ...(config.options.roBinds.length ? { roBinds: config.options.roBinds } : {}),
        shadowDir,
      });
    },
  },
  nsjail: {
    name: "nsjail",
    createProcessSandbox({ config }) {
      if (config.backend !== "nsjail") throw new Error("sandbox: backend mismatch (expected nsjail)");
      return createNsjailProcessSandbox({
        nsjailPath: config.options.nsjailPath,
        network: config.options.network,
        ...(config.options.roBinds.length ? { roBinds: config.options.roBinds } : {}),
      });
    },
    createNativeRunner({ config, shadowDir }) {
      if (config.backend !== "nsjail") throw new Error("sandbox: backend mismatch (expected nsjail)");
      return new NsjailNativeRunner({
        nsjailPath: config.options.nsjailPath,
        network: config.options.network,
        ...(config.options.roBinds.length ? { roBinds: config.options.roBinds } : {}),
        shadowDir,
      });
    },
  },
  "sandbox-exec": {
    name: "sandbox-exec",
    createProcessSandbox({ config }) {
      if (config.backend !== "sandbox-exec") throw new Error("sandbox: backend mismatch (expected sandbox-exec)");
      return createSandboxExecProcessSandbox({
        sandboxExecPath: config.options.sandboxExecPath,
        network: config.options.network,
      });
    },
    createNativeRunner({ config, shadowDir }) {
      if (config.backend !== "sandbox-exec") throw new Error("sandbox: backend mismatch (expected sandbox-exec)");
      return new SandboxExecNativeRunner({
        sandboxExecPath: config.options.sandboxExecPath,
        network: config.options.network,
        shadowDir,
      });
    },
  },
  jobobject: {
    name: "jobobject",
    createProcessSandbox() {
      return undefined;
    },
    createNativeRunner({ config }) {
      if (config.backend !== "jobobject") throw new Error("sandbox: backend mismatch (expected jobobject)");
      return createWindowsJobObjectNativeRunner({ timeoutMs: config.options.timeoutMs });
    },
  },
  "systemd-run": {
    name: "systemd-run",
    createProcessSandbox() {
      throw new Error("sandbox: systemd-run backend not implemented yet");
    },
    createNativeRunner() {
      throw new Error("sandbox: systemd-run backend not implemented yet");
    },
  },
};

export function getSandboxBackend(name: SandboxBackendName): SandboxBackend {
  return backend[name];
}

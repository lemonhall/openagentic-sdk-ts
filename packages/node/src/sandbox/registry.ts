import type { NativeRunner } from "@openagentic/native-runner";
import { BubblewrapNativeRunner } from "@openagentic/native-runner";
import type { ProcessSandbox } from "@openagentic/wasi-runner-wasmtime";
import { createBubblewrapProcessSandbox } from "@openagentic/wasi-runner-wasmtime";

import type { SandboxBackendConfig, SandboxBackendName } from "./config.js";

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
    createProcessSandbox() {
      throw new Error("sandbox: nsjail backend not implemented yet");
    },
    createNativeRunner() {
      throw new Error("sandbox: nsjail backend not implemented yet");
    },
  },
  "sandbox-exec": {
    name: "sandbox-exec",
    createProcessSandbox() {
      throw new Error("sandbox: sandbox-exec backend not implemented yet");
    },
    createNativeRunner() {
      throw new Error("sandbox: sandbox-exec backend not implemented yet");
    },
  },
  jobobject: {
    name: "jobobject",
    createProcessSandbox() {
      throw new Error("sandbox: jobobject backend not implemented yet");
    },
    createNativeRunner() {
      throw new Error("sandbox: jobobject backend not implemented yet");
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

export type WasiModuleRef =
  | { kind: "bytes"; bytes: Uint8Array }
  | { kind: "path"; path: string };

export type WasiLimits = {
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
};

export type WasiFsSnapshot = {
  files: Record<string, Uint8Array>;
};

export type WasiExecInput = {
  module: WasiModuleRef;
  argv?: string[];
  env?: Record<string, string>;
  cwd?: string;
  stdin?: Uint8Array;
  netFetch?: import("./netfetch.js").NetFetchConfig | import("./netfetch.js").NetFetch;
  fs?: WasiFsSnapshot;
  /**
   * Optional host directory to preopen as the sandbox root, for runners that
   * can mount a real directory (e.g. `wasmtime`). When set, runners should not
   * use snapshot read/write for filesystem state.
   */
  preopenDir?: string;
  limits?: WasiLimits;
};

export type WasiExecResult = {
  exitCode: number;
  stdout: Uint8Array;
  stderr: Uint8Array;
  truncatedStdout: boolean;
  truncatedStderr: boolean;
  fs?: WasiFsSnapshot;
  netFetchAudits?: import("./netfetch.js").NetFetchAuditRecord[];
};

export interface WasiRunner {
  execModule(input: WasiExecInput): Promise<WasiExecResult>;
}

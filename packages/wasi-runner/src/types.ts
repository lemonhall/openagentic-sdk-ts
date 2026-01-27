export type WasiModuleRef =
  | { kind: "bytes"; bytes: Uint8Array }
  | { kind: "path"; path: string };

export type WasiLimits = {
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
};

export type WasiExecInput = {
  module: WasiModuleRef;
  argv?: string[];
  env?: Record<string, string>;
  cwd?: string;
  stdin?: Uint8Array;
  limits?: WasiLimits;
};

export type WasiExecResult = {
  exitCode: number;
  stdout: Uint8Array;
  stderr: Uint8Array;
  truncatedStdout: boolean;
  truncatedStderr: boolean;
};

export interface WasiRunner {
  execModule(input: WasiExecInput): Promise<WasiExecResult>;
}


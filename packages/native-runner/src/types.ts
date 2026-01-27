export type NativeLimits = {
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
  timeoutMs?: number;
};

export type NativeExecInput = {
  argv: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdin?: Uint8Array;
  limits?: NativeLimits;
};

export type NativeAuditRecord = {
  kind: "native.exec";
  cmd: string;
  argv: string[];
  cwd?: string;
  durationMs: number;
  timedOut: boolean;
  signal?: string | null;
  truncatedStdout: boolean;
  truncatedStderr: boolean;
};

export type NativeExecResult = {
  exitCode: number;
  stdout: Uint8Array;
  stderr: Uint8Array;
  truncatedStdout: boolean;
  truncatedStderr: boolean;
  audits?: NativeAuditRecord[];
};

export interface NativeRunner {
  exec(input: NativeExecInput): Promise<NativeExecResult>;
}


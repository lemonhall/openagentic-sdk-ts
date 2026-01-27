import type { WasiExecInput, WasiExecResult } from "@openagentic/wasi-runner";

export type WorkerExecRequest = {
  type: "exec";
  id: string;
  input: WasiExecInput;
};

export type WorkerExecResponse =
  | { type: "result"; id: string; ok: true; result: WasiExecResult }
  | { type: "result"; id: string; ok: false; errorName: string; errorMessage: string };

export type WorkerMessage = WorkerExecRequest | WorkerExecResponse;


import type { WasiExecInput, WasiExecResult, WasiRunner } from "@openagentic/wasi-runner";

import type { WorkerExecRequest, WorkerExecResponse } from "./protocol.js";

type WorkerLike = {
  postMessage: (msg: any, transfer?: Transferable[]) => void;
  terminate?: () => void;
  onmessage: ((ev: MessageEvent<any>) => void) | null;
};

function randomId(): string {
  // No crypto dependency required for determinism; collisions are extremely unlikely for small volumes.
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export class WorkerWasiRunner implements WasiRunner {
  readonly #worker: WorkerLike;
  readonly #pending = new Map<
    string,
    { resolve: (r: WasiExecResult) => void; reject: (e: Error) => void }
  >();

  constructor(worker: WorkerLike) {
    this.#worker = worker;
    this.#worker.onmessage = (ev: MessageEvent<WorkerExecResponse>) => {
      const msg = ev.data as WorkerExecResponse;
      if (!msg || msg.type !== "result") return;
      const p = this.#pending.get(msg.id);
      if (!p) return;
      this.#pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(Object.assign(new Error(msg.errorMessage), { name: msg.errorName }));
    };
  }

  async execModule(input: WasiExecInput): Promise<WasiExecResult> {
    const id = randomId();
    const req: WorkerExecRequest = { type: "exec", id, input };

    const transfer: Transferable[] = [];
    if (input.module.kind === "bytes") transfer.push(input.module.bytes.buffer);
    if (input.stdin) transfer.push(input.stdin.buffer);

    const p = new Promise<WasiExecResult>((resolve, reject) => this.#pending.set(id, { resolve, reject }));
    this.#worker.postMessage(req, transfer);
    return p;
  }

  terminate(): void {
    this.#worker.terminate?.();
  }
}


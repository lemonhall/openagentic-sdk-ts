import type { WasiExecInput, WasiExecResult, WasiRunner } from "@openagentic/wasi-runner";

class WasiExit extends Error {
  readonly code: number;
  constructor(code: number) {
    super(`WASI exit ${code}`);
    this.code = code;
  }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export class InProcessWasiRunner implements WasiRunner {
  async execModule(input: WasiExecInput): Promise<WasiExecResult> {
    if (input.module.kind !== "bytes") throw new Error("InProcessWasiRunner only supports module.kind=bytes");

    const maxStdout = input.limits?.maxStdoutBytes ?? 1024 * 1024;
    const maxStderr = input.limits?.maxStderrBytes ?? 1024 * 1024;

    const stdoutChunks: Uint8Array[] = [];
    const stderrChunks: Uint8Array[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let truncatedStdout = false;
    let truncatedStderr = false;

    let memory: WebAssembly.Memory | undefined;

    const push = (fd: number, bytes: Uint8Array) => {
      if (fd === 1) {
        if (stdoutBytes >= maxStdout) {
          truncatedStdout = true;
          return;
        }
        const slice = bytes.subarray(0, Math.max(0, maxStdout - stdoutBytes));
        stdoutBytes += slice.byteLength;
        stdoutChunks.push(slice);
        if (slice.byteLength < bytes.byteLength) truncatedStdout = true;
        return;
      }
      if (fd === 2) {
        if (stderrBytes >= maxStderr) {
          truncatedStderr = true;
          return;
        }
        const slice = bytes.subarray(0, Math.max(0, maxStderr - stderrBytes));
        stderrBytes += slice.byteLength;
        stderrChunks.push(slice);
        if (slice.byteLength < bytes.byteLength) truncatedStderr = true;
      }
    };

    const imports: WebAssembly.Imports = {
      wasi_snapshot_preview1: {
        proc_exit(code: number) {
          throw new WasiExit(code >>> 0);
        },
        fd_write(fd: number, iovsPtr: number, iovsLen: number, nwrittenPtr: number) {
          if (!memory) return 8; // badf
          const mem = new DataView(memory.buffer);
          let writtenTotal = 0;
          for (let i = 0; i < iovsLen; i++) {
            const base = iovsPtr + i * 8;
            const ptr = mem.getUint32(base, true);
            const len = mem.getUint32(base + 4, true);
            const bytes = new Uint8Array(memory.buffer, ptr, len);
            push(fd, bytes);
            writtenTotal += len;
          }
          mem.setUint32(nwrittenPtr, writtenTotal, true);
          return 0; // success
        },
      },
    };

    const instantiated = (await WebAssembly.instantiate(
      input.module.bytes,
      imports,
    )) as unknown as WebAssembly.WebAssemblyInstantiatedSource;
    const instance = instantiated.instance;
    memory = (instance.exports as any).memory as WebAssembly.Memory | undefined;
    if (!memory) throw new Error("WASI module must export memory");

    const start = (instance.exports as any)._start as (() => void) | undefined;
    if (typeof start !== "function") throw new Error("WASI module must export _start()");

    let exitCode = 0;
    try {
      start();
    } catch (e) {
      if (e instanceof WasiExit) exitCode = e.code;
      else throw e;
    }

    return {
      exitCode,
      stdout: concatBytes(stdoutChunks),
      stderr: concatBytes(stderrChunks),
      truncatedStdout,
      truncatedStderr,
    };
  }
}

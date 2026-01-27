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

type FileHandle = {
  kind: "file";
  path: string;
  offset: number;
};

type DirHandle = {
  kind: "dir";
  name: string;
};

type Handle = FileHandle | DirHandle;

const WASI_ERRNO_SUCCESS = 0;
const WASI_ERRNO_BADF = 8;
const WASI_ERRNO_INVAL = 28;
const WASI_ERRNO_NOENT = 44;
const WASI_PREOPEN_FD = 3;

const WASI_OFLAGS_CREAT = 1 << 0;
const WASI_OFLAGS_TRUNC = 1 << 3;

const WASI_WHENCE_SET = 0;
const WASI_WHENCE_CUR = 1;
const WASI_WHENCE_END = 2;

function normalizeSandboxPath(p: string): string | null {
  if (!p) return null;
  if (p.startsWith("/")) return null;
  const parts = p.split("/").filter((x) => x.length > 0 && x !== ".");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") return null;
    out.push(part);
  }
  return out.join("/");
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
    const stdin = input.stdin ?? new Uint8Array();
    let stdinOffset = 0;

    const argv = input.argv ?? [];
    const envEntries = Object.entries(input.env ?? {});
    const env = envEntries.map(([k, v]) => `${k}=${v}`);

    const preopenName = ".";
    const handles = new Map<number, Handle>([[WASI_PREOPEN_FD, { kind: "dir", name: preopenName }]]);
    let nextFd = WASI_PREOPEN_FD + 1;

    const fsFiles = new Map<string, Uint8Array>();
    if (input.fs?.files) {
      for (const [path, bytes] of Object.entries(input.fs.files)) {
        fsFiles.set(path, new Uint8Array(bytes));
      }
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const writeU32 = (ptr: number, val: number) => {
      if (!memory) throw new Error("memory not set");
      new DataView(memory.buffer).setUint32(ptr, val >>> 0, true);
    };
    const writeU64 = (ptr: number, val: bigint) => {
      if (!memory) throw new Error("memory not set");
      new DataView(memory.buffer).setBigUint64(ptr, val, true);
    };
    const readU32 = (ptr: number) => {
      if (!memory) throw new Error("memory not set");
      return new DataView(memory.buffer).getUint32(ptr, true);
    };
    const readBytes = (ptr: number, len: number) => {
      if (!memory) throw new Error("memory not set");
      return new Uint8Array(memory.buffer, ptr, len);
    };
    const readString = (ptr: number, len: number) => decoder.decode(readBytes(ptr, len));

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
        args_sizes_get(argcPtr: number, argvBufSizePtr: number) {
          if (!memory) return WASI_ERRNO_BADF;
          const argc = argv.length >>> 0;
          const bufSize = argv.reduce((n, a) => n + encoder.encode(a).byteLength + 1, 0) >>> 0;
          writeU32(argcPtr, argc);
          writeU32(argvBufSizePtr, bufSize);
          return WASI_ERRNO_SUCCESS;
        },
        args_get(argvPtr: number, argvBufPtr: number) {
          if (!memory) return WASI_ERRNO_BADF;
          let bufOff = argvBufPtr;
          for (let i = 0; i < argv.length; i++) {
            const bytes = encoder.encode(argv[i]);
            writeU32(argvPtr + i * 4, bufOff);
            readBytes(bufOff, bytes.byteLength).set(bytes);
            bufOff += bytes.byteLength;
            readBytes(bufOff, 1)[0] = 0;
            bufOff += 1;
          }
          return WASI_ERRNO_SUCCESS;
        },
        environ_sizes_get(envcPtr: number, envBufSizePtr: number) {
          if (!memory) return WASI_ERRNO_BADF;
          const envc = env.length >>> 0;
          const bufSize = env.reduce((n, e) => n + encoder.encode(e).byteLength + 1, 0) >>> 0;
          writeU32(envcPtr, envc);
          writeU32(envBufSizePtr, bufSize);
          return WASI_ERRNO_SUCCESS;
        },
        environ_get(envPtr: number, envBufPtr: number) {
          if (!memory) return WASI_ERRNO_BADF;
          let bufOff = envBufPtr;
          for (let i = 0; i < env.length; i++) {
            const bytes = encoder.encode(env[i]);
            writeU32(envPtr + i * 4, bufOff);
            readBytes(bufOff, bytes.byteLength).set(bytes);
            bufOff += bytes.byteLength;
            readBytes(bufOff, 1)[0] = 0;
            bufOff += 1;
          }
          return WASI_ERRNO_SUCCESS;
        },
        proc_exit(code: number) {
          throw new WasiExit(code >>> 0);
        },
        fd_prestat_get(fd: number, bufPtr: number) {
          if (!memory) return WASI_ERRNO_BADF;
          const h = handles.get(fd);
          if (!h || h.kind !== "dir") return WASI_ERRNO_BADF;
          const nameBytes = encoder.encode(h.name);
          const mem = new DataView(memory.buffer);
          mem.setUint32(bufPtr, 0, true); // tag (dir), plus padding
          mem.setUint32(bufPtr + 4, nameBytes.byteLength, true);
          return WASI_ERRNO_SUCCESS;
        },
        fd_prestat_dir_name(fd: number, pathPtr: number, pathLen: number) {
          if (!memory) return WASI_ERRNO_BADF;
          const h = handles.get(fd);
          if (!h || h.kind !== "dir") return WASI_ERRNO_BADF;
          const nameBytes = encoder.encode(h.name);
          if (pathLen < nameBytes.byteLength) return WASI_ERRNO_INVAL;
          readBytes(pathPtr, nameBytes.byteLength).set(nameBytes);
          return WASI_ERRNO_SUCCESS;
        },
        fd_read(fd: number, iovsPtr: number, iovsLen: number, nreadPtr: number) {
          if (!memory) return 8; // badf
          const mem = new DataView(memory.buffer);
          let readTotal = 0;

          if (fd === 0) {
            for (let i = 0; i < iovsLen; i++) {
              const base = iovsPtr + i * 8;
              const ptr = mem.getUint32(base, true);
              const len = mem.getUint32(base + 4, true);
              const available = stdin.byteLength - stdinOffset;
              const n = Math.max(0, Math.min(len, available));
              if (n > 0) {
                new Uint8Array(memory.buffer, ptr, n).set(stdin.subarray(stdinOffset, stdinOffset + n));
                stdinOffset += n;
                readTotal += n;
              }
              if (available <= 0) break;
            }
            mem.setUint32(nreadPtr, readTotal, true);
            return WASI_ERRNO_SUCCESS;
          }

          const h = handles.get(fd);
          if (!h || h.kind !== "file") return WASI_ERRNO_BADF;
          const fileBytes = fsFiles.get(h.path) ?? new Uint8Array();
          for (let i = 0; i < iovsLen; i++) {
            const base = iovsPtr + i * 8;
            const ptr = mem.getUint32(base, true);
            const len = mem.getUint32(base + 4, true);
            const available = fileBytes.byteLength - h.offset;
            const n = Math.max(0, Math.min(len, available));
            if (n > 0) {
              new Uint8Array(memory.buffer, ptr, n).set(fileBytes.subarray(h.offset, h.offset + n));
              h.offset += n;
              readTotal += n;
            }
            if (available <= 0) break;
          }
          mem.setUint32(nreadPtr, readTotal, true);
          return WASI_ERRNO_SUCCESS;
        },
        fd_write(fd: number, iovsPtr: number, iovsLen: number, nwrittenPtr: number) {
          if (!memory) return WASI_ERRNO_BADF;
          const mem = new DataView(memory.buffer);
          let writtenTotal = 0;

          if (fd === 1 || fd === 2) {
            for (let i = 0; i < iovsLen; i++) {
              const base = iovsPtr + i * 8;
              const ptr = mem.getUint32(base, true);
              const len = mem.getUint32(base + 4, true);
              const bytes = new Uint8Array(memory.buffer, ptr, len);
              push(fd, bytes);
              writtenTotal += len;
            }
            mem.setUint32(nwrittenPtr, writtenTotal, true);
            return WASI_ERRNO_SUCCESS;
          }

          const h = handles.get(fd);
          if (!h || h.kind !== "file") return WASI_ERRNO_BADF;
          let cur = fsFiles.get(h.path) ?? new Uint8Array();
          for (let i = 0; i < iovsLen; i++) {
            const base = iovsPtr + i * 8;
            const ptr = mem.getUint32(base, true);
            const len = mem.getUint32(base + 4, true);
            const bytes = new Uint8Array(memory.buffer, ptr, len);
            const end = h.offset + len;
            if (end > cur.byteLength) {
              const next = new Uint8Array(end);
              next.set(cur, 0);
              cur = next;
            }
            cur.set(bytes, h.offset);
            h.offset += len;
            writtenTotal += len;
          }
          fsFiles.set(h.path, cur);
          mem.setUint32(nwrittenPtr, writtenTotal, true);
          return WASI_ERRNO_SUCCESS;
        },
        fd_close(fd: number) {
          const h = handles.get(fd);
          if (!h || h.kind !== "file") return WASI_ERRNO_BADF;
          handles.delete(fd);
          return WASI_ERRNO_SUCCESS;
        },
        fd_seek(fd: number, offset: bigint, whence: number, newOffsetPtr: number) {
          if (!memory) return WASI_ERRNO_BADF;
          const h = handles.get(fd);
          if (!h || h.kind !== "file") return WASI_ERRNO_BADF;
          const fileBytes = fsFiles.get(h.path) ?? new Uint8Array();
          let next: bigint;
          if (whence === WASI_WHENCE_SET) next = offset;
          else if (whence === WASI_WHENCE_CUR) next = BigInt(h.offset) + offset;
          else if (whence === WASI_WHENCE_END) next = BigInt(fileBytes.byteLength) + offset;
          else return WASI_ERRNO_INVAL;
          if (next < 0n) return WASI_ERRNO_INVAL;
          h.offset = Number(next);
          writeU64(newOffsetPtr, BigInt(h.offset));
          return WASI_ERRNO_SUCCESS;
        },
        path_open(
          dirfd: number,
          _dirflags: number,
          pathPtr: number,
          pathLen: number,
          oflags: number,
          _fsRightsBase: bigint,
          _fsRightsInheriting: bigint,
          _fdflags: number,
          openedFdPtr: number,
        ) {
          if (!memory) return WASI_ERRNO_BADF;
          const h = handles.get(dirfd);
          if (!h || h.kind !== "dir") return WASI_ERRNO_BADF;
          const raw = readString(pathPtr, pathLen);
          const normalized = normalizeSandboxPath(raw);
          if (!normalized) return WASI_ERRNO_INVAL;

          const exists = fsFiles.has(normalized);
          const wantCreate = (oflags & WASI_OFLAGS_CREAT) !== 0;
          const wantTrunc = (oflags & WASI_OFLAGS_TRUNC) !== 0;

          if (!exists && !wantCreate) return WASI_ERRNO_NOENT;
          if (!exists && wantCreate) fsFiles.set(normalized, new Uint8Array());
          if (wantTrunc) fsFiles.set(normalized, new Uint8Array());

          const fd = nextFd++;
          handles.set(fd, { kind: "file", path: normalized, offset: 0 });
          writeU32(openedFdPtr, fd);
          return WASI_ERRNO_SUCCESS;
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
      fs: input.fs ? { files: Object.fromEntries(Array.from(fsFiles.entries()).map(([p, b]) => [p, new Uint8Array(b)])) } : undefined,
    };
  }
}

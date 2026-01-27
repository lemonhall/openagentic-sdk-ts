import { spawn } from "node:child_process";

import type { NativeExecInput, NativeExecResult, NativeRunner } from "./types.js";

export type BubblewrapNetworkMode = "allow" | "deny";

export type BubblewrapNativeRunnerOptions = {
  bwrapPath?: string;
  shadowDir: string;
  roBinds?: string[];
  network?: BubblewrapNetworkMode;
};

export function buildBubblewrapArgv(options: {
  bwrapPath: string;
  shadowDir: string;
  commandArgv: string[];
  network: BubblewrapNetworkMode;
  roBinds: string[];
}): { cmd: string; args: string[] } {
  const args: string[] = [
    "--die-with-parent",
    "--new-session",
    ...(options.network === "deny" ? ["--unshare-net"] : []),
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--tmpfs",
    "/tmp",
  ];

  for (const p of options.roBinds) {
    args.push("--ro-bind", p, p);
  }

  args.push("--bind", options.shadowDir, "/workspace", "--chdir", "/workspace", ...options.commandArgv);
  return { cmd: options.bwrapPath, args };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export class BubblewrapNativeRunner implements NativeRunner {
  readonly bwrapPath: string;
  readonly shadowDir: string;
  readonly roBinds: string[];
  readonly network: BubblewrapNetworkMode;

  constructor(options: BubblewrapNativeRunnerOptions) {
    this.bwrapPath = options.bwrapPath ?? "bwrap";
    this.shadowDir = options.shadowDir;
    this.roBinds = options.roBinds ?? ["/usr", "/bin", "/lib", "/lib64", "/etc"];
    this.network = options.network ?? "allow";
  }

  async exec(input: NativeExecInput): Promise<NativeExecResult> {
    const cmd0 = input.argv[0];
    if (!cmd0) throw new Error("NativeRunner.exec: argv[0] is required");

    const maxStdout = input.limits?.maxStdoutBytes ?? 1024 * 1024;
    const maxStderr = input.limits?.maxStderrBytes ?? 1024 * 1024;
    const timeoutMs = input.limits?.timeoutMs ?? 60_000;

    const argv = buildBubblewrapArgv({
      bwrapPath: this.bwrapPath,
      shadowDir: this.shadowDir,
      commandArgv: input.argv,
      network: this.network,
      roBinds: this.roBinds,
    });

    const startedAt = Date.now();
    const stdoutChunks: Uint8Array[] = [];
    const stderrChunks: Uint8Array[] = [];
    let truncatedStdout = false;
    let truncatedStderr = false;
    let timedOut = false;
    let signal: string | null = null;

    const exitCode = await new Promise<number>((resolve, reject) => {
      const cp = spawn(argv.cmd, argv.args, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: input.cwd,
        env: { ...process.env, ...(input.env ?? {}) },
      });

      const t = setTimeout(() => {
        timedOut = true;
        try {
          cp.kill("SIGKILL");
        } catch {
          // ignore
        }
      }, timeoutMs);

      cp.on("error", (e) => {
        clearTimeout(t);
        reject(e);
      });

      if (input.stdin && input.stdin.byteLength > 0) {
        cp.stdin.write(Buffer.from(input.stdin));
      }
      cp.stdin.end();

      cp.stdout.on("data", (buf: Buffer) => {
        if (truncatedStdout) return;
        const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        const cur = stdoutChunks.reduce((n, c) => n + c.byteLength, 0);
        const slice = bytes.subarray(0, Math.max(0, maxStdout - cur));
        stdoutChunks.push(slice);
        if (slice.byteLength < bytes.byteLength) truncatedStdout = true;
      });
      cp.stderr.on("data", (buf: Buffer) => {
        if (truncatedStderr) return;
        const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        const cur = stderrChunks.reduce((n, c) => n + c.byteLength, 0);
        const slice = bytes.subarray(0, Math.max(0, maxStderr - cur));
        stderrChunks.push(slice);
        if (slice.byteLength < bytes.byteLength) truncatedStderr = true;
      });

      cp.on("close", (code, sig) => {
        clearTimeout(t);
        signal = sig;
        resolve(code ?? (timedOut ? 124 : 1));
      });
    });

    const durationMs = Date.now() - startedAt;

    return {
      exitCode,
      stdout: concat(stdoutChunks),
      stderr: concat(stderrChunks),
      truncatedStdout,
      truncatedStderr,
      audits: [
        {
          kind: "native.exec",
          cmd: argv.cmd,
          argv: argv.args,
          cwd: input.cwd,
          durationMs,
          timedOut,
          signal,
          truncatedStdout,
          truncatedStderr,
        },
      ],
    };
  }
}


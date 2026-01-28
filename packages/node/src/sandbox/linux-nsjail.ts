import type { NativeExecInput, NativeExecResult, NativeRunner } from "@openagentic/native-runner";
import { spawn } from "node:child_process";

export type NsjailNetworkMode = "allow" | "deny";

function defaultOptions(): Required<{ nsjailPath: string; network: NsjailNetworkMode; roBinds: string[] }> {
  return {
    nsjailPath: "nsjail",
    network: "deny",
    roBinds: ["/usr", "/bin", "/lib", "/lib64", "/etc"],
  };
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

function toWorkspaceCwd(rel: string | undefined): string {
  const cwdRel = (rel ?? "").replace(/^\/+/, "");
  if (cwdRel === "" || cwdRel === ".") return "/workspace";
  if (cwdRel.startsWith("workspace/")) return `/${cwdRel}`;
  return `/workspace/${cwdRel}`;
}

export function buildNsjailNativeArgv(options: {
  nsjailPath: string;
  shadowDir: string;
  commandArgv: string[];
  /**
   * Workspace-relative working directory inside `/workspace`.
   */
  cwd?: string;
  network: NsjailNetworkMode;
  roBinds: string[];
}): { cmd: string; args: string[] } {
  const args: string[] = ["--mode", "o", "--quiet"];

  if (options.network === "allow") {
    args.push("--disable_clone_newnet");
  }

  const roBinds = [...options.roBinds].filter(Boolean).sort();
  for (const p of roBinds) {
    args.push("--bindmount_ro", `${p}:${p}`);
  }

  const cwd = toWorkspaceCwd(options.cwd);
  args.push("--bindmount", `${options.shadowDir}:/workspace`, "--cwd", cwd, "--", ...options.commandArgv);
  return { cmd: options.nsjailPath, args };
}

export type NsjailNativeRunnerOptions = {
  nsjailPath?: string;
  shadowDir: string;
  roBinds?: string[];
  network?: NsjailNetworkMode;
};

export class NsjailNativeRunner implements NativeRunner {
  readonly nsjailPath: string;
  readonly shadowDir: string;
  readonly roBinds: string[];
  readonly network: NsjailNetworkMode;

  constructor(options: NsjailNativeRunnerOptions) {
    const defaults = defaultOptions();
    this.nsjailPath = options.nsjailPath ?? defaults.nsjailPath;
    this.shadowDir = options.shadowDir;
    this.roBinds = options.roBinds ?? defaults.roBinds;
    this.network = options.network ?? defaults.network;
  }

  async exec(input: NativeExecInput): Promise<NativeExecResult> {
    const cmd0 = input.argv[0];
    if (!cmd0) throw new Error("NativeRunner.exec: argv[0] is required");

    const maxStdout = input.limits?.maxStdoutBytes ?? 1024 * 1024;
    const maxStderr = input.limits?.maxStderrBytes ?? 1024 * 1024;
    const timeoutMs = input.limits?.timeoutMs ?? 60_000;

    const argv = buildNsjailNativeArgv({
      nsjailPath: this.nsjailPath,
      shadowDir: this.shadowDir,
      commandArgv: input.argv,
      cwd: input.cwd,
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

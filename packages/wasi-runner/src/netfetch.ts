export type NetFetchRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: Uint8Array | string;
  timeoutMs?: number;
};

export type NetFetchResponse = {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
  truncated: boolean;
};

export type NetFetchPolicy = {
  timeoutMs: number;
  maxResponseBytes: number;
  maxRequests: number;
  maxTotalResponseBytes: number;
  maxConcurrent: number;
};

export interface NetFetch {
  fetch(req: NetFetchRequest): Promise<NetFetchResponse>;
}

export type NetFetchFactoryOptions = {
  policy?: Partial<NetFetchPolicy>;
  fetchImpl?: typeof fetch;
  credentials?: RequestCredentials;
};

const DEFAULT_POLICY: NetFetchPolicy = {
  timeoutMs: 30_000,
  maxResponseBytes: 1_000_000,
  maxRequests: 200,
  maxTotalResponseBytes: 50_000_000,
  maxConcurrent: 4,
};

class Semaphore {
  #max: number;
  #cur = 0;
  #q: Array<() => void> = [];
  constructor(max: number) {
    this.#max = Math.max(1, max);
  }
  async acquire(): Promise<() => void> {
    if (this.#cur < this.#max) {
      this.#cur++;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.#q.push(resolve));
    this.#cur++;
    return () => this.release();
  }
  release(): void {
    this.#cur = Math.max(0, this.#cur - 1);
    const next = this.#q.shift();
    if (next) next();
  }
}

function normalizeHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of h.entries()) {
    const key = k.toLowerCase();
    if (key === "content-type" || key === "content-length") out[key] = v;
  }
  return out;
}

export function createNetFetch(options: NetFetchFactoryOptions = {}): NetFetch {
  const policy: NetFetchPolicy = { ...DEFAULT_POLICY, ...(options.policy ?? {}) };
  const sem = new Semaphore(policy.maxConcurrent);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("NetFetch requires global fetch or fetchImpl");

  let requests = 0;
  let totalBytes = 0;

  return {
    async fetch(req: NetFetchRequest): Promise<NetFetchResponse> {
      requests++;
      if (requests > policy.maxRequests) throw new Error("netfetch: maxRequests exceeded");
      if (totalBytes > policy.maxTotalResponseBytes) throw new Error("netfetch: maxTotalResponseBytes exceeded");

      const release = await sem.acquire();
      try {
        const controller = new AbortController();
        const timeoutMs = typeof req.timeoutMs === "number" ? req.timeoutMs : policy.timeoutMs;
        const t = setTimeout(() => controller.abort(), timeoutMs);

        const body =
          typeof req.body === "string"
            ? req.body
            : req.body instanceof Uint8Array
              ? req.body
              : undefined;

        const res = await fetchImpl(req.url, {
          method: req.method ?? (body ? "POST" : "GET"),
          headers: req.headers,
          body: body as any,
          signal: controller.signal,
          credentials: options.credentials,
        });
        clearTimeout(t);

        const raw = new Uint8Array(await res.arrayBuffer());
        const allowed = Math.max(0, policy.maxResponseBytes);
        const sliced = raw.subarray(0, allowed);
        const truncated = sliced.byteLength < raw.byteLength;
        totalBytes += sliced.byteLength;
        if (totalBytes > policy.maxTotalResponseBytes) throw new Error("netfetch: maxTotalResponseBytes exceeded");

        return { status: res.status, headers: normalizeHeaders(res.headers), body: sliced, truncated };
      } finally {
        release();
      }
    },
  };
}

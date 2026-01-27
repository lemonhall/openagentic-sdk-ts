import type { NetFetch, NetFetchFactoryOptions } from "@openagentic/wasi-runner";
import { createNetFetch } from "@openagentic/wasi-runner";

export function createWebNetFetch(options: NetFetchFactoryOptions = {}): NetFetch {
  return createNetFetch({ ...options, credentials: "omit" });
}

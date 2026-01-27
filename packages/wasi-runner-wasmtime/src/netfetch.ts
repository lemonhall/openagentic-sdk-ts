import type { NetFetch, NetFetchFactoryOptions } from "@openagentic/wasi-runner";
import { createNetFetch } from "@openagentic/wasi-runner";

export function createServerNetFetch(options: NetFetchFactoryOptions = {}): NetFetch {
  // Server-side: credentials are not browser cookies; still default to omit.
  return createNetFetch({ ...options, credentials: "omit" });
}

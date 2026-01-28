import type { SessionStore } from "@openagentic/sdk-core";
import { JsonlSessionStore } from "@openagentic/sdk-core";
import { createIndexedDbJsonlBackend } from "@openagentic/sdk-web";

export function createDemoSessionStore(options: { dbName?: string } = {}): SessionStore {
  const backend = createIndexedDbJsonlBackend({ dbName: options.dbName ?? "openagentic-demo-web" });
  return new JsonlSessionStore(backend);
}


import type { JsonlBackend } from "@openagentic/sdk-core";

export type IndexedDbJsonlBackendOptions = {
  dbName?: string;
  storeName?: string;
};

type FileRecord = { path: string; text: string };

function openDb(options: Required<IndexedDbJsonlBackendOptions>): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(options.dbName, 1);
    req.onerror = () => reject(req.error ?? new Error("IndexedDbJsonlBackend: failed to open db"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(options.storeName)) {
        db.createObjectStore(options.storeName, { keyPath: "path" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function tx<T>(db: IDBDatabase, storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const req = fn(store);
    req.onerror = () => reject(req.error ?? new Error("IndexedDbJsonlBackend: request failed"));
    req.onsuccess = () => resolve(req.result);
  });
}

function enoent(path: string): Error {
  return new Error(`ENOENT: ${path}`);
}

export function createIndexedDbJsonlBackend(opts: IndexedDbJsonlBackendOptions = {}): JsonlBackend {
  const options: Required<IndexedDbJsonlBackendOptions> = {
    dbName: (opts.dbName ?? "openagentic-sessions").trim() || "openagentic-sessions",
    storeName: (opts.storeName ?? "files").trim() || "files",
  };

  let dbPromise: Promise<IDBDatabase> | null = null;
  async function db(): Promise<IDBDatabase> {
    if (!dbPromise) dbPromise = openDb(options);
    return dbPromise;
  }

  return {
    async mkdirp(_dir: string): Promise<void> {},
    async readText(path: string): Promise<string> {
      const d = await db();
      const rec = await tx<FileRecord | undefined>(d, options.storeName, "readonly", (s) => s.get(path));
      if (!rec) throw enoent(path);
      return rec.text;
    },
    async writeText(path: string, text: string): Promise<void> {
      const d = await db();
      await tx(d, options.storeName, "readwrite", (s) => s.put({ path, text } satisfies FileRecord));
    },
    async appendText(path: string, text: string): Promise<void> {
      const d = await db();
      const prev = await tx<FileRecord | undefined>(d, options.storeName, "readonly", (s) => s.get(path));
      const next = (prev?.text ?? "") + text;
      await tx(d, options.storeName, "readwrite", (s) => s.put({ path, text: next } satisfies FileRecord));
    },
  };
}


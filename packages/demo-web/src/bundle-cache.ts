import type { BundleCache } from "@openagentic/bundles";

export type CreateBrowserBundleCacheOptions = {
  base: string;
};

const DB_NAME = "openagentic-bundles";
const DB_VERSION = 1;
const STORE_ASSETS = "assets";

function hasIndexedDb(): boolean {
  return typeof (globalThis as any).indexedDB !== "undefined";
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
  });
}

let sharedDbPromise: Promise<IDBDatabase> | null = null;
async function openDb(): Promise<IDBDatabase> {
  if (sharedDbPromise) return sharedDbPromise;
  sharedDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) db.createObjectStore(STORE_ASSETS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("failed to open indexedDB"));
  });
  return sharedDbPromise;
}

async function idbRead(key: string): Promise<Uint8Array | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_ASSETS, "readonly");
  const store = tx.objectStore(STORE_ASSETS);
  const v = await reqToPromise(store.get(key));
  if (!v) return null;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength));
  return null;
}

async function idbWrite(key: string, data: Uint8Array): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_ASSETS, "readwrite");
  const store = tx.objectStore(STORE_ASSETS);
  const bytes = new Uint8Array(data);
  store.put(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), key);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("indexedDB transaction aborted"));
  });
}

export function createBrowserBundleCache(options: CreateBrowserBundleCacheOptions): BundleCache {
  const base = String(options.base ?? "");
  const mem = new Map<string, Uint8Array>();
  const prefix = base ? `${base}::` : "";

  return {
    async read(path) {
      const p = String(path ?? "");
      const key = `${prefix}${p}`;
      const fromMem = mem.get(key);
      if (fromMem) return fromMem;
      if (!hasIndexedDb()) return null;
      const fromIdb = await idbRead(key);
      if (!fromIdb) return null;
      mem.set(key, fromIdb);
      return fromIdb;
    },
    async write(path, data) {
      const p = String(path ?? "");
      const key = `${prefix}${p}`;
      const bytes = new Uint8Array(data);
      mem.set(key, bytes);
      if (!hasIndexedDb()) return;
      await idbWrite(key, bytes);
    },
  };
}


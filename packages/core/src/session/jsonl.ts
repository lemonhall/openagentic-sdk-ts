import type { Event } from "../events.js";
import type { CreateSessionOptions, SessionMetaRecord, SessionStore } from "./store.js";

export interface JsonlBackend {
  mkdirp(dir: string): Promise<void>;
  readText(path: string): Promise<string>;
  writeText(path: string, text: string): Promise<void>;
  appendText(path: string, text: string): Promise<void>;
}

function createSessionId(): string {
  // 32-char hex, stable across runtimes.
  return globalThis.crypto.randomUUID().replaceAll("-", "");
}

function assertSessionId(sessionId: string): void {
  if (!/^[0-9a-f]{32}$/i.test(sessionId)) {
    throw new Error("Invalid sessionId");
  }
}

function sessionDir(sessionId: string): string {
  assertSessionId(sessionId);
  return sessionId;
}

function eventsPath(sessionId: string): string {
  return `${sessionDir(sessionId)}/events.jsonl`;
}

function metaPath(sessionId: string): string {
  return `${sessionDir(sessionId)}/meta.json`;
}

export class JsonlSessionStore implements SessionStore {
  readonly backend: JsonlBackend;

  constructor(backend: JsonlBackend) {
    this.backend = backend;
  }

  async createSession(options?: CreateSessionOptions): Promise<string> {
    const sessionId = createSessionId();
    await this.backend.mkdirp(sessionDir(sessionId));

    const meta: SessionMetaRecord = {
      sessionId,
      createdAt: Date.now(),
      metadata: options?.metadata ?? {},
    };
    await this.backend.writeText(metaPath(sessionId), JSON.stringify(meta, null, 2) + "\n");

    return sessionId;
  }

  async readMeta(sessionId: string): Promise<SessionMetaRecord | null> {
    try {
      const raw = await this.backend.readText(metaPath(sessionId));
      const obj = JSON.parse(raw) as unknown;
      if (!obj || typeof obj !== "object") return null;
      const rec = obj as Partial<SessionMetaRecord>;
      if (typeof rec.sessionId !== "string") return null;
      if (typeof rec.createdAt !== "number") return null;
      const md = rec.metadata && typeof rec.metadata === "object" ? (rec.metadata as Record<string, unknown>) : {};
      return { sessionId: rec.sessionId, createdAt: rec.createdAt, metadata: md };
    } catch {
      return null;
    }
  }

  async appendEvent(sessionId: string, event: Event): Promise<void> {
    await this.backend.mkdirp(sessionDir(sessionId));

    // Best-effort seq: if the caller didn't provide one, infer from file length.
    const path = eventsPath(sessionId);
    let seq: number | undefined = typeof event.seq === "number" ? event.seq : undefined;
    if (seq === undefined) {
      try {
        const raw = await this.backend.readText(path);
        const lines = raw.split("\n").filter((l) => l.trim().length > 0);
        const last = lines.at(-1);
        if (last) {
          const obj = JSON.parse(last) as any;
          const lastSeq = typeof obj?.seq === "number" ? obj.seq : lines.length;
          seq = lastSeq + 1;
        } else {
          seq = 1;
        }
      } catch {
        seq = 1;
      }
    }

    const stored: Event = {
      ...event,
      ts: typeof event.ts === "number" ? event.ts : Date.now(),
      seq,
    };
    await this.backend.appendText(path, JSON.stringify(stored) + "\n");
  }

  async readEvents(sessionId: string): Promise<Event[]> {
    try {
      const raw = await this.backend.readText(eventsPath(sessionId));
      const out: Event[] = [];
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed) as unknown;
          if (obj && typeof obj === "object") out.push(obj as Event);
        } catch {
          // forward-compat: skip invalid lines
        }
      }
      return out;
    } catch {
      return [];
    }
  }
}

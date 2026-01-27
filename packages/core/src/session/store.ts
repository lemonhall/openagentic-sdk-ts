import type { Event } from "../events.js";

export type SessionMetadata = Record<string, unknown>;

export type SessionMetaRecord = {
  sessionId: string;
  createdAt: number;
  metadata: SessionMetadata;
};

export type CreateSessionOptions = {
  metadata?: SessionMetadata;
};

export interface SessionStore {
  createSession(options?: CreateSessionOptions): Promise<string>;
  readMeta(sessionId: string): Promise<SessionMetaRecord | null>;
  appendEvent(sessionId: string, event: Event): Promise<void>;
  readEvents(sessionId: string): Promise<Event[]>;
}


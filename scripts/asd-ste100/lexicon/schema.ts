import { DatabaseSync } from "node:sqlite";

export const ENTITY_KINDS = ["header", "item", "word", "principal", "workflow"] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface LexiconEntity {
  id: string;
  ordinal: number;
  page: number;
  kind: EntityKind;
  originalText: string;
  parentId: string | null;
  noT2Function: boolean;
}

export interface LexiconEvent {
  id: string;
  utcTime: string;
  actorId: string;
  action: string;
  subjectEntityIds: Array<string>;
  interpreterId: string | null;
  payloadHash: string;
  error: string | null;
}

const DDL = `
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  ordinal INTEGER NOT NULL UNIQUE,
  page INTEGER NOT NULL,
  kind TEXT NOT NULL,
  original_text TEXT NOT NULL,
  parent_id TEXT,
  no_t2_function INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  utc_time TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  subject_entity_ids TEXT NOT NULL,
  interpreter_id TEXT,
  payload_hash TEXT NOT NULL,
  error TEXT
);
`;

export function openLexiconDb(dbPath: string): DatabaseSync {
  const database = new DatabaseSync(dbPath);
  database.exec(DDL);
  return database;
}

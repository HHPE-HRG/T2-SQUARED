import { createHash, randomUUID } from "node:crypto";

import { openLexiconDb, type LexiconEvent } from "./schema.ts";

export interface AppendEventInput {
  actorId: string;
  action: string;
  subjectEntityIds: Array<string>;
  interpreterId?: string | null;
  payload: unknown;
  error?: string | null;
  utcTime?: string;
}

export function payloadHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function appendEvent(dbPath: string, input: AppendEventInput): LexiconEvent {
  const event: LexiconEvent = {
    id: randomUUID(),
    utcTime: input.utcTime ?? new Date().toISOString(),
    actorId: input.actorId,
    action: input.action,
    subjectEntityIds: [...input.subjectEntityIds],
    interpreterId: input.interpreterId ?? null,
    payloadHash: payloadHash(input.payload),
    error: input.error ?? null,
  };
  const database = openLexiconDb(dbPath);
  try {
    database
      .prepare(
        `INSERT INTO events (
          id, utc_time, actor_id, action, subject_entity_ids, interpreter_id, payload_hash, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.utcTime,
        event.actorId,
        event.action,
        JSON.stringify(event.subjectEntityIds),
        event.interpreterId,
        event.payloadHash,
        event.error,
      );
  } finally {
    database.close();
  }
  return event;
}

export function listEvents(dbPath: string): Array<LexiconEvent> {
  const database = openLexiconDb(dbPath);
  try {
    const rows = database
      .prepare(
        `SELECT id, utc_time, actor_id, action, subject_entity_ids, interpreter_id, payload_hash, error
         FROM events ORDER BY utc_time ASC, id ASC`,
      )
      .all() as Array<{
      id: string;
      utc_time: string;
      actor_id: string;
      action: string;
      subject_entity_ids: string;
      interpreter_id: string | null;
      payload_hash: string;
      error: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      utcTime: row.utc_time,
      actorId: row.actor_id,
      action: row.action,
      subjectEntityIds: JSON.parse(row.subject_entity_ids) as Array<string>,
      interpreterId: row.interpreter_id,
      payloadHash: row.payload_hash,
      error: row.error,
    }));
  } finally {
    database.close();
  }
}

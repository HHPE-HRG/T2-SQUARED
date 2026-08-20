import { randomUUID } from "node:crypto";

import { appendEvent } from "./events.ts";
import { listEntities, LexiconError } from "./import.ts";
import { openLexiconDb } from "./schema.ts";

export function addEntityRef(dbPath: string, fromId: string, toId: string): void {
  const database = openLexiconDb(dbPath);
  try {
    database
      .prepare("INSERT INTO links (id, from_id, to_id) VALUES (?, ?, ?)")
      .run(randomUUID(), fromId, toId);
  } finally {
    database.close();
  }
}

export function listRefsTo(dbPath: string, toId: string): Array<{ fromId: string; toId: string }> {
  const database = openLexiconDb(dbPath);
  try {
    const rows = database
      .prepare("SELECT from_id, to_id FROM links WHERE to_id = ?")
      .all(toId) as Array<{ from_id: string; to_id: string }>;
    return rows.map((row) => ({ fromId: row.from_id, toId: row.to_id }));
  } finally {
    database.close();
  }
}

export function shuffleDuplicate(
  dbPath: string,
  input: { actorId: string; savedId: string; duplicateId: string },
): void {
  const ids = new Set(listEntities(dbPath).map((row) => row.id));
  if (!ids.has(input.savedId) || !ids.has(input.duplicateId)) {
    appendEvent(dbPath, {
      actorId: input.actorId,
      action: "shuffle-duplicate",
      subjectEntityIds: [input.savedId, input.duplicateId],
      payload: { savedId: input.savedId, duplicateId: input.duplicateId },
      error: "the duplicate shuffle subjects are missing.",
    });
    throw new LexiconError("the duplicate shuffle subjects are missing.");
  }
  const database = openLexiconDb(dbPath);
  try {
    database
      .prepare("UPDATE links SET to_id = ? WHERE to_id = ?")
      .run(input.savedId, input.duplicateId);
    database.prepare("DELETE FROM links WHERE from_id = ?").run(input.duplicateId);
    database.prepare("DELETE FROM entities WHERE id = ?").run(input.duplicateId);
  } finally {
    database.close();
  }
  appendEvent(dbPath, {
    actorId: input.actorId,
    action: "shuffle-duplicate",
    subjectEntityIds: [input.savedId, input.duplicateId],
    payload: { savedId: input.savedId, duplicateId: input.duplicateId },
  });
}

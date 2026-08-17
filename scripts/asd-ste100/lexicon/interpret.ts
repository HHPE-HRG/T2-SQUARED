import { randomUUID } from "node:crypto";

import { appendEvent } from "./events.ts";
import { listEntities, LexiconError } from "./import.ts";
import { openLexiconDb, type LexiconEntity } from "./schema.ts";

export interface ForkInterpretInput {
  actorId: string;
  parentId: string;
  interpreterId: string;
  surfaceText: string;
}

export function forkInterpret(dbPath: string, input: ForkInterpretInput): LexiconEntity {
  const parent = listEntities(dbPath).find((row) => row.id === input.parentId);
  if (parent === undefined) {
    throw new LexiconError("the parent entity is missing.");
  }
  const nextOrdinal = listEntities(dbPath).reduce((max, row) => Math.max(max, row.ordinal), -1) + 1;
  const child: LexiconEntity = {
    id: randomUUID(),
    ordinal: nextOrdinal,
    page: parent.page,
    kind: parent.kind,
    originalText: input.surfaceText,
    parentId: parent.id,
    noT2Function: false,
  };
  const database = openLexiconDb(dbPath);
  try {
    database
      .prepare(
        "INSERT INTO entities (id, ordinal, page, kind, original_text, parent_id, no_t2_function) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(child.id, child.ordinal, child.page, child.kind, child.originalText, child.parentId, 0);
    database
      .prepare("INSERT INTO links (id, from_id, to_id) VALUES (?, ?, ?)")
      .run(randomUUID(), child.id, parent.id);
  } finally {
    database.close();
  }
  appendEvent(dbPath, {
    actorId: input.actorId,
    action: "interpret-fork",
    subjectEntityIds: [parent.id, child.id],
    interpreterId: input.interpreterId,
    payload: { surfaceText: input.surfaceText },
  });
  return child;
}

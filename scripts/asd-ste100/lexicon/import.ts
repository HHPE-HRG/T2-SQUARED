import { randomUUID } from "node:crypto";

import { appendEvent } from "./events.ts";
import { openLexiconDb, type EntityKind, type LexiconEntity } from "./schema.ts";

export class LexiconError extends Error {
  override readonly name = "LexiconError";
  constructor(message: string) {
    super(message);
  }
}

export interface OriginalItem {
  page: number;
  kind: EntityKind;
  originalText: string;
}

export interface ImportOriginalsInput {
  actorId: string;
  items: Array<OriginalItem>;
}

export function importOriginals(dbPath: string, input: ImportOriginalsInput): Array<LexiconEntity> {
  const database = openLexiconDb(dbPath);
  let existing = 0;
  try {
    const count = database.prepare("SELECT COUNT(*) AS n FROM entities").get() as { n: number };
    existing = count.n;
  } finally {
    database.close();
  }
  if (existing > 0) {
    throw new LexiconError("scan once: originals are already imported.");
  }
  const rows: Array<LexiconEntity> = input.items.map((item, ordinal) => ({
    id: randomUUID(),
    ordinal,
    page: item.page,
    kind: item.kind,
    originalText: item.originalText,
    parentId: null,
    noT2Function: false,
  }));
  const write = openLexiconDb(dbPath);
  try {
    const insert = write.prepare(
      "INSERT INTO entities (id, ordinal, page, kind, original_text, parent_id, no_t2_function) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const row of rows) {
      insert.run(row.id, row.ordinal, row.page, row.kind, row.originalText, null, 0);
    }
  } finally {
    write.close();
  }
  appendEvent(dbPath, {
    actorId: input.actorId,
    action: "import",
    subjectEntityIds: rows.map((row) => row.id),
    payload: { count: rows.length },
  });
  return rows;
}

export function appendDerivedEntities(dbPath: string, rows: Array<LexiconEntity>): void {
  const write = openLexiconDb(dbPath);
  try {
    const insert = write.prepare(
      "INSERT INTO entities (id, ordinal, page, kind, original_text, parent_id, no_t2_function) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const row of rows) {
      insert.run(
        row.id,
        row.ordinal,
        row.page,
        row.kind,
        row.originalText,
        row.parentId,
        row.noT2Function ? 1 : 0,
      );
    }
  } finally {
    write.close();
  }
}

export function listEntities(dbPath: string): Array<LexiconEntity> {
  const database = openLexiconDb(dbPath);
  try {
    const rows = database
      .prepare(
        "SELECT id, ordinal, page, kind, original_text, parent_id, no_t2_function FROM entities ORDER BY ordinal ASC",
      )
      .all() as Array<{
      id: string;
      ordinal: number;
      page: number;
      kind: EntityKind;
      original_text: string;
      parent_id: string | null;
      no_t2_function: number;
    }>;
    return rows.map((row) => ({
      id: row.id,
      ordinal: row.ordinal,
      page: row.page,
      kind: row.kind,
      originalText: row.original_text,
      parentId: row.parent_id,
      noT2Function: row.no_t2_function === 1,
    }));
  } finally {
    database.close();
  }
}

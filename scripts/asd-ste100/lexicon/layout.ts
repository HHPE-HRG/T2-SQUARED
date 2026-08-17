import { randomUUID } from "node:crypto";

import { appendEvent, listEvents } from "./events.ts";
import { appendDerivedEntities, listEntities } from "./import.ts";
import { openLexiconDb, type EntityKind, type LexiconEntity } from "./schema.ts";

export function guessLayoutKind(originalText: string): EntityKind {
  const text = originalText.trim();
  if (text.startsWith("# ")) {
    return "header";
  }
  if (text.startsWith("- ") || text.startsWith("* ") || /^\d+[.)]\s/.test(text)) {
    return "item";
  }
  if (
    text.length > 0 &&
    text.length <= 48 &&
    text === text.toUpperCase() &&
    /[A-Z]/.test(text) &&
    !text.includes("\n")
  ) {
    return "header";
  }
  return "word";
}

function setKinds(dbPath: string, rows: Array<{ id: string; kind: EntityKind }>): void {
  const database = openLexiconDb(dbPath);
  try {
    const update = database.prepare("UPDATE entities SET kind = ? WHERE id = ?");
    for (const row of rows) {
      update.run(row.kind, row.id);
    }
  } finally {
    database.close();
  }
}

export interface LayoutAutomationInput {
  actorId: string;
  agentCorrect: (entity: LexiconEntity) => EntityKind;
}

export function applyLayoutAutomation(dbPath: string, input: LayoutAutomationInput): void {
  const before = listEntities(dbPath);
  const guessed = before.map((entity) => ({
    id: entity.id,
    kind: guessLayoutKind(entity.originalText),
  }));
  setKinds(dbPath, guessed);
  appendEvent(dbPath, {
    actorId: input.actorId,
    action: "layout-guess",
    subjectEntityIds: guessed.map((row) => row.id),
    payload: { kinds: guessed.map((row) => row.kind) },
  });
  const afterGuess = listEntities(dbPath);
  const corrected = afterGuess.map((entity) => ({
    id: entity.id,
    kind: input.agentCorrect(entity),
  }));
  setKinds(dbPath, corrected);
  appendEvent(dbPath, {
    actorId: input.actorId,
    action: "layout-correct",
    subjectEntityIds: corrected.map((row) => row.id),
    payload: { kinds: corrected.map((row) => row.kind) },
  });
}

export function explodeFrozenPages(dbPath: string, actorId: string): Array<LexiconEntity> {
  if (listEvents(dbPath).some((event) => event.action === "explode-lines")) {
    return listEntities(dbPath).filter((row) => row.parentId !== null);
  }
  const roots = listEntities(dbPath).filter((row) => row.parentId === null);
  let nextOrdinal = listEntities(dbPath).reduce((max, row) => Math.max(max, row.ordinal), -1) + 1;
  const derived: Array<LexiconEntity> = [];
  for (const root of roots) {
    const lines = root.originalText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    for (const line of lines) {
      derived.push({
        id: randomUUID(),
        ordinal: nextOrdinal,
        page: root.page,
        kind: guessLayoutKind(line),
        originalText: line,
        parentId: root.id,
        noT2Function: false,
      });
      nextOrdinal += 1;
    }
  }
  appendDerivedEntities(dbPath, derived);
  appendEvent(dbPath, {
    actorId,
    action: "explode-lines",
    subjectEntityIds: derived.map((row) => row.id),
    payload: { count: derived.length },
  });
  return derived;
}

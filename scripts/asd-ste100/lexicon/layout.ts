import { appendEvent } from "./events.ts";
import { listEntities } from "./import.ts";
import { openLexiconDb, type EntityKind, type LexiconEntity } from "./schema.ts";

export function guessLayoutKind(originalText: string): EntityKind {
  const text = originalText.trim();
  if (text.startsWith("# ")) {
    return "header";
  }
  if (text.startsWith("- ") || text.startsWith("* ") || /^\d+[.)]\s/.test(text)) {
    return "item";
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

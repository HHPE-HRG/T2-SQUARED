import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { appendEvent } from "./events.ts";
import { listEntities } from "./import.ts";

const TOKEN = /[A-Za-z][A-Za-z'-]*/g;
const T2_SURFACES = new Set(["t2", "canbus"]);

export interface LemmaRecord {
  lemma: string;
  status: "approved";
  partOfSpeech: "unknown";
  authority: "ASD-STE100";
  issue: "9";
}

function keepToken(token: string): boolean {
  const key = token.toLowerCase();
  if (T2_SURFACES.has(key)) {
    return false;
  }
  if (key.length === 1) {
    return key === "a" || key === "i";
  }
  return key.length >= 2;
}

export function lemmasFromStockTexts(texts: Array<string>): Array<string> {
  const seen = new Set<string>();
  for (const text of texts) {
    for (const match of text.match(TOKEN) ?? []) {
      const lemma = match.toLowerCase();
      if (!keepToken(lemma)) {
        continue;
      }
      seen.add(lemma);
    }
  }
  return [...seen].sort();
}

export function exportApprovedWordsJson(
  dbPath: string,
  destFile: string,
  actorId: string,
): { sha256: string; lemmaCount: number } {
  const texts = listEntities(dbPath)
    .filter((row) => !row.noT2Function && row.parentId !== null)
    .filter((row) => !T2_SURFACES.has(row.originalText.toLowerCase()))
    .map((row) => row.originalText);
  const words = lemmasFromStockTexts(texts);
  const records: Array<LemmaRecord> = words.map((lemma) => ({
    lemma,
    status: "approved",
    partOfSpeech: "unknown",
    authority: "ASD-STE100",
    issue: "9",
  }));
  mkdirSync(path.dirname(destFile), { recursive: true });
  const body = `${JSON.stringify({ words, records })}\n`;
  writeFileSync(destFile, body);
  const sha256 = createHash("sha256").update(body).digest("hex");
  appendEvent(dbPath, {
    actorId,
    action: "export-approved-words",
    subjectEntityIds: listEntities(dbPath).map((row) => row.id),
    payload: { sha256, lemmaCount: words.length },
  });
  return { sha256, lemmaCount: words.length };
}

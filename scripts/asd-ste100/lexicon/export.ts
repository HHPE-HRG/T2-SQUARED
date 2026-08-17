import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { appendEvent } from "./events.ts";
import { LexiconError, listEntities } from "./import.ts";
import { openLexiconDb } from "./schema.ts";
import type { AsdProfile, TechnicalTerm } from "../vocabulary.ts";
import { parseApprovedWordsFromOfficialBytes } from "../vocabulary.ts";

export function tagNoT2Function(dbPath: string, entityId: string, actorId: string): void {
  const database = openLexiconDb(dbPath);
  try {
    database.prepare("UPDATE entities SET no_t2_function = 1 WHERE id = ?").run(entityId);
  } finally {
    database.close();
  }
  appendEvent(dbPath, {
    actorId,
    action: "tag-no-t2-function",
    subjectEntityIds: [entityId],
    payload: { entityId },
  });
}

export function exportWordsJson(
  dbPath: string,
  destFile: string,
  actorId: string,
): { sha256: string; lemmaCount: number } {
  const words = listEntities(dbPath)
    .filter((row) => !row.noT2Function)
    .map((row) => row.originalText);
  mkdirSync(path.dirname(destFile), { recursive: true });
  const body = `${JSON.stringify({ words })}\n`;
  writeFileSync(destFile, body);
  const sha256 = createHash("sha256").update(body).digest("hex");
  appendEvent(dbPath, {
    actorId,
    action: "export-words",
    subjectEntityIds: listEntities(dbPath).map((row) => row.id),
    payload: { sha256, lemmaCount: words.length },
  });
  return { sha256, lemmaCount: words.length };
}

export function mergeReviewedTerms(
  existing: Array<TechnicalTerm>,
  surfaces: Array<string>,
): Array<TechnicalTerm> {
  const seen = new Set(existing.map((row) => `${row.kind}:${row.term.toLowerCase()}`));
  const merged = [...existing];
  for (const surface of surfaces) {
    const key = `noun:${surface.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push({ term: surface, kind: "noun", reviewed: true });
  }
  return merged;
}

export interface ApplyPinAtGitMergeInput {
  gitMerge: boolean;
  wordsPath: string;
  profilePath: string;
  termsPath: string;
  surfaces: Array<string>;
}

export function applyPinAtGitMerge(input: ApplyPinAtGitMergeInput): {
  sha256: string;
  lemmaCount: number;
  vocabularyReview: AsdProfile["vocabularyReview"];
} {
  if (input.gitMerge !== true) {
    throw new LexiconError("pin apply needs an explicit git-merge flag.");
  }
  const bytes = readFileSync(input.wordsPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const lemmaCount = parseApprovedWordsFromOfficialBytes(bytes).length;
  const profile = JSON.parse(readFileSync(input.profilePath, "utf8")) as AsdProfile;
  const vocabularyReview = profile.vocabularyReview;
  profile.vocabularySha256 = sha256;
  writeFileSync(input.profilePath, `${JSON.stringify(profile, null, 2)}\n`);
  const termsDoc = JSON.parse(readFileSync(input.termsPath, "utf8")) as {
    terms: Array<TechnicalTerm>;
  };
  termsDoc.terms = mergeReviewedTerms(termsDoc.terms, input.surfaces);
  writeFileSync(input.termsPath, `${JSON.stringify(termsDoc, null, 2)}\n`);
  return { sha256, lemmaCount, vocabularyReview };
}

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { appendEvent } from "./events.ts";
import { listEntities } from "./import.ts";

const T2_SURFACES = new Set(["t2", "canbus"]);
const SOURCE_APPROVED_ENTRY_COUNT = 875;
const POS_MARK = {
  v: "v",
  n: "n",
  adj: "adj",
  adv: "adv",
  prep: "prep",
  conj: "conj",
  pron: "pron",
  art: "art",
  ad: "adj",
  vv: "v",
  con: "conj",
} as const;
const REJECT_POS = new Set(["tn", "tv"]);
const HEAD = "([A-Za-z][A-Za-z0-9'/\\-]*(?:[ \\-][A-Za-z0-9'/\\-]+)*)";
const INLINE_ROW = new RegExp(`${HEAD}\\s+\\(\\s*([A-Za-z]+)\\s*\\)`, "g");
const MISSING_CLOSE = new RegExp(`^${HEAD}\\s+\\(\\s*([A-Za-z]+)\\s*$`);
const ONLY_HEAD = new RegExp(`^${HEAD}$`);
const ONLY_POS = /^\(([A-Za-z]+)\)$/;

export interface ApprovedDictionaryExtract {
  words: Array<string>;
  approvedCount: number;
  nonapprovedCount: number;
  extractedApprovedOccurrenceCount: number;
  uniqueLemmaCount: number;
  sourceApprovedEntryCount: number;
  collapsedEntryCount: number;
  phraseCount: number;
  repairs: Array<string>;
}

export interface LemmaReconciliation {
  source: "ASD-STE100 Issue 9";
  sourceApprovedEntryCount: number;
  uniqueLemmaCount: number;
  collapsedEntryCount: number;
  phraseCount: number;
  repairs: Array<string>;
}

function wrapPrefix(line: string): string | null {
  const only = line.match(/^([A-Z]{4,})-\s*$/);
  if (only?.[1] !== undefined) {
    return only[1];
  }
  const junk = line.match(/^([A-Z]{4,})-\s+(.*)$/);
  if (junk?.[1] !== undefined && !/^[A-Z]{3,}/.test(junk[2] ?? "")) {
    return junk[1];
  }
  return null;
}

function joinHyphenWrappedLines(lines: Array<string>): {
  lines: Array<string>;
  repairs: Array<string>;
} {
  const joined: Array<string> = [];
  const repairs: Array<string> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const prefix = wrapPrefix(line);
    const next = lines[index + 1] ?? "";
    const suffix = next.match(/^([A-Z]{3,})\.?(.*)$/);
    if (prefix !== null && suffix?.[1] !== undefined) {
      const head = `${prefix}${suffix[1]}`;
      repairs.push(`${prefix}- + ${suffix[1]} -> ${head.toLowerCase()}`);
      joined.push(`${head}${suffix[2] ?? ""}`);
      index += 1;
      continue;
    }
    joined.push(line);
  }
  return { lines: joined, repairs };
}

function letterCase(head: string): "upper" | "lower" | "mixed" | "none" {
  const letters = head.replace(/[^A-Za-z]/g, "");
  if (letters.length === 0) {
    return "none";
  }
  if (letters === letters.toUpperCase()) {
    return "upper";
  }
  if (letters === letters.toLowerCase()) {
    return "lower";
  }
  return "mixed";
}

function consider(
  approved: Set<string>,
  nonapproved: Set<string>,
  head: string,
  rawPos: string,
): "approved" | "nonapproved" | "skip" {
  const lemma = head.toLowerCase();
  if (T2_SURFACES.has(lemma)) {
    return "skip";
  }
  const tag = rawPos.toLowerCase();
  if (REJECT_POS.has(tag)) {
    return "skip";
  }
  if (!(tag in POS_MARK)) {
    return "skip";
  }
  const casing = letterCase(head);
  if (casing === "upper") {
    approved.add(lemma);
    return "approved";
  }
  if (casing === "lower") {
    nonapproved.add(lemma);
    return "nonapproved";
  }
  return "skip";
}

export function extractApprovedDictionaryLemmas(texts: Array<string>): ApprovedDictionaryExtract {
  const approved = new Set<string>();
  const nonapproved = new Set<string>();
  let extractedApprovedOccurrenceCount = 0;
  const rawLines = texts
    .flatMap((text) => text.split(/\r?\n/))
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const { lines, repairs } = joinHyphenWrappedLines(rawLines);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const match of line.matchAll(new RegExp(INLINE_ROW.source, "g"))) {
      if (consider(approved, nonapproved, match[1] ?? "", match[2] ?? "") === "approved") {
        extractedApprovedOccurrenceCount += 1;
      }
    }
    const missing = line.match(MISSING_CLOSE);
    if (missing !== null) {
      if (consider(approved, nonapproved, missing[1] ?? "", missing[2] ?? "") === "approved") {
        extractedApprovedOccurrenceCount += 1;
      }
    }
    const headOnly = line.match(ONLY_HEAD);
    const nextPos = (lines[index + 1] ?? "").match(ONLY_POS);
    if (headOnly !== null && nextPos !== null) {
      if (consider(approved, nonapproved, headOnly[1] ?? "", nextPos[1] ?? "") === "approved") {
        extractedApprovedOccurrenceCount += 1;
      }
    }
  }
  const words = [...approved].sort();
  const uniqueLemmaCount = words.length;
  return {
    words,
    approvedCount: uniqueLemmaCount,
    nonapprovedCount: nonapproved.size,
    extractedApprovedOccurrenceCount,
    uniqueLemmaCount,
    sourceApprovedEntryCount: SOURCE_APPROVED_ENTRY_COUNT,
    collapsedEntryCount: SOURCE_APPROVED_ENTRY_COUNT - uniqueLemmaCount,
    phraseCount: words.filter((word) => word.includes(" ")).length,
    repairs,
  };
}

function reconciliationFromExtract(extracted: ApprovedDictionaryExtract): LemmaReconciliation {
  return {
    source: "ASD-STE100 Issue 9",
    sourceApprovedEntryCount: extracted.sourceApprovedEntryCount,
    uniqueLemmaCount: extracted.uniqueLemmaCount,
    collapsedEntryCount: extracted.collapsedEntryCount,
    phraseCount: extracted.phraseCount,
    repairs: extracted.repairs,
  };
}

function writeReconciliation(destFile: string, extracted: ApprovedDictionaryExtract): void {
  const metaPath = path.join(path.dirname(destFile), "approved-words.meta.json");
  writeFileSync(metaPath, `${JSON.stringify(reconciliationFromExtract(extracted), null, 2)}\n`);
}

function writeApprovedWords(
  destFile: string,
  words: Array<string>,
): { sha256: string; lemmaCount: number; body: string } {
  mkdirSync(path.dirname(destFile), { recursive: true });
  const body = `${JSON.stringify({ words })}\n`;
  writeFileSync(destFile, body);
  return {
    sha256: createHash("sha256").update(body).digest("hex"),
    lemmaCount: words.length,
    body,
  };
}

export function exportApprovedWordsFromExtraction(
  sourceFile: string,
  destFile: string,
  actorId: string,
): { sha256: string; lemmaCount: number } {
  const parsed = JSON.parse(readFileSync(sourceFile, "utf8")) as { words?: unknown };
  if (!Array.isArray(parsed.words) || parsed.words.some((word) => typeof word !== "string")) {
    throw new Error("`extraction` `words` must be an `array` of `strings`");
  }
  const extracted = extractApprovedDictionaryLemmas(parsed.words);
  const written = writeApprovedWords(destFile, extracted.words);
  writeReconciliation(destFile, extracted);
  void actorId;
  return { sha256: written.sha256, lemmaCount: written.lemmaCount };
}

export function exportApprovedWordsJson(
  dbPath: string,
  destFile: string,
  actorId: string,
): { sha256: string; lemmaCount: number } {
  const texts = listEntities(dbPath)
    .filter((row) => !row.noT2Function && row.parentId !== null)
    .map((row) => row.originalText);
  const extracted = extractApprovedDictionaryLemmas(texts);
  const written = writeApprovedWords(destFile, extracted.words);
  writeReconciliation(destFile, extracted);
  appendEvent(dbPath, {
    actorId,
    action: "export-approved-words",
    subjectEntityIds: listEntities(dbPath).map((row) => row.id),
    payload: { sha256: written.sha256, lemmaCount: written.lemmaCount },
  });
  return { sha256: written.sha256, lemmaCount: written.lemmaCount };
}

export function stripT2Surfaces(words: Array<string>): Array<string> {
  return words.filter((word) => !T2_SURFACES.has(word.toLowerCase()));
}

export function stripT2SurfacesFromWordsFile(wordsPath: string): void {
  const parsed = JSON.parse(readFileSync(wordsPath, "utf8")) as { words?: unknown };
  if (!Array.isArray(parsed.words) || parsed.words.some((word) => typeof word !== "string")) {
    throw new Error("`extraction` `words` must be an `array` of `strings`");
  }
  const words = stripT2Surfaces(parsed.words);
  writeFileSync(wordsPath, `${JSON.stringify({ words })}\n`);
}

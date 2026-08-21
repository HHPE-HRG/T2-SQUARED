import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import type { Finding } from "../rules.ts";

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
const T2_SURFACES = new Set(["t2", "canbus"]);
const HEAD = "([A-Za-z][A-Za-z0-9'/\\-]*(?:[ \\-][A-Za-z0-9'/\\-]+)*)";
const INLINE_ROW = new RegExp(`${HEAD}\\s*\\(\\s*([A-Za-z]+)\\s*\\)`, "g");
const MISSING_CLOSE = new RegExp(`^${HEAD}\\s*\\(\\s*([A-Za-z]+)\\s*$`);
const ONLY_HEAD = new RegExp(`^${HEAD}$`);
const ONLY_POS = /^\(([A-Za-z]+)\)$/;
const PURE_FORM_LINE = /^[A-Z][A-Z0-9'/\-]+,?$/;
const ADJ_FORMS = /\(\s*([A-Z][A-Z0-9'/\-]+(?:\s*,\s*[A-Z][A-Z0-9'/\-]+)*)\s*\)/;
const MEANING_TO = /\bTo\b[^A-Z\n][^.\n]{5,160}/;
const TOKEN = /[A-Za-z][A-Za-z0-9'-]*/g;
const DETERMINERS = new Set(["the", "a", "an", "this", "these"]);

export const STRUCTURED_AUTHORITY_KIND = "issue9-structured-lexical-authority";

export class StructuredLexicalAuthorityError extends Error {
  override readonly name = "StructuredLexicalAuthorityError";
  constructor(message: string) {
    super(message);
  }
}

export interface StructuredLexicalEntry {
  id: string;
  lemma: string;
  approved: boolean;
  pos: string;
  forms: Array<string>;
  meaningDigests: Array<string>;
  multiWord: boolean;
  sourcePages: Array<number>;
}

export interface StructuredLexicalAuthority {
  coverageKind: typeof STRUCTURED_AUTHORITY_KIND;
  source: "ASD-STE100 Issue 9";
  issue: "9";
  entryCount: number;
  entries: Array<StructuredLexicalEntry>;
}

interface MutableEntry {
  lemma: string;
  approved: boolean;
  pos: string;
  forms: Set<string>;
  meaningDigests: Set<string>;
  multiWord: boolean;
  sourcePages: Set<number>;
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

function normalizePos(rawPos: string): string | null {
  const tag = rawPos.toLowerCase();
  if (REJECT_POS.has(tag)) {
    return null;
  }
  if (!(tag in POS_MARK)) {
    return null;
  }
  return POS_MARK[tag as keyof typeof POS_MARK];
}

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function entryKey(lemma: string, pos: string, approved: boolean): string {
  return `${lemma}:${pos}:${approved ? "a" : "n"}`;
}

function ensureEntry(
  map: Map<string, MutableEntry>,
  lemma: string,
  pos: string,
  approved: boolean,
): MutableEntry {
  const key = entryKey(lemma, pos, approved);
  const existing = map.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const created: MutableEntry = {
    lemma,
    approved,
    pos,
    forms: new Set([lemma]),
    meaningDigests: new Set(),
    multiWord: lemma.includes(" "),
    sourcePages: new Set(),
  };
  map.set(key, created);
  return created;
}

function addMeaningDigest(entry: MutableEntry, fragment: string): void {
  const cleaned = fragment.replace(/\s+/g, " ").trim().toLowerCase();
  if (cleaned.length < 8) {
    return;
  }
  entry.meaningDigests.add(sha256Text(cleaned));
}

function formRelated(lemma: string, form: string): boolean {
  if (form === lemma) {
    return true;
  }
  // Pure form lines must continue the lemma; do not accept shared-prefix OCR junk.
  return form.startsWith(lemma) || lemma.startsWith(form);
}

/**
 * Extract private structured Issue 9 lexical rows from OCR/page texts.
 *
 * Parameters
 * ----------
 * texts : Array<string>
 *     Private page or entity texts. Must not be committed.
 *
 * Returns
 * -------
 * StructuredLexicalAuthority
 *     Digested POS/form/meaning authority without definition prose.
 *
 * Example
 * -------
 * extractStructuredLexicalEntries(["QZVSTEREMOVE (v),", "QZVSTEREMOVES,"])
 */
export function extractStructuredLexicalEntries(
  texts: Array<string>,
): StructuredLexicalAuthority {
  const map = new Map<string, MutableEntry>();
  const lines = texts
    .flatMap((text) => text.split(/\r?\n/))
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let formAttach: MutableEntry | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    let sawInline = false;

    for (const match of line.matchAll(new RegExp(INLINE_ROW.source, "g"))) {
      sawInline = true;
      const head = match[1] ?? "";
      const pos = normalizePos(match[2] ?? "");
      if (pos === null) {
        continue;
      }
      const lemma = head.toLowerCase();
      if (T2_SURFACES.has(lemma)) {
        continue;
      }
      const casing = letterCase(head);
      if (casing !== "upper" && casing !== "lower") {
        continue;
      }
      const approved = casing === "upper";
      const entry = ensureEntry(map, lemma, pos, approved);
      const after = line.slice((match.index ?? 0) + match[0].length);
      const meaning = after.match(MEANING_TO);
      if (meaning?.[0] !== undefined) {
        addMeaningDigest(entry, meaning[0]);
      }
      const adjForms = after.match(ADJ_FORMS);
      if (adjForms?.[1] !== undefined && pos === "adj" && approved) {
        for (const raw of adjForms[1].split(",")) {
          const form = raw.trim().toLowerCase();
          if (form.length > 0 && formRelated(lemma, form)) {
            entry.forms.add(form);
          }
        }
      }
      if (approved && (pos === "v" || pos === "adj")) {
        const beforeMeaning = meaning !== null ? after.slice(0, meaning.index ?? 0) : after;
        if (/^\s*,\s*$/.test(beforeMeaning) || beforeMeaning.trim() === ",") {
          formAttach = entry;
        } else if (/^\s*,\s*$/.test(after) || after.trim() === ",") {
          formAttach = entry;
        } else if (after.trim() === "" || after.trim() === ",") {
          formAttach = entry;
        } else {
          formAttach = null;
        }
      } else {
        formAttach = null;
      }
    }

    if (!sawInline) {
      const missing = line.match(MISSING_CLOSE);
      if (missing !== null) {
        const head = missing[1] ?? "";
        const pos = normalizePos(missing[2] ?? "");
        const casing = letterCase(head);
        if (pos !== null && (casing === "upper" || casing === "lower")) {
          const lemma = head.toLowerCase();
          if (!T2_SURFACES.has(lemma)) {
            const entry = ensureEntry(map, lemma, pos, casing === "upper");
            if (casing === "upper" && (pos === "v" || pos === "adj")) {
              formAttach = entry;
            } else {
              formAttach = null;
            }
          }
        }
      } else {
        const headOnly = line.match(ONLY_HEAD);
        const nextPos = (lines[index + 1] ?? "").match(ONLY_POS);
        if (headOnly !== null && nextPos !== null) {
          const head = headOnly[1] ?? "";
          const pos = normalizePos(nextPos[1] ?? "");
          const casing = letterCase(head);
          if (pos !== null && (casing === "upper" || casing === "lower")) {
            const lemma = head.toLowerCase();
            if (!T2_SURFACES.has(lemma)) {
              const entry = ensureEntry(map, lemma, pos, casing === "upper");
              formAttach =
                casing === "upper" && (pos === "v" || pos === "adj") ? entry : null;
            }
          }
          index += 1;
          continue;
        }
        if (formAttach !== null && PURE_FORM_LINE.test(line)) {
          const form = line.replace(/,/g, "").toLowerCase();
          if (formRelated(formAttach.lemma, form)) {
            formAttach.forms.add(form);
          }
          continue;
        }
        formAttach = null;
      }
    }
  }

  const entries = [...map.values()]
    .map((entry) => ({
      id: `${entry.lemma}:${entry.pos}:${entry.approved ? "a" : "n"}`,
      lemma: entry.lemma,
      approved: entry.approved,
      pos: entry.pos,
      forms: [...entry.forms].sort(),
      meaningDigests: [...entry.meaningDigests].sort(),
      multiWord: entry.multiWord,
      sourcePages: [...entry.sourcePages].sort((left, right) => left - right),
    }))
    .sort((left, right) => {
      const byLemma = left.lemma.localeCompare(right.lemma);
      if (byLemma !== 0) {
        return byLemma;
      }
      const byPos = left.pos.localeCompare(right.pos);
      if (byPos !== 0) {
        return byPos;
      }
      return Number(right.approved) - Number(left.approved);
    });

  return {
    coverageKind: STRUCTURED_AUTHORITY_KIND,
    source: "ASD-STE100 Issue 9",
    issue: "9",
    entryCount: entries.length,
    entries,
  };
}

/**
 * Parse private structured lexical authority bytes.
 *
 * Parameters
 * ----------
 * bytes : Buffer
 *     JSON authority payload.
 *
 * Returns
 * -------
 * StructuredLexicalAuthority
 *
 * Example
 * -------
 * parseStructuredLexicalAuthority(Buffer.from(JSON.stringify(auth)))
 */
export function parseStructuredLexicalAuthority(bytes: Buffer): StructuredLexicalAuthority {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new StructuredLexicalAuthorityError("`structured` `lexical` `authority` `is` opaque");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new StructuredLexicalAuthorityError("`structured` `lexical` `authority` `is` opaque");
  }
  const body = parsed as {
    coverageKind?: unknown;
    source?: unknown;
    issue?: unknown;
    entryCount?: unknown;
    entries?: unknown;
  };
  if (body.coverageKind !== STRUCTURED_AUTHORITY_KIND) {
    throw new StructuredLexicalAuthorityError("`structured` `lexical` `authority` kind `is` invalid");
  }
  if (body.source !== "ASD-STE100 Issue 9" || body.issue !== "9") {
    throw new StructuredLexicalAuthorityError("`structured` `lexical` `authority` provenance `is` invalid");
  }
  if (!Array.isArray(body.entries)) {
    throw new StructuredLexicalAuthorityError("`structured` `lexical` `authority` entries `are` missing");
  }
  const entries: Array<StructuredLexicalEntry> = [];
  for (const row of body.entries) {
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      throw new StructuredLexicalAuthorityError("`structured` `lexical` `authority` entry `is` malformed");
    }
    const entry = row as Partial<StructuredLexicalEntry>;
    if (
      typeof entry.id !== "string" ||
      typeof entry.lemma !== "string" ||
      typeof entry.pos !== "string" ||
      typeof entry.approved !== "boolean" ||
      typeof entry.multiWord !== "boolean" ||
      !Array.isArray(entry.forms) ||
      !Array.isArray(entry.meaningDigests) ||
      !Array.isArray(entry.sourcePages) ||
      entry.forms.some((form) => typeof form !== "string") ||
      entry.meaningDigests.some((value) => typeof value !== "string") ||
      entry.sourcePages.some((page) => typeof page !== "number")
    ) {
      throw new StructuredLexicalAuthorityError("`structured` `lexical` `authority` entry `is` malformed");
    }
    if (entry.forms.length === 0) {
      throw new StructuredLexicalAuthorityError("`structured` `lexical` `authority` forms `are` missing");
    }
    entries.push({
      id: entry.id,
      lemma: entry.lemma,
      approved: entry.approved,
      pos: entry.pos,
      forms: [...entry.forms],
      meaningDigests: [...entry.meaningDigests],
      multiWord: entry.multiWord,
      sourcePages: [...entry.sourcePages],
    });
  }
  if (body.entryCount !== entries.length) {
    throw new StructuredLexicalAuthorityError("`structured` `lexical` `authority` entryCount `is` invalid");
  }
  return {
    coverageKind: STRUCTURED_AUTHORITY_KIND,
    source: "ASD-STE100 Issue 9",
    issue: "9",
    entryCount: entries.length,
    entries,
  };
}

/**
 * Load digest-pinned private structured lexical authority.
 *
 * Parameters
 * ----------
 * filePath : string
 *     Private filesystem path.
 * expectedSha256 : string
 *     Profile pin.
 *
 * Returns
 * -------
 * StructuredLexicalAuthority
 *
 * Example
 * -------
 * loadStructuredLexicalAuthority({ filePath, expectedSha256 })
 */
export function loadStructuredLexicalAuthority(input: {
  filePath: string;
  expectedSha256: string;
}): StructuredLexicalAuthority {
  if (!existsSync(input.filePath)) {
    throw new StructuredLexicalAuthorityError("`structured` `lexical` `authority` `is` missing");
  }
  const bytes = readFileSync(input.filePath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== input.expectedSha256) {
    throw new StructuredLexicalAuthorityError("`structured` `lexical` `authority` digest `does` not `match`");
  }
  return parseStructuredLexicalAuthority(bytes);
}

/**
 * Approved verb and adjective forms from structured authority.
 *
 * Parameters
 * ----------
 * authority : StructuredLexicalAuthority
 *
 * Returns
 * -------
 * Set<string>
 *
 * Example
 * -------
 * approvedFormsSet(authority).has("qzvsteremoved")
 */
export function approvedFormsSet(authority: StructuredLexicalAuthority): Set<string> {
  const forms = new Set<string>();
  for (const entry of authority.entries) {
    if (!entry.approved) {
      continue;
    }
    if (entry.pos !== "v" && entry.pos !== "adj") {
      continue;
    }
    for (const form of entry.forms) {
      forms.add(form.toLowerCase());
    }
  }
  return forms;
}

export function approvedLemmaPosMap(
  authority: StructuredLexicalAuthority,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const entry of authority.entries) {
    if (!entry.approved) {
      continue;
    }
    const set = map.get(entry.lemma) ?? new Set<string>();
    set.add(entry.pos);
    map.set(entry.lemma, set);
  }
  return map;
}

function tokenize(text: string): Array<{ token: string; index: number }> {
  const parts: Array<{ token: string; index: number }> = [];
  const re = new RegExp(TOKEN.source, TOKEN.flags);
  let match: RegExpExecArray | null = re.exec(text);
  while (match !== null) {
    parts.push({ token: match[0], index: match.index });
    match = re.exec(text);
  }
  return parts;
}

/**
 * Mechanical Rule 1.4 gate: require pinned structured authority.
 *
 * Approved verb and adjective forms are enforced by expanding Rule 1.1
 * membership with `approvedFormsSet`. This checker fails closed when that
 * authority is absent and rejects non-approved verb/adjective heads that are
 * not also approved lemmas or approved forms. It does not invent English
 * morphology for missing forms.
 */
export function checkApprovedForms(input: {
  path: string;
  line: number;
  column: number;
  text: string;
  authority: StructuredLexicalAuthority;
}): Array<Finding> {
  const approvedLemmas = new Set(
    input.authority.entries.filter((entry) => entry.approved).map((entry) => entry.lemma),
  );
  const approvedForms = approvedFormsSet(input.authority);
  const nonApprovedOnly = new Set(
    input.authority.entries
      .filter((entry) => !entry.approved && (entry.pos === "v" || entry.pos === "adj"))
      .map((entry) => entry.lemma)
      .filter((lemma) => !approvedLemmas.has(lemma) && !approvedForms.has(lemma)),
  );
  const findings: Array<Finding> = [];
  for (const part of tokenize(input.text)) {
    const key = part.token.toLowerCase();
    if (!nonApprovedOnly.has(key)) {
      continue;
    }
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "ASD-STE100-1.4",
      message: `keep "${part.token}" out of the approved \`forms\`.`,
    });
  }
  return findings;
}

/**
 * Mechanical Rule 1.2 subset for determinate article→noun positions.
 *
 * Parameters
 * ----------
 * input.path, line, column, text, authority
 *
 * Returns
 * -------
 * Array<Finding>
 *
 * Example
 * -------
 * checkApprovedPartOfSpeech({ path:"x.md", line:1, column:1, text:"Open the qzvsteremove.", authority })
 */
export function checkApprovedPartOfSpeech(input: {
  path: string;
  line: number;
  column: number;
  text: string;
  authority: StructuredLexicalAuthority;
}): Array<Finding> {
  const posMap = approvedLemmaPosMap(input.authority);
  const findings: Array<Finding> = [];
  const parts = tokenize(input.text);
  for (let index = 0; index < parts.length - 1; index += 1) {
    const determiner = parts[index]?.token.toLowerCase();
    const next = parts[index + 1];
    if (determiner === undefined || next === undefined) {
      continue;
    }
    if (!DETERMINERS.has(determiner)) {
      continue;
    }
    const lemma = next.token.toLowerCase();
    const poses = posMap.get(lemma);
    if (poses === undefined) {
      continue;
    }
    if (poses.size !== 1) {
      continue;
    }
    if (!poses.has("v")) {
      continue;
    }
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "ASD-STE100-1.2",
      message: `keep "${next.token}" as the approved \`part\` of \`speech\`.`,
    });
  }
  return findings;
}

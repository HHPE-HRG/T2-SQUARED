import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface AsdRuleMapping {
  id: string;
  maxWords?: number;
  maxSentences?: number;
  reviewed: boolean;
  checker?: string;
  authorId?: string | null;
  reviewerId?: string | null;
  sourcePages?: Array<number>;
}

export interface AsdProfile {
  issue: string;
  vocabularySha256: string;
  claim: string;
  vocabularyReview?: "pending-human" | "human-verified";
  rules?: Array<AsdRuleMapping>;
}

export interface TechnicalTerm {
  term: string;
  kind: "noun" | "verb";
  reviewed: boolean;
}

export interface LoadedVocabulary {
  officialPresent: boolean;
  syntheticWords: Array<string>;
}

export class VocabularyMissingError extends Error {
  override readonly name = "VocabularyMissingError";
  constructor() {
    super("private vocabulary file is missing");
  }
}

export class VocabularyChecksumMismatchError extends Error {
  override readonly name = "VocabularyChecksumMismatchError";
  constructor() {
    super("private vocabulary checksum does not match the pinned digest");
  }
}

export class ProfileValidationError extends Error {
  override readonly name = "ProfileValidationError";
  constructor(message: string) {
    super(message);
  }
}

export class VocabularyOpaqueError extends Error {
  override readonly name = "VocabularyOpaqueError";
  constructor() {
    super("official vocabulary is opaque and cannot be parsed as a words JSON list");
  }
}

export class VocabularyEmptyError extends Error {
  override readonly name = "VocabularyEmptyError";
  constructor() {
    super("official vocabulary words array is empty");
  }
}

export class VocabularyExtractDigestMismatchError extends Error {
  override readonly name = "VocabularyExtractDigestMismatchError";
  constructor() {
    super("private extract digest does not match coverage");
  }
}

export class VocabularyLemmaCountMismatchError extends Error {
  override readonly name = "VocabularyLemmaCountMismatchError";
  constructor() {
    super("private extract lemma count does not match coverage");
  }
}

export interface PrivateLexiconCoverageRecord {
  class: "private_lexicon";
  startPage: number;
  endPage: number;
  lemmaCount: number;
  privateExtractDigest: string;
}

function sha256Bytes(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

export function loadVocabulary(input: {
  profile: AsdProfile;
  officialPath: string;
  syntheticPath?: string;
}): LoadedVocabulary {
  if (!existsSync(input.officialPath)) {
    throw new VocabularyMissingError();
  }
  const official = readFileSync(input.officialPath);
  const digest = sha256Bytes(official);
  if (digest !== input.profile.vocabularySha256) {
    throw new VocabularyChecksumMismatchError();
  }
  let syntheticWords: Array<string> = [];
  if (input.syntheticPath !== undefined) {
    const parsed = JSON.parse(readFileSync(input.syntheticPath, "utf8")) as {
      words?: Array<string>;
    };
    if (!Array.isArray(parsed.words) || parsed.words.some((word) => typeof word !== "string")) {
      throw new ProfileValidationError("synthetic vocabulary words must be an array of strings");
    }
    syntheticWords = [...parsed.words];
  }
  return {
    officialPresent: true,
    syntheticWords,
  };
}

export function parseApprovedWordsFromOfficialBytes(bytes: Buffer): Array<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new VocabularyOpaqueError();
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new VocabularyOpaqueError();
  }
  const words = (parsed as { words?: unknown }).words;
  if (!Array.isArray(words) || words.some((word) => typeof word !== "string")) {
    throw new VocabularyOpaqueError();
  }
  if (words.length === 0) {
    throw new VocabularyEmptyError();
  }
  return words;
}

export function deriveRunnerLexiconJson(input: {
  coverage: PrivateLexiconCoverageRecord;
  extractPath: string;
}): string {
  const extract = readFileSync(input.extractPath);
  if (sha256Bytes(extract) !== input.coverage.privateExtractDigest) {
    throw new VocabularyExtractDigestMismatchError();
  }
  const words = extract
    .toString("utf8")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length !== input.coverage.lemmaCount) {
    throw new VocabularyLemmaCountMismatchError();
  }
  const wordsPath = path.join(path.dirname(input.extractPath), "words.json");
  writeFileSync(wordsPath, `${JSON.stringify({ words })}\n`, "utf8");
  return wordsPath;
}

export function validateTechnicalTerms(terms: ReadonlyArray<TechnicalTerm>): void {
  const seen = new Set<string>();
  for (const term of terms) {
    const key = `${term.kind}:${term.term.toLowerCase()}`;
    if (seen.has(key)) {
      throw new ProfileValidationError(`duplicate technical term: ${term.term}`);
    }
    seen.add(key);
    if (!term.reviewed) {
      throw new ProfileValidationError(`unreviewed technical term: ${term.term}`);
    }
  }
}

export function validateProfile(profile: AsdProfile): void {
  if (profile.issue !== "9") {
    throw new ProfileValidationError("profile issue must be 9");
  }
  if (!/^[a-f0-9]{64}$/.test(profile.vocabularySha256)) {
    throw new ProfileValidationError("vocabularySha256 must be a lowercase SHA-256 hex digest");
  }
  if (profile.claim !== "ASD-STE100 mechanical rule-subset result") {
    throw new ProfileValidationError("profile claim must use the mechanical rule-subset statement");
  }
  if (
    profile.vocabularyReview !== undefined &&
    profile.vocabularyReview !== "pending-human" &&
    profile.vocabularyReview !== "human-verified"
  ) {
    throw new ProfileValidationError("vocabularyReview must be pending-human or human-verified");
  }
  for (const rule of profile.rules ?? []) {
    if (!rule.reviewed) {
      throw new ProfileValidationError(`unreviewed ASD rule mapping: ${rule.id}`);
    }
  }
}

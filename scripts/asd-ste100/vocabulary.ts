import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

export interface AsdRuleMapping {
  id: string;
  maxWords?: number;
  reviewed: boolean;
  checker?: string;
}

export interface AsdProfile {
  issue: string;
  vocabularySha256: string;
  claim: string;
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
  for (const rule of profile.rules ?? []) {
    if (!rule.reviewed) {
      throw new ProfileValidationError(`unreviewed ASD rule mapping: ${rule.id}`);
    }
  }
}

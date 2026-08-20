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

export const ANCHOR_STATUSES = [
  "bootstrap-pending",
  "pin-landed-pending-review",
  "reviewed",
] as const;

export type AnchorStatus = (typeof ANCHOR_STATUSES)[number];

export interface AnchorFixtureResult {
  ok: boolean;
  mode: string;
  command: string;
}

export interface AsdAnchor {
  checkerSha: string | null;
  status: AnchorStatus;
  reviewerPrincipal: string | null;
  fixtureResult: AnchorFixtureResult | null;
  protectionActivation: string;
}

export const REGISTERED_SUBJECT_FIELD_IDS = [
  "asd-enforcement",
  "work-registry",
  "t2-platform",
] as const;

// 1.5 classifies the technical-name category. It stays overlay-only, not live G2.
export const TECHNICAL_TERM_CLASSES = {
  "company-name": { kind: "noun", requiredAsdBasis: ["1.5"] },
  "product-name": { kind: "noun", requiredAsdBasis: ["1.5"] },
  "subject-field-noun": { kind: "noun", requiredAsdBasis: ["1.5"] },
  "subject-field-verb": { kind: "verb", requiredAsdBasis: ["1.5"] },
} as const;

export type TechnicalTermClassId = keyof typeof TECHNICAL_TERM_CLASSES;

export type SubjectFieldRegistry = Record<string, { admittedTerms: Array<string> }>;

const LIVE_MECHANICAL_ASD_IDS = new Set(["4.5", "5.1", "6.3", "6.6"]);
const MEMBERSHIP_ASD_ID = "1.1";

export interface TechnicalTerm {
  term: string;
  kind: "noun" | "verb";
  reviewed: boolean;
  concept?: string;
  canonical?: boolean;
  technicalTermClass?: string;
  subjectFields?: Array<string>;
  asdBasis?: Array<string>;
  softwareForms?: {
    typescriptType?: string;
    typescriptValue?: string;
    cli?: string;
  };
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
  const seen = new Set<string>();
  const canonical: Array<string> = [];
  for (const word of words) {
    const key = word.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    canonical.push(key);
  }
  return canonical;
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

function technicalTermQualificationError(term: TechnicalTerm): string | null {
  if (
    term.reviewed !== true ||
    term.canonical !== true ||
    typeof term.concept !== "string" ||
    term.concept.trim().length === 0 ||
    !Array.isArray(term.subjectFields) ||
    term.subjectFields.length === 0 ||
    !term.subjectFields.every((field) => typeof field === "string" && field.trim().length > 0)
  ) {
    return `technical term is not a qualified canonical concept: ${term.term}`;
  }
  if (typeof term.technicalTermClass !== "string" || term.technicalTermClass.length === 0) {
    return `technical term is missing a technical-term class: ${term.term}`;
  }
  const termClass = TECHNICAL_TERM_CLASSES[term.technicalTermClass as TechnicalTermClassId];
  if (termClass === undefined) {
    return `unknown technical-term class: ${term.technicalTermClass}`;
  }
  if (termClass.kind !== term.kind) {
    return `technical-term class does not match kind: ${term.term}`;
  }
  if (
    !Array.isArray(term.asdBasis) ||
    term.asdBasis.length === 0 ||
    !term.asdBasis.every((id) => typeof id === "string" && id.trim().length > 0)
  ) {
    return `technical term is not a qualified canonical concept: ${term.term}`;
  }
  const allowed = new Set(termClass.requiredAsdBasis);
  const impossible = term.asdBasis.some(
    (id) => LIVE_MECHANICAL_ASD_IDS.has(id) || (!allowed.has(id) && id !== MEMBERSHIP_ASD_ID),
  );
  if (impossible) {
    return `impossible asdBasis for ${term.term}`;
  }
  const insufficient =
    term.asdBasis.includes(MEMBERSHIP_ASD_ID) ||
    !termClass.requiredAsdBasis.every((id) => term.asdBasis?.includes(id));
  if (insufficient) {
    return `insufficient asdBasis for ${term.term}`;
  }
  const software = term.softwareForms;
  const forms = [
    software?.typescriptType,
    software?.typescriptValue,
    software?.cli,
  ].filter((value) => typeof value === "string" && value.trim().length > 0);
  if (forms.length === 0) {
    return `technical term is missing software forms: ${term.term}`;
  }
  return null;
}

export function isQualifiedTerm(term: TechnicalTerm): boolean {
  return technicalTermQualificationError(term) === null;
}

function validateSubjectFieldAdmission(
  terms: ReadonlyArray<TechnicalTerm>,
  subjectFields: SubjectFieldRegistry,
): void {
  if (subjectFields === undefined || typeof subjectFields !== "object" || subjectFields === null) {
    throw new ProfileValidationError("subject-field registry is required");
  }
  const registered = new Set<string>(REGISTERED_SUBJECT_FIELD_IDS);
  for (const field of Object.keys(subjectFields)) {
    if (!registered.has(field)) {
      throw new ProfileValidationError(`unknown subject field: ${field}`);
    }
    const admitted = subjectFields[field]?.admittedTerms;
    if (!Array.isArray(admitted)) {
      throw new ProfileValidationError(`subject field ${field} is missing admittedTerms`);
    }
  }
  for (const term of terms) {
    for (const field of term.subjectFields ?? []) {
      if (!registered.has(field)) {
        throw new ProfileValidationError(`unknown subject field: ${field}`);
      }
      const admitted = subjectFields[field]?.admittedTerms;
      if (!Array.isArray(admitted) || !admitted.includes(term.term)) {
        throw new ProfileValidationError(`term is not admitted for subject field: ${term.term}`);
      }
    }
  }
  for (const [field, record] of Object.entries(subjectFields)) {
    for (const name of record.admittedTerms) {
      const hit = terms.find((term) => term.term === name);
      if (hit === undefined) {
        throw new ProfileValidationError(`admitted name has no matching term: ${name}`);
      }
      if (!(hit.subjectFields ?? []).includes(field)) {
        throw new ProfileValidationError(`term is not admitted for subject field: ${name}`);
      }
    }
  }
}

export function validateTechnicalTerms(
  terms: ReadonlyArray<TechnicalTerm>,
  subjectFields: SubjectFieldRegistry = {},
): void {
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
  for (const term of terms) {
    const qualificationError = technicalTermQualificationError(term);
    if (qualificationError !== null) {
      throw new ProfileValidationError(qualificationError);
    }
    const canonical = term.term.toLowerCase();
    const formKeys = new Set<string>([canonical]);
    const software = term.softwareForms;
    if (software === undefined) {
      continue;
    }
    for (const value of [software.typescriptType, software.typescriptValue, software.cli]) {
      if (value === undefined || value.length === 0) {
        continue;
      }
      const formKey = value.toLowerCase();
      if (formKeys.has(formKey)) {
        throw new ProfileValidationError(`case-duplicate software form: ${value}`);
      }
      formKeys.add(formKey);
    }
  }
  validateSubjectFieldAdmission(terms, subjectFields);
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

export function validateAnchor(anchor: AsdAnchor): void {
  if (!ANCHOR_STATUSES.includes(anchor.status)) {
    throw new ProfileValidationError("anchor status is not a known value");
  }
  if (anchor.protectionActivation !== "after-workflow-dispatch-validation") {
    throw new ProfileValidationError(
      "protection activation stays after-workflow-dispatch-validation",
    );
  }
  if (anchor.status === "bootstrap-pending") {
    throw new ProfileValidationError(
      "anchor must not stay bootstrap-pending after the Issue 9 pin",
    );
  }
  if (anchor.checkerSha === null || !/^[0-9a-f]{40}$/.test(anchor.checkerSha)) {
    throw new ProfileValidationError("anchor checkerSha must be a 40-character lowercase git SHA");
  }
  if (anchor.fixtureResult === null || anchor.fixtureResult.ok !== true) {
    throw new ProfileValidationError("anchor fixtureResult must record a passing fixture run");
  }
  if (anchor.fixtureResult.command !== "npm run ci:asd-ste100") {
    throw new ProfileValidationError("anchor fixtureResult command must be npm run ci:asd-ste100");
  }
  if (anchor.status === "pin-landed-pending-review" && anchor.reviewerPrincipal !== null) {
    throw new ProfileValidationError(
      "pin-landed-pending-review must leave reviewer principal empty",
    );
  }
  if (
    anchor.status === "reviewed" &&
    (anchor.reviewerPrincipal === null || anchor.reviewerPrincipal.length === 0)
  ) {
    throw new ProfileValidationError("reviewed anchor needs a reviewer principal");
  }
}

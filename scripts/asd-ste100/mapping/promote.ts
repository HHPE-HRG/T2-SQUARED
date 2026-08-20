import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { validateProfile, type AsdProfile, type AsdRuleMapping } from "../vocabulary.ts";
import { scanMappingLeak, type MappingLeakScan, type MappingRow } from "./merge.ts";

export interface MappingReview {
  authorId: string;
  reviewerId: string;
  reviewNotes: string | null;
}

export interface MappingIdentity {
  id: string;
  principal: string;
  kind: "human" | "agent";
}

export type MappingProviderKind = "git-host" | "network" | "review-portal";

export interface MappingProvider {
  id: string;
  kind: MappingProviderKind;
}

export interface MappingCredential {
  id: string;
  provider: string;
  subject: string;
}

export interface MappingProfile {
  id: string;
  kind: "human" | "agent";
  principal: string;
  credentials: Array<MappingCredential>;
}

export interface MappingPrincipalsFile {
  selfSignWhenHumanCountBelow?: number;
  selfSignWhenHumanProfileCountBelow?: number;
  providers?: Array<MappingProvider>;
  profiles?: Array<MappingProfile>;
  identities: Array<MappingIdentity>;
}

export const MAPPING_PRINCIPALS_PATH = "scripts/asd-ste100/mapping/records/principals.json";
export const DEFAULT_SELF_SIGN_HUMAN_THRESHOLD = 2;
export const SELF_SIGN_REVIEW_NOTE = "KTD28 self-sign: single operator";
const PROVIDER_KINDS = new Set<MappingProviderKind>(["git-host", "network", "review-portal"]);
const CREDENTIAL_KEYS = new Set(["id", "provider", "subject"]);
const SECRET_CREDENTIAL_KEYS = new Set([
  "password",
  "token",
  "pat",
  "secret",
  "privateKey",
  "private_key",
  "apiKey",
  "api_key",
]);

export interface PrivateLexiconCoverage {
  class: "private_lexicon";
  startPage: number;
  endPage: number;
  lemmaCount: number;
  privateExtractDigest: string;
}

function collectStrings(value: unknown): Array<string> {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

function hasWordListPayload(value: unknown): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => hasWordListPayload(entry));
  }
  const record = value as Record<string, unknown>;
  if ("words" in record) {
    return true;
  }
  return Object.values(record).some((entry) => hasWordListPayload(entry));
}

function digestUtf8(contents: string): string {
  return createHash("sha256").update(contents, "utf8").digest("hex");
}

export function markMappingReviewed(
  row: MappingRow,
  review: MappingReview,
  options: { allowSelfSign?: boolean } = {},
): MappingRow {
  if (row.class !== "deterministic" && row.class !== "fail_closed_uncheckable") {
    throw new Error("only deterministic or fail_closed_uncheckable rows accept review");
  }
  if (review.reviewerId.length === 0) {
    throw new Error("reviewed:true requires a reviewerId");
  }
  const sameReviewer = review.reviewerId === review.authorId;
  const sameRowAuthor =
    row.authorId !== undefined && row.authorId !== null && review.reviewerId === row.authorId;
  if ((sameReviewer || sameRowAuthor) && options.allowSelfSign !== true) {
    throw new Error("self-review is not permitted; reviewerId must be distinct from author");
  }
  return {
    ...row,
    reviewed: true,
    authorId: review.authorId,
    reviewerId: review.reviewerId,
    reviewNotes: review.reviewNotes,
  };
}

function identityById(
  identities: ReadonlyArray<MappingIdentity>,
  id: string,
): MappingIdentity | undefined {
  return identities.find((entry) => entry.id === id);
}

export function loadMappingPrincipalsFile(root: string): MappingPrincipalsFile {
  const filePath = path.join(root, MAPPING_PRINCIPALS_PATH);
  if (!existsSync(filePath)) {
    return { identities: [] };
  }
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as MappingPrincipalsFile;
  return {
    selfSignWhenHumanCountBelow: parsed.selfSignWhenHumanCountBelow,
    selfSignWhenHumanProfileCountBelow: parsed.selfSignWhenHumanProfileCountBelow,
    providers: parsed.providers ?? [],
    profiles: parsed.profiles ?? [],
    identities: parsed.identities ?? [],
  };
}

export function loadMappingPrincipals(root: string): Array<MappingIdentity> {
  return loadMappingPrincipalsFile(root).identities;
}

export function humanIdentityCount(identities: ReadonlyArray<MappingIdentity>): number {
  return identities.filter((entry) => entry.kind === "human").length;
}

export function humanProfileCount(file: MappingPrincipalsFile): number {
  if (file.profiles !== undefined && file.profiles.length > 0) {
    return file.profiles.filter((entry) => entry.kind === "human").length;
  }
  return humanIdentityCount(file.identities);
}

export function selfSignAllowed(
  identities: ReadonlyArray<MappingIdentity>,
  humanCountBelow: number = DEFAULT_SELF_SIGN_HUMAN_THRESHOLD,
  profiles?: ReadonlyArray<MappingProfile>,
): boolean {
  if (profiles !== undefined && profiles.length > 0) {
    return profiles.filter((entry) => entry.kind === "human").length < humanCountBelow;
  }
  return humanIdentityCount(identities) < humanCountBelow;
}

export function selfSignMode(file: MappingPrincipalsFile): "self-sign" | "co-sign" {
  const threshold =
    file.selfSignWhenHumanProfileCountBelow ??
    file.selfSignWhenHumanCountBelow ??
    DEFAULT_SELF_SIGN_HUMAN_THRESHOLD;
  return selfSignAllowed(file.identities, threshold, file.profiles) ? "self-sign" : "co-sign";
}

export function validateMappingPrincipals(file: MappingPrincipalsFile): void {
  const providers = file.providers ?? [];
  const profiles = file.profiles ?? [];
  const providerIds = new Set<string>();
  for (const provider of providers) {
    if (typeof provider.id !== "string" || provider.id.length === 0) {
      throw new Error("provider id is required");
    }
    if (!PROVIDER_KINDS.has(provider.kind)) {
      throw new Error(`unknown provider kind: ${provider.kind}`);
    }
    if (providerIds.has(provider.id)) {
      throw new Error(`duplicate provider id: ${provider.id}`);
    }
    providerIds.add(provider.id);
  }
  const profileIds = new Set<string>();
  const credentialIds = new Set<string>();
  for (const profile of profiles) {
    if (typeof profile.id !== "string" || profile.id.length === 0) {
      throw new Error("profile id is required");
    }
    if (profile.kind !== "human" && profile.kind !== "agent") {
      throw new Error(`unknown profile kind: ${profile.kind}`);
    }
    if (typeof profile.principal !== "string" || profile.principal.length === 0) {
      throw new Error("profile principal is required");
    }
    if (profileIds.has(profile.id)) {
      throw new Error(`duplicate profile id: ${profile.id}`);
    }
    profileIds.add(profile.id);
    const credentials = profile.credentials ?? [];
    if (profile.kind === "human" && credentials.length === 0) {
      throw new Error("human profile needs a credential");
    }
    for (const credential of credentials as Array<Record<string, unknown>>) {
      const extraKeys = Object.keys(credential);
      for (const key of extraKeys) {
        if (SECRET_CREDENTIAL_KEYS.has(key)) {
          throw new Error(`credential secret field is not permitted: ${key}`);
        }
        if (!CREDENTIAL_KEYS.has(key)) {
          throw new Error(`unknown credential field: ${key}`);
        }
      }
      const id = credential.id;
      const provider = credential.provider;
      const subject = credential.subject;
      if (typeof id !== "string" || id.length === 0) {
        throw new Error("credential id is required");
      }
      if (typeof provider !== "string" || provider.length === 0) {
        throw new Error("credential provider is required");
      }
      if (typeof subject !== "string" || subject.length === 0) {
        throw new Error("credential subject is required");
      }
      if (!providerIds.has(provider)) {
        throw new Error(`unknown credential provider: ${provider}`);
      }
      if (credentialIds.has(id)) {
        throw new Error(`duplicate credential id: ${id}`);
      }
      credentialIds.add(id);
    }
  }
}

export function reviewOfficialMappingRows(
  rows: ReadonlyArray<MappingRow>,
  review: MappingReview,
  identities: ReadonlyArray<MappingIdentity>,
  profiles?: ReadonlyArray<MappingProfile>,
): Array<MappingRow> {
  const author = identityById(identities, review.authorId);
  const reviewer = identityById(identities, review.reviewerId);
  if (author === undefined) {
    throw new Error("author principal cannot resolve");
  }
  if (reviewer === undefined) {
    throw new Error("reviewer principal cannot resolve");
  }
  if (reviewer.kind !== "human") {
    throw new Error("KTD28 reviewer must be human");
  }
  const allowSelfSign = selfSignAllowed(identities, DEFAULT_SELF_SIGN_HUMAN_THRESHOLD, profiles);
  if (author.principal === reviewer.principal && !allowSelfSign) {
    throw new Error("author principal must differ from reviewer principal");
  }
  const notes =
    author.principal === reviewer.principal
      ? review.reviewNotes && /self-sign/i.test(review.reviewNotes)
        ? review.reviewNotes
        : SELF_SIGN_REVIEW_NOTE
      : review.reviewNotes;
  const stamped: MappingReview = { ...review, reviewNotes: notes };
  return rows.map((row) => {
    if (row.class === "private_lexicon") {
      return {
        ...row,
        reviewed: false,
        reviewerId: null,
        reviewNotes: null,
      };
    }
    return markMappingReviewed(row, stamped, { allowSelfSign });
  });
}

function mappingRowToLiveRule(row: MappingRow): AsdRuleMapping {
  if (row.class !== "deterministic") {
    throw new Error(`only reviewed deterministic rows enter live profile rules: ${row.id}`);
  }
  if (!row.reviewed) {
    throw new Error(`unreviewed ASD rule mapping: ${row.id}`);
  }
  if (row.reviewerId === null || row.reviewerId.length === 0) {
    throw new Error(`reviewed:true requires a distinct reviewerId: ${row.id}`);
  }
  return {
    id: row.id,
    reviewed: true,
    checker: row.proposedCheckerId,
    authorId: row.authorId ?? null,
    reviewerId: row.reviewerId,
    sourcePages: [...row.sourcePages],
  };
}

export function attachMappingRule(profile: AsdProfile, row: MappingRow): AsdProfile {
  const rule = mappingRowToLiveRule(row);
  const next: AsdProfile = {
    ...profile,
    rules: [...(profile.rules ?? []).filter((existing) => existing.id !== rule.id), rule],
  };
  validateProfile(next);
  return next;
}

export function promoteMappingToProfile(
  profile: AsdProfile,
  rows: ReadonlyArray<MappingRow>,
): AsdProfile {
  const byId = new Map((profile.rules ?? []).map((rule) => [rule.id, { ...rule }]));
  for (const row of rows) {
    if (row.class !== "deterministic" || !row.reviewed) {
      continue;
    }
    const rule = mappingRowToLiveRule(row);
    byId.set(rule.id, rule);
  }
  const next: AsdProfile = {
    ...profile,
    rules: [...byId.values()],
  };
  validateProfile(next);
  return next;
}

export function coverageFromPrivateLexicon(input: {
  rows: ReadonlyArray<MappingRow>;
  startPage: number;
  endPage: number;
  lemmaCount: number;
  privateExtract: string;
}): PrivateLexiconCoverage {
  for (const row of input.rows) {
    if (row.class !== "private_lexicon") {
      throw new Error(
        `coverageFromPrivateLexicon requires private_lexicon rows (got ${row.class})`,
      );
    }
  }
  const leak = scanMappingLeak(input.rows);
  if (!leak.ok) {
    throw new Error(leak.reason);
  }
  return {
    class: "private_lexicon",
    startPage: input.startPage,
    endPage: input.endPage,
    lemmaCount: input.lemmaCount,
    privateExtractDigest: digestUtf8(input.privateExtract),
  };
}

export function scanCoverageLeak(record: unknown): MappingLeakScan {
  if (hasWordListPayload(record)) {
    return { ok: false, reason: "word-list payload in coverage record" };
  }
  const blob = collectStrings(record).join("\n");
  const asRow: MappingRow = {
    id: "coverage",
    class: "private_lexicon",
    sourcePages: [1],
    proposedCheckerId: blob,
    reviewed: false,
    authorId: null,
    reviewerId: null,
    reviewNotes: null,
  };
  return scanMappingLeak([asRow]);
}

export function writePrivateLexiconCoverage(
  coverage: PrivateLexiconCoverage | Record<string, unknown>,
  outputDir: string,
): string {
  const scan = scanCoverageLeak(coverage);
  if (!scan.ok) {
    throw new Error(scan.reason);
  }
  const target = path.join(outputDir, "coverage.json");
  writeFileSync(target, `${JSON.stringify(coverage, null, 2)}\n`, "utf8");
  return target;
}

export const LIVE_MAPPING_RECORDS_PATH = "scripts/asd-ste100/mapping/records/records.json";

export function loadLiveMappingRecords(root: string): Array<MappingRow> {
  const filePath = path.join(root, LIVE_MAPPING_RECORDS_PATH);
  if (!existsSync(filePath)) {
    return [];
  }
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
    rows?: Array<MappingRow>;
  };
  return parsed.rows ?? [];
}

export function assertReviewedRulesHaveMappingRecords(
  rules: ReadonlyArray<AsdRuleMapping>,
  records: ReadonlyArray<MappingRow>,
): void {
  for (const rule of rules) {
    if (!rule.reviewed) {
      continue;
    }
    const row = records.find((entry) => entry.id === rule.id);
    if (row === undefined) {
      throw new Error(`reviewed ASD rule mapping has no mapping record: ${rule.id}`);
    }
    if (row.reviewerId === null || row.reviewerId.length === 0) {
      throw new Error(`reviewed:true requires a distinct reviewerId: ${rule.id}`);
    }
  }
}

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

export function markMappingReviewed(row: MappingRow, review: MappingReview): MappingRow {
  if (row.class !== "deterministic" && row.class !== "fail_closed_uncheckable") {
    throw new Error("only deterministic or fail_closed_uncheckable rows accept review");
  }
  if (review.reviewerId.length === 0) {
    throw new Error("reviewed:true requires a reviewerId");
  }
  if (review.reviewerId === review.authorId) {
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

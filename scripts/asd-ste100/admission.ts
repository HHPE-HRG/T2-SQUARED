import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { MappingRow } from "./mapping/merge.ts";
import {
  CLASSIFICATION_LEDGER_PATH,
  ENFORCEMENT_OVERLAY_PATH,
  WRITING_RULE_IDS,
} from "./mapping/completeness.ts";
import {
  ENFORCEMENT_CLASSES,
  enforcementClassFor,
  type EnforcementClass,
} from "./mapping/enforcement-class.ts";
import { loadLiveMappingRecords } from "./mapping/promote.ts";
import { validateOverride } from "./override.ts";
import type { ProposedOverride, CurrentFinding } from "./override.ts";
import type { ForgejoPull, ForgejoReview, ReviewerRoster } from "./forgejo.ts";
import type { Finding } from "./rules.ts";

export const UNCHECKABLE_ADMISSION_ID = "T2-ADMISSION-uncheckable";
export const REVIEW_REQUIRED_ADMISSION_ID = "T2-ADMISSION-review-required";
export const UNPROMOTED_ADMISSION_ID = "T2-ADMISSION-unpromoted";
export const RULE_REVIEWS_PATH = "scripts/asd-ste100/mapping/records/rule-reviews.json";

export interface UncheckableOverrideInput {
  pull: ForgejoPull;
  review: ForgejoReview;
  roster: ReviewerRoster;
  mergeBaseRoster: ReviewerRoster;
  proposed: ProposedOverride;
  currentFindings: Array<CurrentFinding>;
  changedPaths: Array<string>;
}

export interface UncheckableAdmission {
  ok: boolean;
  reason: string;
  findings: Array<Finding>;
}

export interface RuleReviewEvidence {
  ruleId: string;
  enforcementClass: "human-review" | "contextual/semantic";
  authorId: string;
  reviewerId: string;
  reviewed: true;
  surfacesDigest: string;
  /** Hash of terms/rules/ownership authority that must match for Part 1 and term-bound reviews. */
  authorityDigest: string;
  reviewNotes: string;
  disposition: "applicable-satisfied" | "applicable-vacuous" | "corpus-repaired";
}

export interface RuleReviewsFile {
  coverageKind: "issue9-rule-review-evidence";
  reviews: Array<RuleReviewEvidence>;
}

export interface InventoryAdmissionRow {
  id: string;
  mappingClass: MappingRow["class"];
  enforcementClass: EnforcementClass;
  sourcePages: Array<number>;
  reviewed: boolean;
  authorId: string | null;
  reviewerId: string | null;
}

interface OverlayRow {
  id: string;
  mappingClass: MappingRow["class"];
  enforcementClass: string;
  sourcePages?: Array<number>;
}

function loadJson<T>(root: string, relative: string): T {
  return JSON.parse(readFileSync(path.join(root, relative), "utf8")) as T;
}

function namedUncheckableFailure(row: { id: string }): string {
  return `fail_closed_uncheckable mapping ${row.id} is not admitted without a targeted override from a different principal`;
}

function namedReviewFailure(row: InventoryAdmissionRow): string {
  return `Rule ${row.id} applicability: yes; machine result: not authoritative; required evidence: ${row.enforcementClass} review; evidence present: no; admission: blocked`;
}

function namedUnpromotedFailure(row: InventoryAdmissionRow): string {
  return `Rule ${row.id} is classified ${row.enforcementClass} but is not promoted to a live checker; admission: blocked`;
}

function admissionFinding(ruleId: string, message: string): Finding {
  return {
    path: "admission",
    line: 1,
    column: 1,
    ruleId,
    message,
  };
}

/**
 * Digest governed extract surfaces so review evidence cannot outlive prose changes.
 *
 * Parameters
 * ----------
 * extracts : ReadonlyArray<{ path; line; column; text }>
 *     Owned natural-language extracts from the current head.
 *
 * Returns
 * -------
 * string
 *     Hex SHA-256 of the canonical extract list.
 *
 * Example
 * -------
 * >>> digestGovernedSurfaces([{ path: "a.md", line: 1, column: 1, text: "Run it." }]).length
 * 64
 */
export function digestGovernedSurfaces(
  extracts: ReadonlyArray<{ path: string; line: number; column: number; text: string }>,
): string {
  const rows = extracts
    .map((entry) => ({
      path: entry.path,
      line: entry.line,
      column: entry.column,
      textSha256: createHash("sha256").update(entry.text, "utf8").digest("hex"),
    }))
    .sort((left, right) => {
      const byPath = left.path.localeCompare(right.path);
      if (byPath !== 0) {
        return byPath;
      }
      if (left.line !== right.line) {
        return left.line - right.line;
      }
      return left.column - right.column;
    });
  return createHash("sha256").update(JSON.stringify(rows), "utf8").digest("hex");
}

/**
 * Digest terminology and profile authority outside owned prose extracts.
 *
 * Privileged control files are not in surfacesDigest. This digest still
 * invalidates review when terms or live rule mappings change.
 */
export function digestAdmissionAuthority(root: string): string {
  const parts = [
    "t2.asd-ste100.terms.json",
    "t2.asd-ste100.rules.json",
    "t2.asd-ste100.ownership.json",
    "t2.asd-ste100.json",
  ].map((relative) => {
    const filePath = path.join(root, relative);
    const body = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
    return {
      path: relative,
      sha256: createHash("sha256").update(body, "utf8").digest("hex"),
    };
  });
  return createHash("sha256").update(JSON.stringify(parts), "utf8").digest("hex");
}

export function loadRuleReviews(root: string): RuleReviewsFile {
  if (!existsSync(path.join(root, RULE_REVIEWS_PATH))) {
    return { coverageKind: "issue9-rule-review-evidence", reviews: [] };
  }
  return loadJson<RuleReviewsFile>(root, RULE_REVIEWS_PATH);
}

export function loadInventoryAdmissionRows(root: string): Array<InventoryAdmissionRow> {
  const ledger = loadJson<{ rows?: Array<MappingRow> }>(root, CLASSIFICATION_LEDGER_PATH);
  const overlay = loadJson<{ classes?: Array<OverlayRow> }>(root, ENFORCEMENT_OVERLAY_PATH);
  const rows = ledger.rows ?? [];
  const classes = overlay.classes ?? [];
  const byId = new Map(classes.map((entry) => [entry.id, entry]));
  const out: Array<InventoryAdmissionRow> = [];
  for (const id of WRITING_RULE_IDS) {
    const row = rows.find((entry) => entry.id === id);
    const overlayRow = byId.get(id);
    if (row === undefined || overlayRow === undefined) {
      throw new Error(`missing writing-rule id: ${id}`);
    }
    if (!(ENFORCEMENT_CLASSES as ReadonlyArray<string>).includes(overlayRow.enforcementClass)) {
      throw new Error(`unknown class: ${id}`);
    }
    const expected = enforcementClassFor(id, row.class);
    if (overlayRow.enforcementClass !== expected) {
      throw new Error(`enforcement class mismatch: ${id}`);
    }
    out.push({
      id,
      mappingClass: row.class,
      enforcementClass: overlayRow.enforcementClass as EnforcementClass,
      sourcePages: row.sourcePages,
      reviewed: row.reviewed,
      authorId: row.authorId ?? null,
      reviewerId: row.reviewerId ?? null,
    });
  }
  return out;
}

export function admissionFindingsForRows(rows: ReadonlyArray<MappingRow>): Array<Finding> {
  const findings: Array<Finding> = [];
  for (const row of rows) {
    if (row.class !== "fail_closed_uncheckable") {
      continue;
    }
    findings.push(...admitFailClosedUncheckable({ row }).findings);
  }
  return findings;
}

/**
 * Inventory-wide admission: every applicable Issue 9 id needs a real path.
 *
 * Parameters
 * ----------
 * root : string
 *     Repository root.
 * surfacesDigest : string | null
 *     Current governed-surface digest, or null for structural-only checks.
 * requireDigestMatch : boolean
 *     When true, review evidence must match surfacesDigest.
 *
 * Returns
 * -------
 * Array<Finding>
 *     Non-ASD admission findings only.
 */
export function admissionFindingsForInventory(input: {
  root: string;
  surfacesDigest: string | null;
  authorityDigest?: string | null;
  requireDigestMatch: boolean;
  override?: UncheckableOverrideInput;
}): Array<Finding> {
  const inventory = loadInventoryAdmissionRows(input.root);
  const liveIds = new Set(loadLiveMappingRecords(input.root).map((row) => row.id));
  const reviews = loadRuleReviews(input.root);
  const reviewById = new Map(reviews.reviews.map((entry) => [entry.ruleId, entry]));
  const authorityDigest = input.authorityDigest ?? digestAdmissionAuthority(input.root);
  const findings: Array<Finding> = [];

  for (const row of inventory) {
    if (row.enforcementClass === "not-applicable-to-surface") {
      continue;
    }
    if (
      row.enforcementClass === "deterministic" ||
      row.enforcementClass === "parser-mechanical"
    ) {
      if (!liveIds.has(row.id)) {
        findings.push(admissionFinding(UNPROMOTED_ADMISSION_ID, namedUnpromotedFailure(row)));
      }
      continue;
    }

    const evidence = reviewById.get(row.id);
    const digestOk =
      evidence !== undefined &&
      evidence.reviewed === true &&
      evidence.reviewerId.length > 0 &&
      evidence.authorId.length > 0 &&
      evidence.reviewerId !== evidence.authorId &&
      evidence.enforcementClass === row.enforcementClass &&
      evidence.authorityDigest === authorityDigest &&
      (!input.requireDigestMatch ||
        (input.surfacesDigest !== null && evidence.surfacesDigest === input.surfacesDigest));

    if (digestOk) {
      continue;
    }

    if (row.mappingClass === "fail_closed_uncheckable" && input.override !== undefined) {
      const validated = validateOverride(input.override);
      if (validated.ok) {
        continue;
      }
    }

    findings.push(
      admissionFinding(
        REVIEW_REQUIRED_ADMISSION_ID,
        namedReviewFailure(row),
      ),
    );
  }

  findings.push(...admissionFindingsForRows(loadLiveMappingRecords(input.root)));
  return findings;
}

/**
 * Fixture/structural completeness: every inventory id has a defined admission path.
 * Review-required ids must block when evidence is absent (no silent bypass).
 */
export function assertAdmissionPathsComplete(root: string): void {
  const inventory = loadInventoryAdmissionRows(root);
  const liveIds = new Set(loadLiveMappingRecords(root).map((row) => row.id));
  const reviews = loadRuleReviews(root);
  const reviewById = new Map(reviews.reviews.map((entry) => [entry.ruleId, entry]));
  const digests = new Set(reviews.reviews.map((entry) => entry.surfacesDigest));
  if (digests.size > 1) {
    throw new Error("rule-review evidence must share one surfacesDigest for the reviewed corpus");
  }
  for (const evidence of reviews.reviews) {
    if (!WRITING_RULE_IDS.includes(evidence.ruleId as (typeof WRITING_RULE_IDS)[number])) {
      throw new Error(`unknown rule-review id: ${evidence.ruleId}`);
    }
    if (!evidence.reviewed || evidence.reviewerId === evidence.authorId) {
      throw new Error(`rule-review must use a distinct reviewer: ${evidence.ruleId}`);
    }
    if (evidence.surfacesDigest.trim().length !== 64) {
      throw new Error(`rule-review surfacesDigest invalid: ${evidence.ruleId}`);
    }
    if (evidence.authorityDigest.trim().length !== 64) {
      throw new Error(`rule-review authorityDigest invalid: ${evidence.ruleId}`);
    }
  }
  const blocked = admissionFindingsForInventory({
    root,
    surfacesDigest: "0".repeat(64),
    requireDigestMatch: true,
  });
  const blockedMessages = blocked.map((finding) => finding.message).join("\n");
  for (const row of inventory) {
    if (row.enforcementClass === "not-applicable-to-surface") {
      continue;
    }
    if (
      row.enforcementClass === "deterministic" ||
      row.enforcementClass === "parser-mechanical"
    ) {
      if (!liveIds.has(row.id)) {
        throw new Error(`unpromoted mechanical rule: ${row.id}`);
      }
      continue;
    }
    const evidence = reviewById.get(row.id);
    const evidenceMatches =
      evidence !== undefined &&
      evidence.reviewed === true &&
      evidence.enforcementClass === row.enforcementClass &&
      evidence.surfacesDigest === "0".repeat(64);
    if (evidenceMatches) {
      continue;
    }
    if (!blockedMessages.includes(`Rule ${row.id} `)) {
      throw new Error(`applicable rule can bypass admission: ${row.id}`);
    }
  }
}

export function admitFailClosedUncheckable(input: {
  row: MappingRow;
  override?: UncheckableOverrideInput;
}): UncheckableAdmission {
  if (input.row.class !== "fail_closed_uncheckable") {
    throw new Error(
      `admitFailClosedUncheckable requires fail_closed_uncheckable (got ${input.row.class})`,
    );
  }

  if (input.override !== undefined) {
    const validated = validateOverride(input.override);
    if (validated.ok) {
      return { ok: true, reason: "", findings: [] };
    }
    return { ok: false, reason: validated.reason, findings: [] };
  }

  return {
    ok: false,
    reason: namedUncheckableFailure(input.row),
    findings: [admissionFinding(UNCHECKABLE_ADMISSION_ID, namedUncheckableFailure(input.row))],
  };
}

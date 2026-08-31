/**
 * G2 WORK-000035 disposition checker.
 *
 * Validates the six pin-output rows, capture-point record, and
 * codec-relevant forbidden work. Does not claim language-authority
 * completeness.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const G2_OUTPUT_IDS = [
  "controlled-language-profile",
  "owner-attributed-term-dictionary",
  "typed-semantic-bindings",
  "outward-communication-enforcement",
  "controlled-language-equivalence-fixtures",
  "explicit-enforcement-cutover",
] as const;

export const REQUIRED_FORBIDDEN_WORK = [
  "scm-can-codec",
  "production-encoding",
  "nibble-alphabet",
  "global-dictionary-encoding",
  "encoding-english",
  "encoding-t3-payloads",
  "claiming-g9-semantic-parity",
] as const;

export const G2_NA_APPROVAL_IDENTITIES = ["t2-10000-foot-steward"] as const;
export const G2_REVIEW_IDENTITY = "codex-independent-review";

const G2_STATUSES = new Set(["present", "deferred", "not-applicable"]);
const MANIFEST_STATUSES = new Set([
  "planned-not-authorized",
  "authorized",
  "in-progress",
  "completed",
]);
const SOURCE_VERSION = /^(?:T2-SQUARED-References\/\S+|[\w./-]+#[A-Za-z][\w]*=[A-Za-z0-9._-]+)$/;
const T2_OWNED_PATH = /^[\w./-]+$/;

export interface G2Gap {
  gapId: string;
  steward: string;
  missingCondition: string;
  consequence: string;
  forbiddenWork: string[];
  closureEvidence: string;
}

export interface G2Review {
  status: string;
  identity: string;
  independentOfImplementationAuthor: boolean;
  reviewedArtifactHash: string;
  note?: string;
}

export interface G2Output {
  id: string;
  status: string;
  evidence: string[];
  owner?: string;
  versionIdentity?: string;
  effectiveScope?: string;
  applicableBecause?: string;
  gap?: G2Gap;
  notApplicable?: { rationale: string; steward: string; approvalIdentity?: string };
}

export interface G2Disposition {
  pin: string;
  sourceVersion: string;
  capturePoint: { status: string; description: string };
  outputs: G2Output[];
}

export interface G2Manifest {
  gate: string;
  status: string;
  authorized: boolean;
  completed: boolean;
  doesNotAuthorizeLaterGates: boolean;
  g4toG7Authorized: boolean;
  review?: G2Review;
}

export interface G2Package {
  repoRoot: string;
  manifest: G2Manifest;
  disposition: G2Disposition;
  rationale: string;
}

export interface G2Failure {
  readonly code: string;
  readonly message: string;
}

export type G2CheckResult =
  | { readonly ok: true; readonly forbiddenWork: ReadonlyArray<string> }
  | { readonly ok: false; readonly failures: ReadonlyArray<G2Failure> };

const isNonEmpty = (value: string | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOutputMember = (value: unknown): value is G2Output =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.status === "string" &&
  Array.isArray(value.evidence) &&
  value.evidence.every((item) => typeof item === "string");

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const manifestForHash = (manifest: G2Manifest): unknown => {
  const cloned = structuredClone(manifest);
  if (cloned.review !== undefined) {
    const review = { ...cloned.review };
    delete (review as { reviewedArtifactHash?: string }).reviewedArtifactHash;
    cloned.review = review;
  }
  return cloned;
};

/**
 * Digest G2 artifacts a completion reviewer must approve.
 *
 * README is explanatory and is not included. `review.reviewedArtifactHash`
 * is omitted so the digest is not self-referential.
 *
 * Parameters
 * ----------
 * pkg : G2Package
 *     Loaded G2 package.
 *
 * Returns
 * -------
 * string
 *     SHA-256 hex of the canonical reviewed package.
 *
 * Example
 * -------
 * const digest = computeG2ReviewedArtifactHash(loadG2Package(repoRoot));
 */
export const computeG2ReviewedArtifactHash = (pkg: G2Package): string =>
  createHash("sha256")
    .update(
      [
        canonicalJson(manifestForHash(pkg.manifest)),
        canonicalJson(pkg.disposition),
        pkg.rationale,
      ].join("\n"),
    )
    .digest("hex");

const isExternalPointer = (value: string): boolean =>
  value.startsWith("T2-SQUARED-References/") && !value.includes(" ") && !value.includes("Issue 9:");

const isSourceVersion = (value: string, repoRoot: string): boolean => {
  if (!SOURCE_VERSION.test(value) || value.includes("Issue 9:")) {
    return false;
  }
  if (isExternalPointer(value)) {
    return true;
  }
  const path = value.split("#")[0] ?? "";
  return T2_OWNED_PATH.test(path) && existsSync(join(repoRoot, path));
};

const checkReview = (pkg: G2Package, push: (code: string, message: string) => void): void => {
  const review = pkg.manifest.review;
  if (!isRecord(review)) {
    push("review", "G2 review must name independent Codex review with withheld or approved status");
    return;
  }
  if (pkg.manifest.completed) {
    const digest = computeG2ReviewedArtifactHash(pkg);
    if (
      review.status !== "approved" ||
      review.identity !== G2_REVIEW_IDENTITY ||
      review.independentOfImplementationAuthor !== true ||
      review.reviewedArtifactHash !== digest
    ) {
      push(
        "review",
        "completed G2 requires approved independent review bound to the reviewed-package digest",
      );
    }
  }
};

/**
 * Load the G2 disposition package.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     T2-SQUARED repository root.
 *
 * Returns
 * -------
 * G2Package
 *     Manifest, disposition JSON, and rationale text.
 *
 * Example
 * -------
 * const pkg = loadG2Package(repoRoot);
 */
export const loadG2Package = (repoRoot: string): G2Package => {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g2/manifest.json"), "utf8"),
  ) as G2Manifest;
  const disposition = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g2/work-000035-disposition.json"), "utf8"),
  ) as G2Disposition;
  return {
    repoRoot,
    manifest,
    disposition,
    rationale: readFileSync(join(repoRoot, "docs/scm/g2/rationale.md"), "utf8"),
  };
};

const unionForbidden = (outputs: ReadonlyArray<G2Output>): string[] => {
  const items = new Set<string>();
  for (const row of outputs) {
    for (const item of row.gap?.forbiddenWork ?? []) {
      items.add(item);
    }
  }
  return [...items];
};

const legalManifestTuple = (manifest: G2Manifest): boolean => {
  if (!MANIFEST_STATUSES.has(manifest.status)) {
    return false;
  }
  if (manifest.status === "planned-not-authorized") {
    return manifest.authorized === false && manifest.completed === false;
  }
  if (manifest.status === "authorized" || manifest.status === "in-progress") {
    return manifest.authorized === true && manifest.completed === false;
  }
  return manifest.authorized === true && manifest.completed === true;
};

/**
 * Check G2 pin disposition completeness.
 *
 * Parameters
 * ----------
 * pkg : G2Package
 *     Loaded disposition package.
 *
 * Returns
 * -------
 * G2CheckResult
 *     `ok: true` with derived forbidden work when the six-row record holds.
 *
 * Example
 * -------
 * const result = checkG2Disposition(loadG2Package(repoRoot));
 */
export const checkG2Disposition = (pkg: G2Package): G2CheckResult => {
  const failures: G2Failure[] = [];
  const push = (code: string, message: string) => {
    failures.push({ code, message });
  };

  if (!isRecord(pkg.manifest)) {
    return { ok: false, failures: [{ code: "shape", message: "G2 manifest is missing" }] };
  }
  if (pkg.manifest.gate !== "G2") {
    push("manifest-gate", `expected G2, got ${pkg.manifest.gate}`);
  }
  if (!legalManifestTuple(pkg.manifest)) {
    push(
      "manifest-tuple",
      `illegal tuple status=${pkg.manifest.status} authorized=${String(pkg.manifest.authorized)} completed=${String(pkg.manifest.completed)}`,
    );
  }
  if (!pkg.manifest.doesNotAuthorizeLaterGates || pkg.manifest.g4toG7Authorized) {
    push("later-gates", "G2 must keep doesNotAuthorizeLaterGates true and g4toG7Authorized false");
    if (pkg.manifest.g4toG7Authorized) {
      push("g4-g7-authorized", "this package must not authorize G4-G7");
    }
  }
  checkReview(pkg, push);

  if (
    !isRecord(pkg.disposition) ||
    !isRecord(pkg.disposition.capturePoint) ||
    !Array.isArray(pkg.disposition.outputs)
  ) {
    push("shape", "G2 disposition requires capturePoint and an outputs array");
    return { ok: false, failures };
  }

  if (!pkg.disposition.outputs.every((row) => isOutputMember(row))) {
    push("shape", "G2 outputs members must be objects with id, status, and evidence");
    return { ok: false, failures };
  }

  if (pkg.disposition.pin !== "WORK-000035") {
    push("pin", "pin must be WORK-000035");
  }
  if (!isSourceVersion(pkg.disposition.sourceVersion, pkg.repoRoot)) {
    push(
      "source-version",
      "sourceVersion must be a repo-relative T2 path plus hash/version, or a T2-SQUARED-References pointer",
    );
  }
  if (
    pkg.disposition.capturePoint.status !== "open" ||
    pkg.disposition.capturePoint.description !== "after-governed-translation-before-can-encode"
  ) {
    push(
      "capture-point",
      "capture point must remain open after-governed-translation-before-can-encode",
    );
  }

  const ids = pkg.disposition.outputs.map((row) => row.id);
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.push(id);
    }
    seen.add(id);
  }
  const expected = new Set<string>(G2_OUTPUT_IDS);
  const missing = [...expected].filter((id) => !seen.has(id));
  const unexpected = [...seen].filter((id) => !expected.has(id));
  if (duplicates.length > 0 || missing.length > 0 || unexpected.length > 0) {
    push(
      "output-id-set",
      `output IDs must equal the six pin outputs; missing ${missing.join(", ") || "none"}; unexpected ${unexpected.join(", ") || "none"}; duplicate ${duplicates.join(", ") || "none"}`,
    );
  }

  const ir = pkg.disposition.outputs.find((row) => row.id === "typed-semantic-bindings");
  if (ir === undefined || (ir.status !== "deferred" && ir.status !== "present")) {
    push("typed-ir", "typed IR must be present or explicitly deferred");
  }

  for (const row of pkg.disposition.outputs) {
    if (!G2_STATUSES.has(row.status)) {
      push("status", `${row.id} has unknown status ${row.status}`);
    }
    for (const pointer of row.evidence ?? []) {
      if (
        pointer.includes("Issue 9:") ||
        (!isExternalPointer(pointer) && !T2_OWNED_PATH.test(pointer))
      ) {
        push(
          "restricted-source",
          `${row.id} evidence is not a T2-owned path or approved external pointer`,
        );
        continue;
      }
      if (!isExternalPointer(pointer) && !existsSync(join(pkg.repoRoot, pointer))) {
        push("evidence-path", `${row.id} T2-owned evidence path does not exist: ${pointer}`);
      }
    }
    if (row.status === "present") {
      if (!Array.isArray(row.evidence) || row.evidence.length === 0) {
        push("present-evidence", `${row.id} present requires evidence pointers`);
      }
      if (!isNonEmpty(row.owner) || !isNonEmpty(row.versionIdentity)) {
        push("present-evidence", `${row.id} present requires owner and version identity`);
      }
      if (!isNonEmpty(row.effectiveScope) || !isNonEmpty(row.applicableBecause)) {
        push("present-scope", `${row.id} present requires effectiveScope and applicableBecause`);
      }
    }
    if (row.status === "deferred") {
      const gap = row.gap;
      if (
        !isRecord(gap) ||
        !isNonEmpty(gap.gapId) ||
        !isNonEmpty(gap.steward) ||
        !isNonEmpty(gap.consequence) ||
        !isNonEmpty(gap.missingCondition) ||
        !isNonEmpty(gap.closureEvidence) ||
        !Array.isArray(gap.forbiddenWork) ||
        gap.forbiddenWork.length === 0
      ) {
        push(
          "deferred-gap",
          `${row.id} deferred requires gapId, steward, consequence, forbidden work, and closure evidence`,
        );
      }
    }
    if (row.status === "not-applicable") {
      const na = row.notApplicable;
      if (
        !isNonEmpty(na?.rationale) ||
        !isNonEmpty(na?.steward) ||
        !G2_NA_APPROVAL_IDENTITIES.includes(
          na?.approvalIdentity as (typeof G2_NA_APPROVAL_IDENTITIES)[number],
        )
      ) {
        push(
          "not-applicable",
          `${row.id} not-applicable requires source-law rationale, steward, and A3 approvalIdentity`,
        );
      }
    }
  }

  const derived = unionForbidden(pkg.disposition.outputs);
  if (ir?.status === "deferred") {
    const irBans = new Set(ir.gap?.forbiddenWork ?? []);
    const missingBans = REQUIRED_FORBIDDEN_WORK.filter((item) => !irBans.has(item));
    if (missingBans.length > 0) {
      push("forbidden-work", `typed IR deferral must forbid ${missingBans.join(", ")}`);
    }
  }

  if (pkg.manifest.completed && failures.length > 0) {
    push("completed-unchecked", "completed true is illegal while other failures exist");
  }

  if (failures.length > 0) {
    return { ok: false, failures };
  }
  return { ok: true, forbiddenWork: derived };
};

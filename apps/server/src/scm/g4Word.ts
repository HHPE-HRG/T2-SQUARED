/**
 * G4 W1 word as T2 types.
 *
 * Ethos slots only. No encodings, nibble alphabets, or wire numbers.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
export const CANONICAL_ABSENCE = "canonical-absence" as const;

export const REQUIRED_W1_SLOTS = [
  "bus_id",
  "node_id",
  "fundamental_state",
  "fundamental_request",
  "state_age",
  "request_age",
  "modifier_start",
  "null",
] as const;

const FORBIDDEN_ENCODING_KEYS = new Set([
  "nibble_alphabet",
  "encoding",
  "codec",
  "wire_value",
  "dictionary",
  "byte",
  "bit",
  "nibble",
  "production_encoding",
]);
const REQUIRED_W1_KEY_SET = new Set<string>(REQUIRED_W1_SLOTS);

export interface W1Word {
  readonly bus_id: string;
  readonly node_id: string;
  readonly fundamental_state: string;
  readonly fundamental_request: string;
  readonly state_age: number;
  readonly request_age: number;
  readonly modifier_start: "modifier_start";
  readonly null: "null";
}

export interface W1Failure {
  readonly code: string;
  readonly message: string;
}

export type W1CheckResult =
  | { readonly ok: true; readonly word: W1Word }
  | { readonly ok: false; readonly failures: ReadonlyArray<W1Failure> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isAge = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/**
 * Check a candidate W1 word against G4 type law.
 *
 * Parameters
 * ----------
 * value : unknown
 *     Candidate word object.
 *
 * Returns
 * -------
 * W1CheckResult
 *     `ok: true` with the typed word when ethos slots hold.
 *
 * Example
 * -------
 * const result = checkW1Word({ bus_id: "bus.rpc", node_id: "node.rpc", ... });
 */
export const checkW1Word = (value: unknown): W1CheckResult => {
  const failures: W1Failure[] = [];
  const push = (code: string, message: string) => {
    failures.push({ code, message });
  };
  if (!isRecord(value)) {
    return { ok: false, failures: [{ code: "shape", message: "W1 word must be an object" }] };
  }
  if ("life_age" in value || !("state_age" in value) || !("request_age" in value)) {
    push(
      "w0-age",
      "W1 requires independent state_age and request_age; W0 single life counter is rejected",
    );
  }
  if (!("fundamental_request" in value)) {
    push(
      "w0-request",
      "W1 fundamental_request must always be present; canonical absence is a named value",
    );
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_ENCODING_KEYS.has(key)) {
      push("encoding", "G4 forbids nibble alphabets, codecs, dictionary, and encoding fields");
    } else if (!REQUIRED_W1_KEY_SET.has(key)) {
      push("slot", `unknown W1 field ${key}`);
    }
  }
  if (value.modifier_start !== "modifier_start" || value.null !== "null") {
    push("placeholder", "modifier_start and null are named placeholders with no wire numbers");
  }
  if (
    !isNonEmpty(value.bus_id) ||
    !isNonEmpty(value.node_id) ||
    !isNonEmpty(value.fundamental_state)
  ) {
    push("slot", "bus_id, node_id, and fundamental_state must be non-empty strings");
  }
  if ("fundamental_request" in value && !isNonEmpty(value.fundamental_request)) {
    push(
      "w0-request",
      "fundamental_request must be a non-empty named value, including canonical-absence",
    );
  }
  if ("state_age" in value && !isAge(value.state_age)) {
    push("w0-age", "state_age must be a non-negative integer");
  }
  if ("request_age" in value && !isAge(value.request_age)) {
    push("w0-age", "request_age must be a non-negative integer");
  }
  if (failures.length > 0) {
    return { ok: false, failures };
  }
  return {
    ok: true,
    word: {
      bus_id: value.bus_id,
      node_id: value.node_id,
      fundamental_state: value.fundamental_state,
      fundamental_request: value.fundamental_request,
      state_age: value.state_age,
      request_age: value.request_age,
      modifier_start: "modifier_start",
      null: "null",
    },
  };
};

export const G4_REVIEW_IDENTITY = "codex-independent-review";

const MANIFEST_STATUSES = new Set([
  "planned-not-authorized",
  "authorized",
  "in-progress",
  "completed",
]);

export interface G4Review {
  status: string;
  identity: string;
  independentOfImplementationAuthor: boolean;
  reviewedArtifactHash: string;
  note?: string;
}

export interface G4Authorization {
  identity: string;
  scope: string;
  note: string;
}

export interface G4Manifest {
  gate: string;
  status: string;
  authorized: boolean;
  completed: boolean;
  doesNotAuthorizeLaterGates: boolean;
  g6toG10Authorized: boolean;
  authorization: G4Authorization;
  review?: G4Review;
}

export interface G4Package {
  repoRoot: string;
  manifest: G4Manifest;
}

export interface G4Failure {
  readonly code: string;
  readonly message: string;
}

export type G4CheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failures: ReadonlyArray<G4Failure> };

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

const manifestForHash = (manifest: G4Manifest): unknown => {
  const cloned = structuredClone(manifest);
  if (cloned.review !== undefined) {
    const review = { ...cloned.review };
    delete (review as { reviewedArtifactHash?: string }).reviewedArtifactHash;
    cloned.review = review;
  }
  return cloned;
};

/**
 * Digest G4 artifacts a completion reviewer must approve.
 *
 * README is explanatory and is not included. `review.reviewedArtifactHash`
 * is omitted so the digest is not self-referential.
 *
 * Parameters
 * ----------
 * pkg : G4Package
 *     Loaded G4 package.
 *
 * Returns
 * -------
 * string
 *     SHA-256 hex of the canonical reviewed package.
 *
 * Example
 * -------
 * const digest = computeG4ReviewedArtifactHash(loadG4Package(repoRoot));
 */
export const computeG4ReviewedArtifactHash = (pkg: G4Package): string =>
  createHash("sha256")
    .update(canonicalJson(manifestForHash(pkg.manifest)))
    .digest("hex");

const legalManifestTuple = (manifest: G4Manifest): boolean => {
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
 * Load the G4 W1 type package.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     T2-SQUARED repository root.
 *
 * Returns
 * -------
 * G4Package
 *     Manifest only. README is excluded from the reviewed digest.
 *
 * Example
 * -------
 * const pkg = loadG4Package(repoRoot);
 */
export const loadG4Package = (repoRoot: string): G4Package => ({
  repoRoot,
  manifest: JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g4/manifest.json"), "utf8"),
  ) as G4Manifest,
});

/**
 * Check G4 type-law package completeness.
 *
 * Parameters
 * ----------
 * pkg : G4Package
 *     Loaded G4 package.
 *
 * Returns
 * -------
 * G4CheckResult
 *     `ok: true` when the legal tuple, later-gate barrier, and review bind.
 *
 * Example
 * -------
 * const result = checkG4(loadG4Package(repoRoot));
 */
export const checkG4 = (pkg: G4Package): G4CheckResult => {
  const failures: G4Failure[] = [];
  const push = (code: string, message: string) => {
    failures.push({ code, message });
  };
  if (!isRecord(pkg.manifest) || pkg.manifest.gate !== "G4") {
    push("manifest-gate", "expected G4 package");
  }
  if (!legalManifestTuple(pkg.manifest)) {
    push(
      "manifest-tuple",
      `illegal tuple status=${pkg.manifest.status} authorized=${String(pkg.manifest.authorized)} completed=${String(pkg.manifest.completed)}`,
    );
  }
  if (!pkg.manifest.doesNotAuthorizeLaterGates || pkg.manifest.g6toG10Authorized) {
    push("later-gates", "G4 must keep doesNotAuthorizeLaterGates true and g6toG10Authorized false");
  }
  const review = pkg.manifest.review;
  if (!isRecord(review)) {
    push("review", "G4 review must name independent Codex review with withheld or approved status");
  } else if (pkg.manifest.completed) {
    const digest = computeG4ReviewedArtifactHash(pkg);
    if (
      review.status !== "approved" ||
      review.identity !== G4_REVIEW_IDENTITY ||
      review.independentOfImplementationAuthor !== true ||
      review.reviewedArtifactHash !== digest
    ) {
      push(
        "review",
        "completed G4 requires approved independent review bound to the reviewed-package digest",
      );
    }
  }
  if (failures.length > 0) {
    return { ok: false, failures };
  }
  return { ok: true };
};

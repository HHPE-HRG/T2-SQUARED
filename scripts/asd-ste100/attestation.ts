import { createHash } from "node:crypto";

import { parseApprovedWordsFromOfficialBytes } from "./vocabulary.ts";

export interface RuleSubsetAttestation {
  kind: "rule-subset attestation";
  claim: "ASD-STE100 mechanical rule-subset result";
  sourceSha: string;
  upstreamSha: string;
  ownershipSha256: string;
  corpusSha256: string;
  vocabularySha256: string;
  profileIssue: string;
  ruleCoverage: Array<string>;
  authorIds: Array<number>;
  reviewerIds: Array<number>;
  findings: Array<unknown>;
  overrides: Array<unknown>;
  aggregateOk: boolean;
  generatedAt: string;
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeys(record[key])]),
    );
  }
  return value;
}

export function digestCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

export function attestationFilename(digest: string): string {
  return `${digest}.json`;
}

export function buildAttestation(input: {
  sourceSha: string;
  upstreamSha: string;
  ownershipSha256: string;
  corpusSha256: string;
  vocabularySha256: string;
  profileIssue: string;
  ruleCoverage: Array<string>;
  authorIds: Array<number>;
  reviewerIds: Array<number>;
  findings: Array<Finding> | Array<unknown>;
  overrides: Array<unknown>;
  aggregateOk: boolean;
  generatedAt: string;
}): RuleSubsetAttestation {
  return {
    kind: "rule-subset attestation",
    claim: "ASD-STE100 mechanical rule-subset result",
    sourceSha: input.sourceSha,
    upstreamSha: input.upstreamSha,
    ownershipSha256: input.ownershipSha256,
    corpusSha256: input.corpusSha256,
    vocabularySha256: input.vocabularySha256,
    profileIssue: input.profileIssue,
    ruleCoverage: [...input.ruleCoverage],
    authorIds: [...input.authorIds],
    reviewerIds: [...input.reviewerIds],
    findings: [...input.findings],
    overrides: [...input.overrides],
    aggregateOk: input.aggregateOk,
    generatedAt: input.generatedAt,
  };
}

/** Whole-file dumps only. One official lemma in source text is not a leak. */
function dumpNeedles(official: string): Array<string> {
  const needles = new Set<string>();
  needles.add(official);
  const trimmed = official.trim();
  if (trimmed.length > 0) {
    needles.add(trimmed);
  }
  try {
    const words = parseApprovedWordsFromOfficialBytes(Buffer.from(official, "utf8"));
    needles.add(JSON.stringify({ words }));
    needles.add(`${JSON.stringify({ words })}\n`);
    needles.add(JSON.stringify(words));
  } catch {
    // Opaque bytes still use the whole-file needle.
  }
  return [...needles].filter((needle) => needle.length > 0);
}

export function scanForVocabularyLeak(input: {
  texts: Array<string>;
  officialBytes: Buffer | string | null;
}): { ok: boolean; reason: string } {
  if (input.officialBytes === null) {
    return { ok: false, reason: "leak scan unavailable" };
  }
  const official =
    typeof input.officialBytes === "string"
      ? input.officialBytes
      : input.officialBytes.toString("utf8");
  if (official.trim().length === 0) {
    return { ok: false, reason: "leak scan unavailable" };
  }
  const needles = dumpNeedles(official);
  for (const text of input.texts) {
    for (const needle of needles) {
      if (text.includes(needle)) {
        return { ok: false, reason: "vocabulary leak in result output" };
      }
    }
  }
  return { ok: true, reason: "" };
}

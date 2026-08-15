import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attestationFilename,
  buildAttestation,
  canonicalize,
  digestCanonical,
  scanForVocabularyLeak,
} from "./attestation.ts";
import type { RuleSubsetAttestation } from "./attestation.ts";

const base = (): RuleSubsetAttestation =>
  buildAttestation({
    sourceSha: "aaa111",
    upstreamSha: "bbb222",
    ownershipSha256: "c".repeat(64),
    corpusSha256: "d".repeat(64),
    vocabularySha256: "e".repeat(64),
    profileIssue: "9",
    ruleCoverage: ["ASD-STE100-5.1", "ASD-STE100-6.3"],
    authorIds: [1],
    reviewerIds: [2],
    findings: [],
    overrides: [],
    aggregateOk: true,
    generatedAt: "2026-08-13T00:00:00.000Z",
  });

describe("canonicalize", () => {
  it("orders object keys recursively so repeated runs match", () => {
    const first = canonicalize({ b: 1, a: { d: 2, c: 3 } });
    const second = canonicalize({ a: { c: 3, d: 2 }, b: 1 });
    assert.equal(first, second);
    assert.equal(first, '{"a":{"c":3,"d":2},"b":1}');
  });
});

describe("digestCanonical", () => {
  it("produces the same attestation digest for canonical input", () => {
    assert.equal(digestCanonical(base()), digestCanonical(base()));
  });

  it("changes the digest when source, upstream, ownership, vocabulary, review, finding, or override data changes", () => {
    const original = digestCanonical(base());
    const variants: Array<RuleSubsetAttestation> = [
      { ...base(), sourceSha: "changed" },
      { ...base(), upstreamSha: "changed" },
      { ...base(), ownershipSha256: "f".repeat(64) },
      { ...base(), vocabularySha256: "a".repeat(64) },
      { ...base(), reviewerIds: [9] },
      {
        ...base(),
        findings: [
          {
            path: "docs/note.md",
            line: 1,
            column: 1,
            ruleId: "ASD-STE100-5.1",
            message: "too long",
          },
        ],
      },
      { ...base(), overrides: [{ reviewId: 44 }] },
    ];
    for (const variant of variants) {
      assert.notEqual(digestCanonical(variant), original);
    }
  });
});

describe("attestationFilename", () => {
  it("names the artifact after its SHA-256 digest", () => {
    const digest = digestCanonical(base());
    assert.equal(attestationFilename(digest), `${digest}.json`);
  });
});

describe("scanForVocabularyLeak", () => {
  it("fails when an output contains private vocabulary content", () => {
    const result = scanForVocabularyLeak({
      texts: ['{"message":"camshaft is approved"}'],
      officialBytes: "camshaft is approved",
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /leak/i);
  });

  it("treats an unavailable leak scan as failure", () => {
    const result = scanForVocabularyLeak({
      texts: ["ok"],
      officialBytes: null,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /unavailable|leak/i);
  });

  it("fails when output contains one official lemma", () => {
    const result = scanForVocabularyLeak({
      texts: ["the camshaft token leaked"],
      officialBytes: "camshaft is approved for this list",
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /leak/i);
  });
});

describe("buildAttestation", () => {
  it("uses the mechanical rule-subset claim and kind", () => {
    const attestation = base();
    assert.equal(attestation.kind, "rule-subset attestation");
    assert.equal(attestation.claim, "ASD-STE100 mechanical rule-subset result");
  });

  it("keeps ownership digest distinct from the vocabulary digest", () => {
    const attestation = base();
    assert.notEqual(attestation.ownershipSha256, attestation.vocabularySha256);
  });
});

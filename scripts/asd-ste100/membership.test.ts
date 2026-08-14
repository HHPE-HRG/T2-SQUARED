import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkArticleBeforeNoun,
  checkMembershipAndIdentification,
  checkVocabularyMembership,
  knownNounsFromTerms,
} from "./membership.ts";
import type { TechnicalTerm } from "./vocabulary.ts";

const loc = { path: "docs/note.md", line: 1, column: 1 };
const terms: Array<TechnicalTerm> = [
  { term: "Forgejo", kind: "noun", reviewed: true },
  { term: "attestation", kind: "noun", reviewed: true },
];
const approved = new Set(["install", "the", "runner", "attestation", "and", "open"]);

describe("checkVocabularyMembership", () => {
  it("reports Rule 1.1 when a token is not approved and is not a technical name", () => {
    const findings = checkVocabularyMembership({
      ...loc,
      text: "Install the xyzzy runner.",
      approvedWords: approved,
      technicalTerms: terms,
    });
    const hit = findings.find((finding) => finding.ruleId === "ASD-STE100-1.1");
    assert.ok(hit);
    assert.match(hit.message, /xyzzy/i);
    assert.doesNotMatch(hit.message, /approved alternative|dictionary/i);
  });

  it("accepts a reviewed T2 technical name that is absent from the approved list", () => {
    const findings = checkVocabularyMembership({
      ...loc,
      text: "Install the Forgejo runner.",
      approvedWords: approved,
      technicalTerms: terms,
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-1.1"),
      false,
    );
  });
});

describe("checkArticleBeforeNoun", () => {
  it("reports Rule 4.5 when a known noun has no article or demonstrative", () => {
    const findings = checkArticleBeforeNoun({
      ...loc,
      text: "Install runner.",
      knownNouns: new Set(["runner"]),
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-4.5"),
      true,
    );
  });

  it("accepts a known noun after the, a, an, this, or these", () => {
    const findings = checkArticleBeforeNoun({
      ...loc,
      text: "Install the runner.",
      knownNouns: new Set(["runner"]),
    });
    assert.equal(findings.length, 0);
  });
});

describe("checkMembershipAndIdentification", () => {
  it("emits Rule 1.1 and Rule 4.5 together without dictionary alternatives", () => {
    const findings = checkMembershipAndIdentification({
      ...loc,
      text: "Install xyzzy runner.",
      approvedWords: approved,
      technicalTerms: terms,
      knownNouns: knownNounsFromTerms([...terms, { term: "runner", kind: "noun", reviewed: true }]),
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-1.1"),
      true,
    );
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-4.5"),
      true,
    );
    assert.equal(
      findings.every((finding) => !/approved alternative|dictionary/i.test(finding.message)),
      true,
    );
  });
});

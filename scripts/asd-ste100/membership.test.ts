import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { scanForVocabularyLeak } from "./attestation.ts";
import { formatDiagnostic } from "./diagnostics.ts";
import {
  checkArticleBeforeNoun,
  checkCanonicalTermForm,
  checkIdentifierPolicy,
  checkMembershipAndIdentification,
  checkVocabularyMembership,
  IDENTIFIER_POLICY_RULE_ID,
  TERM_CANONICAL_RULE_ID,
  knownNounsFromTerms,
  unapprovedTokenMessage,
} from "./membership.ts";
import {
  deriveRunnerLexiconJson,
  loadVocabulary,
  parseApprovedWordsFromOfficialBytes,
  type TechnicalTerm,
} from "./vocabulary.ts";

const loc = { path: "docs/note.md", line: 1, column: 1 };

function qt(term: string, extra: Partial<TechnicalTerm> = {}): TechnicalTerm {
  return {
    kind: "noun",
    reviewed: true,
    concept: `The ${term} concept.`,
    canonical: true,
    subjectFields: ["asd-enforcement"],
    asdBasis: ["1.5"],
    technicalTermClass: "subject-field-noun",
    ...extra,
    term,
  };
}

const terms: Array<TechnicalTerm> = [qt("Forgejo"), qt("attestation")];
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
    assert.equal(hit.message, unapprovedTokenMessage("xyzzy"));
    assertLeakSafeMembershipDiagnostic(hit.message, ["install", "runner", "attestation"]);
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

  it("accepts a hyphenated reviewed technical name", () => {
    const findings = checkVocabularyMembership({
      ...loc,
      text: "Install the qzvste-lemma-one runner.",
      approvedWords: approved,
      technicalTerms: [qt("qzvste-lemma-one")],
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-1.1"),
      false,
    );
  });

  it("accepts a hyphenated synthetic lemma that is already approved", () => {
    const findings = checkVocabularyMembership({
      ...loc,
      text: "the synthlemma-aaa token",
      approvedWords: new Set(["the", "token", "synthlemma-aaa", "qzvstelemmaone"]),
      technicalTerms: [],
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-1.1"),
      false,
    );
  });

  it("accepts a multi-word approved phrase before checking the leftover tokens", () => {
    const findings = checkVocabularyMembership({
      ...loc,
      text: "Move away from the unit.",
      approvedWords: new Set(["move", "the", "unit", "away from"]),
      technicalTerms: [],
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-1.1"),
      false,
    );
  });

  it("still rejects a leftover token that is not part of an approved phrase", () => {
    const findings = checkVocabularyMembership({
      ...loc,
      text: "Move away the unit.",
      approvedWords: new Set(["move", "the", "unit", "away from"]),
      technicalTerms: [],
    });
    const hit = findings.find((finding) => finding.ruleId === "ASD-STE100-1.1");
    assert.ok(hit);
    assert.equal(hit.message, unapprovedTokenMessage("away"));
  });

  it("prefers the longest approved phrase when a shorter lemma also exists", () => {
    const findings = checkVocabularyMembership({
      ...loc,
      text: "Keep the work in progress.",
      approvedWords: new Set(["keep", "the", "work", "in", "in progress"]),
      technicalTerms: [],
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-1.1"),
      false,
    );
  });

  it("rejects a reviewed term that is not a qualified canonical concept", () => {
    const findings = checkVocabularyMembership({
      ...loc,
      text: "Install the Forgejo runner.",
      approvedWords: approved,
      technicalTerms: [{ term: "Forgejo", kind: "noun", reviewed: true }],
    });
    const hit = findings.find((finding) => finding.ruleId === "ASD-STE100-1.1");
    assert.ok(hit);
    assert.equal(hit.message, unapprovedTokenMessage("Forgejo"));
  });

  it("does not treat a software projection as an ASD Rule 1.1 lemma", () => {
    const findings = checkVocabularyMembership({
      ...loc,
      text: "Install the WorkRegistry runner.",
      approvedWords: approved,
      technicalTerms: [
        qt("work-registry", {
          softwareForms: {
            typescriptType: "WorkRegistry",
            typescriptValue: "workRegistry",
          },
        }),
      ],
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-1.1"),
      false,
    );
  });

  it("accepts Work-Registry as the canonical lemma, not a separate ASD word", () => {
    const findings = checkVocabularyMembership({
      ...loc,
      text: "Install the Work-Registry runner.",
      approvedWords: approved,
      technicalTerms: [qt("work-registry")],
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-1.1"),
      false,
    );
  });
});

describe("checkCanonicalTermForm", () => {
  const bound = [qt("work-registry")];

  it("rejects Work-Registry in prose as a T2 canonical-form finding, not Rule 1.1", () => {
    const findings = checkMembershipAndIdentification({
      ...loc,
      text: "Install the Work-Registry runner.",
      approvedWords: approved,
      technicalTerms: bound,
      knownNouns: knownNounsFromTerms(bound),
    });
    const hit = findings.find((finding) => finding.ruleId === TERM_CANONICAL_RULE_ID);
    assert.ok(hit);
    assert.match(hit.message, /canonical human form/);
    assert.match(hit.message, /work-registry/);
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-1.1"),
      false,
    );
    assert.equal(
      findings.some((finding) => finding.ruleId === IDENTIFIER_POLICY_RULE_ID),
      false,
    );
  });

  it("accepts the exact canonical human form", () => {
    const findings = checkCanonicalTermForm({
      ...loc,
      text: "Install the work-registry runner.",
      technicalTerms: bound,
    });
    assert.equal(findings.length, 0);
  });

  it("accepts sentence-initial first-letter capitalization of a lowercase canonical form", () => {
    const findings = checkCanonicalTermForm({
      ...loc,
      text: "Work-registry is the store.",
      technicalTerms: bound,
    });
    assert.equal(findings.length, 0);
  });

  it("rejects title case even at sentence start", () => {
    const findings = checkCanonicalTermForm({
      ...loc,
      text: "Work-Registry is the store.",
      technicalTerms: bound,
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === TERM_CANONICAL_RULE_ID),
      true,
    );
  });

  it("does not treat a software projection as a canonical-form finding", () => {
    const findings = checkCanonicalTermForm({
      ...loc,
      text: "Install the WorkRegistry runner.",
      technicalTerms: [
        qt("work-registry", {
          softwareForms: {
            typescriptType: "WorkRegistry",
          },
        }),
      ],
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === TERM_CANONICAL_RULE_ID),
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

  it("does not treat software forms as Rule 4.5 known nouns", () => {
    const nouns = knownNounsFromTerms([
      qt("work-registry", {
        softwareForms: {
          typescriptType: "WorkRegistry",
          typescriptValue: "workRegistry",
        },
      }),
    ]);
    assert.equal(nouns.has("work-registry"), true);
    assert.equal(nouns.has("workregistry"), false);
    const findings = checkArticleBeforeNoun({
      ...loc,
      text: "Install workRegistry.",
      knownNouns: nouns,
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-4.5"),
      false,
    );
  });
});

describe("checkIdentifierPolicy", () => {
  const bound = [
    qt("work-registry", {
      softwareForms: {
        typescriptType: "WorkRegistry",
        typescriptValue: "workRegistry",
      },
    }),
  ];

  it("binds WorkRegistry to a qualified concept under T2 identifier policy", () => {
    const findings = checkIdentifierPolicy({
      ...loc,
      text: "Install the WorkRegistry runner.",
      technicalTerms: bound,
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === IDENTIFIER_POLICY_RULE_ID),
      false,
    );
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-1.1"),
      false,
    );
  });

  it("rejects an unbound software projection without using Rule 1.1", () => {
    const findings = checkMembershipAndIdentification({
      ...loc,
      text: "Install the xyzzyGate runner.",
      approvedWords: approved,
      technicalTerms: bound,
      knownNouns: knownNounsFromTerms(bound),
    });
    const hit = findings.find((finding) => finding.ruleId === IDENTIFIER_POLICY_RULE_ID);
    assert.ok(hit);
    assert.match(hit.message, /T2 identifier/);
    assert.match(hit.message, /qualified concept/);
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-1.1"),
      false,
    );
  });
});

describe("checkMembershipAndIdentification", () => {
  it("emits Rule 1.1 and Rule 4.5 together without dictionary alternatives", () => {
    const findings = checkMembershipAndIdentification({
      ...loc,
      text: "Install xyzzy runner.",
      approvedWords: approved,
      technicalTerms: terms,
      knownNouns: knownNounsFromTerms([...terms, qt("runner")]),
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-1.1"),
      true,
    );
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-4.5"),
      true,
    );
    for (const finding of findings) {
      assert.doesNotMatch(finding.message, LEAK_UNSAFE);
    }
    const membershipHit = findings.find((finding) => finding.ruleId === "ASD-STE100-1.1");
    assert.ok(membershipHit);
    assertLeakSafeMembershipDiagnostic(membershipHit.message, ["install", "attestation"]);
  });
});

const LEAK_UNSAFE = /did you mean|dictionary|approved alternative|lemma list|for example/i;

function sha256(contents: string | Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function assertLeakSafeMembershipDiagnostic(
  text: string,
  approvedWords: ReadonlyArray<string>,
): void {
  assert.doesNotMatch(text, LEAK_UNSAFE);
  for (const word of approvedWords) {
    assert.equal(
      text.toLowerCase().includes(word.toLowerCase()),
      false,
      `diagnostic leaked approved token ${word}`,
    );
  }
}

describe("unapprovedTokenMessage", () => {
  it("locks the Rule 1.1 message without alternatives, dictionary rows, or examples", () => {
    const message = unapprovedTokenMessage("xyzzy");
    assert.equal(message, 'word "xyzzy" is not in the approved set.');
    assertLeakSafeMembershipDiagnostic(message, ["install", "runner", "attestation"]);
  });
});

describe("trusted-runner lexicon proof", () => {
  it("derives tmpdir words JSON, pins checksum, fails an unapproved token, and passes leak scan", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "asd-trusted-runner-"));
    const extract = "synthlemmaaaa synthlemmabbb synthlemmaccc";
    const extractPath = path.join(dir, "private-extract.txt");
    writeFileSync(extractPath, extract);
    const wordsPath = deriveRunnerLexiconJson({
      coverage: {
        class: "private_lexicon",
        startPage: 21,
        endPage: 40,
        lemmaCount: 3,
        privateExtractDigest: sha256(extract),
      },
      extractPath,
    });
    assert.equal(wordsPath.includes(`${path.sep}mapping${path.sep}records${path.sep}`), false);
    const official = readFileSync(wordsPath);
    const pin = sha256(official);
    const loaded = loadVocabulary({
      profile: {
        issue: "9",
        vocabularySha256: pin,
        claim: "ASD-STE100 mechanical rule-subset result",
      },
      officialPath: wordsPath,
    });
    assert.equal(loaded.officialPresent, true);
    const approvedWords = parseApprovedWordsFromOfficialBytes(official);
    assert.deepEqual(approvedWords, ["synthlemmaaaa", "synthlemmabbb", "synthlemmaccc"]);
    const findings = checkVocabularyMembership({
      path: "docs/note.md",
      line: 1,
      column: 1,
      text: "zzzyx",
      approvedWords: new Set(approvedWords),
      technicalTerms: [],
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.ruleId, "ASD-STE100-1.1");
    assert.equal(findings[0]?.message, unapprovedTokenMessage("zzzyx"));
    const rendered = formatDiagnostic(findings[0]!);
    assertLeakSafeMembershipDiagnostic(rendered, approvedWords);
    const leak = scanForVocabularyLeak({
      texts: [rendered, JSON.stringify(findings)],
      officialBytes: official,
    });
    assert.equal(leak.ok, true);
    assert.equal(leak.reason, "");
  });

  it("still allows one synthetic source token in leak scan", () => {
    const official = `${JSON.stringify({ words: ["qzvstelemmaone", "synthlemmaaaa"] })}\n`;
    const leak = scanForVocabularyLeak({
      texts: ["the qzvstelemmaone token"],
      officialBytes: official,
    });
    assert.equal(leak.ok, true);
    assert.equal(leak.reason, "");
  });

  it("still fails leak scan on a full serialized words dump", () => {
    const official = `${JSON.stringify({ words: ["qzvstelemmaone", "synthlemmaaaa"] })}\n`;
    const leak = scanForVocabularyLeak({
      texts: [JSON.stringify({ words: ["qzvstelemmaone", "synthlemmaaaa"] })],
      officialBytes: official,
    });
    assert.equal(leak.ok, false);
    assert.match(leak.reason, /leak/i);
  });

  it("still allows membership with no official word list, as fixture mode does", () => {
    const findings = checkVocabularyMembership({
      path: "docs/note.md",
      line: 1,
      column: 1,
      text: "Forgejo",
      approvedWords: new Set(),
      technicalTerms: [qt("Forgejo")],
    });
    assert.equal(findings.length, 0);
  });
});

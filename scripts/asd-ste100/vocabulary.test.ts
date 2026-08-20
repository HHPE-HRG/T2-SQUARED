import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  VocabularyEmptyError,
  VocabularyExtractDigestMismatchError,
  VocabularyLemmaCountMismatchError,
  VocabularyOpaqueError,
  deriveRunnerLexiconJson,
  loadVocabulary,
  parseApprovedWordsFromOfficialBytes,
  validateAnchor,
  validateProfile,
  isQualifiedTerm,
  validateTechnicalTerms,
} from "./vocabulary.ts";
import type { AsdAnchor, AsdProfile, TechnicalTerm } from "./vocabulary.ts";

function subjectFieldNoun(
  term: string,
  subjectField: string,
  extra: Partial<TechnicalTerm> = {},
): TechnicalTerm {
  return {
    term,
    kind: "noun",
    reviewed: true,
    concept: `The ${term} concept.`,
    canonical: true,
    technicalTermClass: "subject-field-noun",
    subjectFields: [subjectField],
    asdBasis: ["1.5"],
    ...extra,
  };
}

function fieldsFor(
  terms: ReadonlyArray<TechnicalTerm>,
): Record<string, { admittedTerms: Array<string> }> {
  const fields: Record<string, { admittedTerms: Array<string> }> = {};
  for (const term of terms) {
    for (const field of term.subjectFields ?? []) {
      const record = fields[field] ?? { admittedTerms: [] };
      if (!record.admittedTerms.includes(term.term)) {
        record.admittedTerms.push(term.term);
      }
      fields[field] = record;
    }
  }
  return fields;
}

function sha256(contents: string): string {
  return createHash("sha256").update(contents, "utf8").digest("hex");
}

const profile = (): AsdProfile => ({
  issue: "9",
  vocabularySha256: sha256("synthetic-official-bytes"),
  claim: "ASD-STE100 mechanical rule-subset result",
});

describe("loadVocabulary", () => {
  it("returns a distinct failure when the official vocabulary file is missing", () => {
    assert.throws(
      () =>
        loadVocabulary({
          profile: profile(),
          officialPath: path.join(tmpdir(), "missing-asd-vocab.txt"),
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.name === "VocabularyMissingError" &&
        !/camshaft|approved word/i.test(error.message),
    );
  });

  it("fails a checksum mismatch before parsing vocabulary", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "asd-vocab-"));
    const officialPath = path.join(dir, "official.bin");
    writeFileSync(officialPath, "not-the-expected-bytes");
    assert.throws(
      () =>
        loadVocabulary({
          profile: profile(),
          officialPath,
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.name === "VocabularyChecksumMismatchError" &&
        !String((error as Error & { cause?: unknown }).cause).includes("not-the-expected-bytes"),
    );
  });

  it("loads synthetic approved words without reading official vocabulary content into the result", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "asd-vocab-"));
    const officialPath = path.join(dir, "official.bin");
    const officialBytes = "synthetic-official-bytes";
    writeFileSync(officialPath, officialBytes);
    const syntheticPath = path.join(dir, "synthetic.json");
    writeFileSync(syntheticPath, JSON.stringify({ words: ["attestation", "runner"] }));
    const loaded = loadVocabulary({
      profile: profile(),
      officialPath,
      syntheticPath,
    });
    assert.deepEqual(loaded.syntheticWords, ["attestation", "runner"]);
    assert.equal(loaded.officialPresent, true);
    assert.equal("officialText" in loaded, false);
  });
});

describe("validateTechnicalTerms", () => {
  it("rejects a duplicate or unreviewed technical term", () => {
    const terms: Array<TechnicalTerm> = [
      {
        term: "Forgejo",
        kind: "noun",
        reviewed: true,
        concept: "The self-hosted git forge that admits T2 work.",
        canonical: true,
        subjectFields: ["asd-enforcement"],
        asdBasis: ["1.1"],
      },
      {
        term: "Forgejo",
        kind: "noun",
        reviewed: true,
        concept: "The self-hosted git forge that admits T2 work.",
        canonical: true,
        subjectFields: ["asd-enforcement"],
        asdBasis: ["1.1"],
      },
    ];
    assert.throws(
      () => validateTechnicalTerms(terms),
      (error: unknown) => error instanceof Error && /duplicate/i.test(error.message),
    );
    assert.throws(
      () => validateTechnicalTerms([{ term: "worktree", kind: "noun", reviewed: false }]),
      (error: unknown) => error instanceof Error && /unreviewed/i.test(error.message),
    );
  });

  it("rejects a reviewed term that lacks concept, canonical, subject-field, or asdBasis", () => {
    assert.throws(
      () => validateTechnicalTerms([{ term: "Forgejo", kind: "noun", reviewed: true }]),
      (error: unknown) => error instanceof Error && /qualified/i.test(error.message),
    );
  });

  it("rejects a software form that only changes capitalization of the canonical term", () => {
    assert.throws(
      () =>
        validateTechnicalTerms(
          [
            {
              term: "work-registry",
              kind: "noun",
              reviewed: true,
              concept: "The git store of T2 campaign records.",
              canonical: true,
              technicalTermClass: "subject-field-noun",
              subjectFields: ["work-registry"],
              asdBasis: ["1.5"],
              softwareForms: { cli: "Work-Registry" },
            },
          ],
          {
            "work-registry": { admittedTerms: ["work-registry"] },
          },
        ),
      (error: unknown) => error instanceof Error && /case-duplicate/i.test(error.message),
    );
  });

  it("accepts a qualified canonical term with a distinct software projection", () => {
    const term: TechnicalTerm = {
      term: "work-registry",
      kind: "noun",
      reviewed: true,
      concept: "The git store of T2 campaign records.",
      canonical: true,
      technicalTermClass: "subject-field-noun",
      subjectFields: ["work-registry"],
      asdBasis: ["1.5"],
      softwareForms: {
        typescriptType: "WorkRegistry",
      },
    };
    assert.doesNotThrow(() =>
      validateTechnicalTerms([term], {
        "work-registry": { admittedTerms: ["work-registry"] },
      }),
    );
  });

  it("rejects asdBasis that only cites Rule 1.1", () => {
    const term = subjectFieldNoun("Forgejo", "asd-enforcement", { asdBasis: ["1.1"] });
    assert.equal(isQualifiedTerm(term), false);
    assert.throws(
      () => validateTechnicalTerms([term], fieldsFor([term])),
      (error: unknown) => error instanceof Error && /insufficient/i.test(error.message),
    );
  });

  it("rejects asdBasis that cites a live mechanical id that is not a technical-name class", () => {
    const term = subjectFieldNoun("Forgejo", "asd-enforcement", { asdBasis: ["5.1"] });
    assert.equal(isQualifiedTerm(term), false);
    assert.throws(
      () => validateTechnicalTerms([term], fieldsFor([term])),
      (error: unknown) => error instanceof Error && /impossible/i.test(error.message),
    );
  });

  it("rejects a noun that lacks a technical-noun class", () => {
    const term = subjectFieldNoun("Forgejo", "asd-enforcement");
    delete (term as { technicalTermClass?: string }).technicalTermClass;
    assert.equal(isQualifiedTerm(term), false);
    assert.throws(
      () => validateTechnicalTerms([term], fieldsFor([term])),
      (error: unknown) => error instanceof Error && /technical-term[\s`]*class/i.test(error.message),
    );
  });

  it("rejects a verb classified as a company-name", () => {
    const term: TechnicalTerm = {
      term: "compile",
      kind: "verb",
      reviewed: true,
      concept: "Build registry output from campaign files.",
      canonical: true,
      technicalTermClass: "company-name",
      subjectFields: ["work-registry"],
      asdBasis: ["1.5"],
    };
    assert.equal(isQualifiedTerm(term), false);
    assert.throws(
      () => validateTechnicalTerms([term], fieldsFor([term])),
      (error: unknown) =>
        error instanceof Error && /does[\s`]*not[\s`]*match[\s`]*kind/i.test(error.message),
    );
  });

  it("rejects an unknown subject field", () => {
    const term = subjectFieldNoun("Forgejo", "physics");
    assert.throws(
      () =>
        validateTechnicalTerms([term], {
          physics: { admittedTerms: ["Forgejo"] },
        }),
      (error: unknown) => error instanceof Error && /unknown[\s`]*subject[\s`]*field/i.test(error.message),
    );
  });

  it("rejects a term that is not admitted for its subject field", () => {
    const term = subjectFieldNoun("Forgejo", "asd-enforcement");
    assert.throws(
      () =>
        validateTechnicalTerms([term], {
          "asd-enforcement": { admittedTerms: ["attestation"] },
        }),
      (error: unknown) => error instanceof Error && /not admitted/i.test(error.message),
    );
  });

  it("rejects an admitted name that has no matching term record", () => {
    const term = subjectFieldNoun("Forgejo", "asd-enforcement");
    assert.throws(
      () =>
        validateTechnicalTerms([term], {
          "asd-enforcement": { admittedTerms: ["Forgejo", "attestation"] },
        }),
      (error: unknown) => error instanceof Error && /no[\s`]*matching[\s`]*term/i.test(error.message),
    );
  });

  it("accepts an irreducible product name and rejects a canonical-form misspell", () => {
    const term = subjectFieldNoun("QzvSteGate", "asd-enforcement", {
      technicalTermClass: "product-name",
    });
    validateTechnicalTerms([term], fieldsFor([term]));
    assert.equal(isQualifiedTerm(term), true);
  });
});

describe("validateProfile", () => {
  it("rejects an unreviewed ASD rule mapping or changed threshold", () => {
    assert.throws(
      () =>
        validateProfile({
          issue: "9",
          vocabularySha256: "0000000000000000000000000000000000000000000000000000000000000000",
          claim: "ASD-STE100 mechanical rule-subset result",
          rules: [{ id: "5.1", maxWords: 20, reviewed: false }],
        }),
      (error: unknown) => error instanceof Error && /unreviewed/i.test(error.message),
    );
  });
});

const pinLandedAnchor = (): AsdAnchor => ({
  checkerSha: "7a45fee06b639c234e6e2b6d8e43647e9a71f3a6",
  status: "pin-landed-pending-review",
  reviewerPrincipal: null,
  fixtureResult: {
    ok: true,
    mode: "fixture",
    command: "npm run ci:asd-ste100",
  },
  protectionActivation: "after-workflow-dispatch-validation",
});

describe("validateAnchor", () => {
  it("accepts a pin-landed anchor that does not claim human review", () => {
    assert.doesNotThrow(() => validateAnchor(pinLandedAnchor()));
  });

  it("rejects bootstrap-pending once a checker SHA is recorded", () => {
    assert.throws(
      () =>
        validateAnchor({
          ...pinLandedAnchor(),
          status: "bootstrap-pending",
        }),
      (error: unknown) => error instanceof Error && /bootstrap-pending/i.test(error.message),
    );
  });

  it("rejects pin-landed-pending-review when a reviewer principal is set", () => {
    assert.throws(
      () =>
        validateAnchor({
          ...pinLandedAnchor(),
          reviewerPrincipal: "operator-self-sign",
        }),
      (error: unknown) => error instanceof Error && /reviewer[\s`]*principal/i.test(error.message),
    );
  });

  it("rejects reviewed status without a reviewer principal", () => {
    assert.throws(
      () =>
        validateAnchor({
          ...pinLandedAnchor(),
          status: "reviewed",
        }),
      (error: unknown) => error instanceof Error && /reviewer[\s`]*principal/i.test(error.message),
    );
  });

  it("accepts protection activation after workflow-dispatch validation", () => {
    assert.doesNotThrow(() =>
      validateAnchor({
        ...pinLandedAnchor(),
        status: "reviewed",
        reviewerPrincipal: "t2-single-operator",
        protectionActivation: "active",
      }),
    );
  });
});

describe("parseApprovedWordsFromOfficialBytes", () => {
  it("parses a words array of synthetic tokens", () => {
    const words = parseApprovedWordsFromOfficialBytes(
      Buffer.from(JSON.stringify({ words: ["synthlemmaaaa", "synthlemmabbb"] })),
    );
    assert.deepEqual(words, ["synthlemmaaaa", "synthlemmabbb"]);
  });

  it("consolidates approved lemmas that differ only by capitalization", () => {
    const words = parseApprovedWordsFromOfficialBytes(
      Buffer.from(
        JSON.stringify({ words: ["work-registry", "Work-Registry", "WORK-REGISTRY", "runner"] }),
      ),
    );
    assert.deepEqual(words, ["work-registry", "runner"]);
  });

  it("fails closed on opaque PDF-like bytes before language checks", () => {
    assert.throws(
      () => parseApprovedWordsFromOfficialBytes(Buffer.from("%PDF-1.4\nsynthetic-official-bytes")),
      (error: unknown) =>
        error instanceof VocabularyOpaqueError &&
        error.name === "VocabularyOpaqueError" &&
        !/not in the approved set|camshaft/i.test(error.message),
    );
  });

  it("fails closed on an empty words array", () => {
    assert.throws(
      () => parseApprovedWordsFromOfficialBytes(Buffer.from(JSON.stringify({ words: [] }))),
      (error: unknown) =>
        error instanceof VocabularyEmptyError && error.name === "VocabularyEmptyError",
    );
  });
});

describe("deriveRunnerLexiconJson", () => {
  it("writes runner words JSON beside the extract after digest and lemmaCount checks", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "asd-runner-lexicon-"));
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
    assert.equal(wordsPath, path.join(dir, "words.json"));
    assert.equal(wordsPath.includes(`${path.sep}mapping${path.sep}records${path.sep}`), false);
    const payload = JSON.parse(readFileSync(wordsPath, "utf8")) as { words: Array<string> };
    assert.deepEqual(payload.words, ["synthlemmaaaa", "synthlemmabbb", "synthlemmaccc"]);
    assert.deepEqual(parseApprovedWordsFromOfficialBytes(readFileSync(wordsPath)), payload.words);
  });

  it("fails closed when the extract digest does not match coverage", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "asd-runner-lexicon-"));
    const extractPath = path.join(dir, "private-extract.txt");
    writeFileSync(extractPath, "synthlemmaaaa synthlemmabbb");
    assert.throws(
      () =>
        deriveRunnerLexiconJson({
          coverage: {
            class: "private_lexicon",
            startPage: 21,
            endPage: 40,
            lemmaCount: 2,
            privateExtractDigest: sha256("other-extract"),
          },
          extractPath,
        }),
      (error: unknown) =>
        error instanceof VocabularyExtractDigestMismatchError &&
        error.name === "VocabularyExtractDigestMismatchError",
    );
  });

  it("fails closed when lemmaCount does not match words length", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "asd-runner-lexicon-"));
    const extract = "synthlemmaaaa synthlemmabbb synthlemmaccc";
    const extractPath = path.join(dir, "private-extract.txt");
    writeFileSync(extractPath, extract);
    assert.throws(
      () =>
        deriveRunnerLexiconJson({
          coverage: {
            class: "private_lexicon",
            startPage: 21,
            endPage: 40,
            lemmaCount: 2,
            privateExtractDigest: sha256(extract),
          },
          extractPath,
        }),
      (error: unknown) =>
        error instanceof VocabularyLemmaCountMismatchError &&
        error.name === "VocabularyLemmaCountMismatchError",
    );
  });
});

describe("committed profile mappings", () => {
  it("lists reviewed Issue 9 IDs 1.1 and 4.5", () => {
    const profile = JSON.parse(
      readFileSync(
        path.join(path.dirname(fileURLToPath(import.meta.url)), "../../t2.asd-ste100.json"),
        "utf8",
      ),
    ) as AsdProfile;
    const ids = (profile.rules ?? []).map((rule) => rule.id);
    assert.equal(ids.includes("1.1"), true);
    assert.equal(ids.includes("4.5"), true);
    assert.equal(
      (profile.rules ?? []).every((rule) => rule.reviewed),
      true,
    );
  });

  it("does not admit function-word leftovers as technical names", () => {
    const payload = JSON.parse(
      readFileSync(
        path.join(path.dirname(fileURLToPath(import.meta.url)), "../../t2.asd-ste100.terms.json"),
        "utf8",
      ),
    ) as { terms: Array<TechnicalTerm> };
    const banned = new Set(["is", "are", "was", "were", "does", "did", "has", "had"]);
    for (const term of payload.terms) {
      assert.equal(
        banned.has(term.term.toLowerCase()),
        false,
        `function-word leftover ${term.term} must not be a technical name`,
      );
    }
  });
});

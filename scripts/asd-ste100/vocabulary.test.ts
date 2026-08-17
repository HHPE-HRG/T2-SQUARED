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
  validateTechnicalTerms,
} from "./vocabulary.ts";
import type { AsdAnchor, AsdProfile, TechnicalTerm } from "./vocabulary.ts";

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
      { term: "Forgejo", kind: "noun", reviewed: true },
      { term: "Forgejo", kind: "noun", reviewed: true },
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

  it("accepts optional concept, canonical, and software form fields", () => {
    assert.doesNotThrow(() =>
      validateTechnicalTerms([
        {
          term: "work-registry",
          kind: "noun",
          reviewed: true,
          concept: "The git store of T2 campaign records.",
          canonical: true,
          subjectFields: ["work-registry"],
          softwareForms: {
            typescriptType: "WorkRegistry",
            typescriptValue: "workRegistry",
            cli: "work-registry",
          },
        },
      ]),
    );
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
      (error: unknown) => error instanceof Error && /reviewer principal/i.test(error.message),
    );
  });

  it("rejects reviewed status without a reviewer principal", () => {
    assert.throws(
      () =>
        validateAnchor({
          ...pinLandedAnchor(),
          status: "reviewed",
        }),
      (error: unknown) => error instanceof Error && /reviewer principal/i.test(error.message),
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
});

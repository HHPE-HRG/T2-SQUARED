import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { loadVocabulary, validateProfile, validateTechnicalTerms } from "./vocabulary.ts";
import type { AsdProfile, TechnicalTerm } from "./vocabulary.ts";

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

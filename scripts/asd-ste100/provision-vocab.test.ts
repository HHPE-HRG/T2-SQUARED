import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { installProvisionalVocabulary, verifyMountedVocabulary } from "./provision-vocab.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = path.join(repoRoot, "scripts/asd-ste100/test/fixtures/vocab/synthetic.json");

describe("installProvisionalVocabulary", () => {
  it("copies the committed fixture, pins the digest, and records lemma count without a word list", () => {
    const dest = mkdtempSync(path.join(tmpdir(), "asd-vocab-"));
    mkdirSync(path.join(dest, "records"), { recursive: true });
    const profilePath = path.join(dest, "t2.asd-ste100.json");
    writeFileSync(
      profilePath,
      `${JSON.stringify({
        issue: "9",
        vocabularySha256: "0".repeat(64),
        claim: "ASD-STE100 mechanical rule-subset result",
        vocabularyReview: "pending-human",
        rules: [],
      })}\n`,
    );
    const result = installProvisionalVocabulary({
      fixturePath: fixture,
      destDir: dest,
      profilePath,
      coveragePath: path.join(dest, "records/vocabulary-coverage.json"),
    });
    const mounted = readFileSync(result.vocabularyPath);
    const digest = createHash("sha256").update(mounted).digest("hex");
    assert.equal(result.vocabularySha256, digest);
    assert.equal(result.lemmaCount, 3);
    assert.equal(result.vocabularyReview, "pending-human");
    const coverage = JSON.parse(
      readFileSync(path.join(dest, "records/vocabulary-coverage.json"), "utf8"),
    ) as { lemmaCount: number; words?: unknown; humanReview: string; vocabularySha256: string };
    assert.equal(coverage.lemmaCount, 3);
    assert.equal(coverage.words, undefined);
    assert.equal(coverage.humanReview, "pending-human");
    assert.equal(coverage.vocabularySha256, digest);
    const pinned = JSON.parse(readFileSync(profilePath, "utf8")) as { vocabularySha256: string };
    assert.equal(pinned.vocabularySha256, digest);
    const check = verifyMountedVocabulary({
      profilePath,
      vocabularyPath: result.vocabularyPath,
    });
    assert.equal(check.pinMatch, true);
    assert.equal(check.lemmaCount, 3);
    assert.equal(check.vocabularyReview, "pending-human");
  });
});

describe("verifyMountedVocabulary", () => {
  it("fails pinMatch when the mounted digest differs", () => {
    const dest = mkdtempSync(path.join(tmpdir(), "asd-vocab-bad-"));
    const profilePath = path.join(dest, "t2.asd-ste100.json");
    writeFileSync(
      profilePath,
      `${JSON.stringify({
        issue: "9",
        vocabularySha256: "f".repeat(64),
        claim: "ASD-STE100 mechanical rule-subset result",
        vocabularyReview: "pending-human",
      })}\n`,
    );
    const vocabularyPath = path.join(dest, "words.json");
    writeFileSync(vocabularyPath, `${JSON.stringify({ words: ["otherlemmaaaaa"] })}\n`);
    const check = verifyMountedVocabulary({
      profilePath,
      vocabularyPath,
    });
    assert.equal(check.pinMatch, false);
  });
});

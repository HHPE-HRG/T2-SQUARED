import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  installProvisionalVocabulary,
  mountIssue9Vocabulary,
  verifyMountedVocabulary,
} from "./provision-vocab.ts";

const script = fileURLToPath(new URL("./provision-vocab.ts", import.meta.url));

function runProvision(args: Array<string>): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", script, ...args], {
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

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

  it("forces pending-human even when the live profile was human-verified", () => {
    const dest = mkdtempSync(path.join(tmpdir(), "asd-vocab-force-"));
    mkdirSync(path.join(dest, "records"), { recursive: true });
    const profilePath = path.join(dest, "t2.asd-ste100.json");
    writeFileSync(
      profilePath,
      `${JSON.stringify({
        issue: "9",
        vocabularySha256: "0".repeat(64),
        claim: "ASD-STE100 mechanical rule-subset result",
        vocabularyReview: "human-verified",
        rules: [],
      })}\n`,
    );
    const result = installProvisionalVocabulary({
      fixturePath: fixture,
      destDir: dest,
      profilePath,
      coveragePath: path.join(dest, "records/vocabulary-coverage.json"),
    });
    assert.equal(result.vocabularyReview, "pending-human");
    const pinned = JSON.parse(readFileSync(profilePath, "utf8")) as {
      vocabularyReview: string;
    };
    assert.equal(pinned.vocabularyReview, "pending-human");
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

describe("provision-vocab --verify-only", () => {
  it("exits non-zero on pin mismatch without rewriting review", () => {
    const dest = mkdtempSync(path.join(tmpdir(), "asd-vocab-verify-bad-"));
    const profilePath = path.join(dest, "t2.asd-ste100.json");
    const vocabularyPath = path.join(dest, "synthetic.json");
    const profile = {
      issue: "9",
      vocabularySha256: "a".repeat(64),
      claim: "ASD-STE100 mechanical rule-subset result",
      vocabularyReview: "pending-human",
    };
    writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`);
    writeFileSync(vocabularyPath, readFileSync(fixture));
    const before = readFileSync(profilePath, "utf8");
    const ran = runProvision([
      "--verify-only",
      "--profile",
      profilePath,
      "--vocabulary",
      vocabularyPath,
    ]);
    assert.notEqual(ran.status, 0);
    const after = JSON.parse(readFileSync(profilePath, "utf8")) as {
      vocabularySha256: string;
      vocabularyReview: string;
    };
    assert.equal(readFileSync(profilePath, "utf8"), before);
    assert.equal(after.vocabularyReview, "pending-human");
    assert.equal(after.vocabularySha256, "a".repeat(64));
  });

  it("exits zero on pin match without flipping review to human-verified", () => {
    const dest = mkdtempSync(path.join(tmpdir(), "asd-vocab-verify-ok-"));
    const profilePath = path.join(dest, "t2.asd-ste100.json");
    const vocabularyPath = path.join(dest, "synthetic.json");
    const bytes = readFileSync(fixture);
    writeFileSync(vocabularyPath, bytes);
    const digest = createHash("sha256").update(bytes).digest("hex");
    writeFileSync(
      profilePath,
      `${JSON.stringify({
        issue: "9",
        vocabularySha256: digest,
        claim: "ASD-STE100 mechanical rule-subset result",
        vocabularyReview: "pending-human",
      })}\n`,
    );
    const before = readFileSync(profilePath, "utf8");
    const ran = runProvision([
      "--verify-only",
      "--profile",
      profilePath,
      "--vocabulary",
      vocabularyPath,
    ]);
    assert.equal(ran.status, 0);
    const after = JSON.parse(readFileSync(profilePath, "utf8")) as {
      vocabularyReview: string;
    };
    assert.equal(readFileSync(profilePath, "utf8"), before);
    assert.equal(after.vocabularyReview, "pending-human");
  });
});

describe("mountIssue9Vocabulary", () => {
  it("copies source bytes to approved-words.json without rewriting the profile", () => {
    const dest = mkdtempSync(path.join(tmpdir(), "asd-vocab-mount-"));
    const source = path.join(dest, "source.json");
    writeFileSync(source, `${JSON.stringify({ words: ["synthlemmaaaa", "synthlemmabbb"] })}\n`);
    const profilePath = path.join(dest, "t2.asd-ste100.json");
    const digest = createHash("sha256").update(readFileSync(source)).digest("hex");
    writeFileSync(
      profilePath,
      `${JSON.stringify({
        issue: "9",
        vocabularySha256: digest,
        claim: "ASD-STE100 mechanical rule-subset result",
        vocabularyReview: "pending-human",
      })}\n`,
    );
    const before = readFileSync(profilePath, "utf8");
    const result = mountIssue9Vocabulary({ sourcePath: source, destDir: dest });
    assert.equal(result.lemmaCount, 2);
    assert.equal(result.vocabularySha256, digest);
    assert.equal(readFileSync(profilePath, "utf8"), before);
    const check = verifyMountedVocabulary({
      profilePath,
      vocabularyPath: result.vocabularyPath,
    });
    assert.equal(check.pinMatch, true);
  });
});

describe("provision-vocab refuses to clobber an Issue 9 pin", () => {
  it("exits non-zero without --force-fixture when the profile is not the synthetic digest", () => {
    const dest = mkdtempSync(path.join(tmpdir(), "asd-vocab-refuse-"));
    const profilePath = path.join(dest, "t2.asd-ste100.json");
    writeFileSync(
      profilePath,
      `${JSON.stringify({
        issue: "9",
        vocabularySha256: "b".repeat(64),
        claim: "ASD-STE100 mechanical rule-subset result",
        vocabularyReview: "pending-human",
      })}\n`,
    );
    const before = readFileSync(profilePath, "utf8");
    const ran = runProvision([
      "--profile",
      profilePath,
      "--dest",
      dest,
      "--coverage",
      path.join(dest, "coverage.json"),
    ]);
    assert.notEqual(ran.status, 0);
    assert.match(ran.stderr, /refuse[\s`]*to replace an[\s`]*Issue[\s`]*9[\s`]*pin/);
    assert.equal(readFileSync(profilePath, "utf8"), before);
  });
});

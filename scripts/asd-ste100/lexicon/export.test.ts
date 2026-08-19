import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  applyPinAtGitMerge,
  exportWordsJson,
  mergeReviewedTerms,
  tagNoT2Function,
} from "./export.ts";
import { LexiconError } from "./import.ts";
import { forkInterpret } from "./interpret.ts";
import { importOriginals, listEntities } from "./import.ts";

function dbPath(): string {
  return path.join(mkdtempSync(path.join(tmpdir(), "t2-lexicon-export-")), "bridge.sqlite");
}

describe("exportWordsJson", () => {
  it("omits no-T2-function tags and keeps leftover plus mutated surfaces", () => {
    const dest = dbPath();
    const rows = importOriginals(dest, {
      actorId: "agent-test",
      items: [
        { page: 1, kind: "word", originalText: "qzvstelemmaone" },
        { page: 1, kind: "word", originalText: "qzvstelemmatwo" },
      ],
    });
    const keep = rows[0];
    const drop = rows[1];
    if (keep === undefined || drop === undefined) {
      throw new Error("import");
    }
    tagNoT2Function(dest, drop.id, "agent-test");
    forkInterpret(dest, {
      actorId: "agent-test",
      parentId: keep.id,
      interpreterId: "product-class-to-t2",
      surfaceText: "t2",
    });
    const out = path.join(path.dirname(dest), "words.json");
    const first = exportWordsJson(dest, out, "agent-test");
    const parsed = JSON.parse(readFileSync(out, "utf8")) as { words: Array<string> };
    assert.equal(parsed.words.includes("qzvstelemmatwo"), false);
    assert.equal(parsed.words.includes("qzvstelemmaone"), true);
    assert.equal(parsed.words.includes("t2"), false);
    const second = exportWordsJson(dest, out, "agent-test");
    assert.equal(first.sha256, second.sha256);
    assert.equal(first.sha256, createHash("sha256").update(readFileSync(out)).digest("hex"));
    assert.equal(
      listEntities(dest).some((row) => row.noT2Function),
      true,
    );
  });
});

describe("mergeReviewedTerms", () => {
  it("merges new surfaces into reviewed T2 terms", () => {
    const merged = mergeReviewedTerms(
      [{ term: "Forgejo", kind: "noun", reviewed: true }],
      ["t2", "Forgejo"],
    );
    assert.equal(
      merged.some((row) => row.term === "t2" && row.reviewed),
      true,
    );
    assert.equal(merged.filter((row) => row.term.toLowerCase() === "forgejo").length, 1);
  });
});

describe("applyPinAtGitMerge", () => {
  it("refuses pin apply without an explicit git-merge flag", () => {
    const root = path.dirname(dbPath());
    assert.throws(
      () =>
        applyPinAtGitMerge({
          gitMerge: false,
          wordsPath: path.join(root, "words.json"),
          profilePath: path.join(root, "profile.json"),
          termsPath: path.join(root, "terms.json"),
          surfaces: ["t2"],
        }),
      LexiconError,
    );
  });

  it("writes the pin and T2 surfaces without flipping review", () => {
    const root = path.dirname(dbPath());
    const wordsPath = path.join(root, "words.json");
    const profilePath = path.join(root, "profile.json");
    const termsPath = path.join(root, "terms.json");
    const body = `${JSON.stringify({ words: ["qzvstelemmaone", "t2"] })}\n`;
    writeFileSync(wordsPath, body);
    writeFileSync(
      profilePath,
      `${JSON.stringify(
        {
          issue: "9",
          vocabularySha256: "0".repeat(64),
          vocabularyReview: "human-verified",
          claim: "ASD-STE100 mechanical rule-subset result",
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      termsPath,
      `${JSON.stringify({ terms: [{ term: "Forgejo", kind: "noun", reviewed: true }] }, null, 2)}\n`,
    );
    const result = applyPinAtGitMerge({
      gitMerge: true,
      wordsPath,
      profilePath,
      termsPath,
      surfaces: ["t2"],
    });
    const profile = JSON.parse(readFileSync(profilePath, "utf8")) as {
      vocabularySha256: string;
      vocabularyReview: string;
    };
    const terms = JSON.parse(readFileSync(termsPath, "utf8")) as {
      terms: Array<{ term: string }>;
    };
    assert.equal(result.vocabularyReview, "human-verified");
    assert.equal(profile.vocabularyReview, "human-verified");
    assert.equal(profile.vocabularySha256, createHash("sha256").update(body).digest("hex"));
    assert.equal(result.lemmaCount, 2);
    assert.equal(
      terms.terms.some((row) => row.term === "t2"),
      true,
    );
    assert.equal(
      terms.terms.some((row) => row.term === "qzvstelemmaone"),
      false,
    );
  });
});

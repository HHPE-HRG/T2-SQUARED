import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { importOriginals } from "./import.ts";
import { explodeFrozenPages } from "./layout.ts";
import {
  exportApprovedWordsFromExtraction,
  exportApprovedWordsJson,
  extractApprovedDictionaryLemmas,
} from "./normalize.ts";
import { tagNoT2Function } from "./export.ts";

const EXTRACTION = [
  "Rule 1.11",
  "General",
  "FLUMBO (v)",
  "quarble (adj)",
  "WIDGET (n) A small unit WIDGET (n)",
  "A (art)",
  "DEFECT (TN)",
  "MAKE (v)",
  "BROKEN (vv)",
  "t2",
  "canBus",
  "Sceoceeceeceee",
  "Future tense (simple)",
  "SPLIT",
  "(adj)",
  "INCORRECT",
  "value",
];

function dbPath(): string {
  return path.join(mkdtempSync(path.join(tmpdir(), "t2-lexicon-norm-")), "bridge.sqlite");
}

describe("extractApprovedDictionaryLemmas", () => {
  it("keeps uppercase headwords with a part-of-speech mark and drops the rest", () => {
    const result = extractApprovedDictionaryLemmas(EXTRACTION);
    assert.deepEqual(result.words, ["a", "broken", "flumbo", "make", "split", "widget"]);
    assert.equal(result.words.includes("quarble"), false);
    assert.equal(result.words.includes("defect"), false);
    assert.equal(result.words.includes("t2"), false);
    assert.equal(result.words.includes("canbus"), false);
    assert.equal(result.words.includes("general"), false);
    assert.equal(result.words.includes("incorrect"), false);
    assert.equal(result.words.includes("value"), false);
    assert.equal(result.nonapprovedCount, 1);
  });

  it("joins line-wrapped uppercase headwords and records the repair", () => {
    const result = extractApprovedDictionaryLemmas([
      "QZVSTE-",
      "LEMMA (n)",
      "QZVSTE-",
      "LEMMADV (adv)",
      "QZVWRAP- leftover note",
      "SUFFIX (adj)",
      "AWAY FROM (prep)",
      "FLUMBO (v)",
      "FLUMBO (n)",
    ]);
    assert.equal(result.words.includes("lemma"), false);
    assert.equal(result.words.includes("lemmadv"), false);
    assert.equal(result.words.includes("suffix"), false);
    assert.equal(result.words.includes("qzvstelemma"), true);
    assert.equal(result.words.includes("qzvstelemmadv"), true);
    assert.equal(result.words.includes("qzvwrapsuffix"), true);
    assert.equal(result.words.includes("away from"), true);
    assert.equal(result.phraseCount, 1);
    assert.equal(result.extractedApprovedOccurrenceCount, 6);
    assert.equal(result.uniqueLemmaCount, result.words.length);
    assert.equal(
      result.collapsedEntryCount,
      result.sourceApprovedEntryCount - result.uniqueLemmaCount,
    );
    assert.deepEqual(result.repairs, [
      "QZVSTE- + LEMMA -> qzvstelemma",
      "QZVSTE- + LEMMADV -> qzvstelemmadv",
      "QZVWRAP- + SUFFIX -> qzvwrapsuffix",
    ]);
  });
});

describe("exportApprovedWordsFromExtraction", () => {
  it("writes only the approved lemma list from a words.json extract", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "t2-lexicon-extract-"));
    const source = path.join(dir, "words.json");
    const dest = path.join(dir, "approved-words.json");
    writeFileSync(source, `${JSON.stringify({ words: EXTRACTION })}\n`);
    const result = exportApprovedWordsFromExtraction(source, dest, "agent-test");
    const parsed = JSON.parse(readFileSync(dest, "utf8")) as { words: Array<string> };
    assert.deepEqual(parsed.words, ["a", "broken", "flumbo", "make", "split", "widget"]);
    assert.equal(result.lemmaCount, 6);
    assert.equal("records" in parsed, false);
    const meta = JSON.parse(readFileSync(path.join(dir, "approved-words.meta.json"), "utf8")) as {
      sourceApprovedEntryCount: number;
      uniqueLemmaCount: number;
      collapsedEntryCount: number;
      phraseCount: number;
      repairs: Array<string>;
    };
    assert.equal(meta.uniqueLemmaCount, 6);
    assert.equal(meta.collapsedEntryCount, meta.sourceApprovedEntryCount - meta.uniqueLemmaCount);
    assert.equal(Array.isArray(meta.repairs), true);
  });
});

describe("exportApprovedWordsJson", () => {
  it("exports dictionary lemmas from line rows and omits tagged pages", () => {
    const dest = dbPath();
    const rows = importOriginals(dest, {
      actorId: "agent-test",
      items: [{ page: 1, kind: "word", originalText: "QZVSTELEMMAONE (n)\nqzvstelemmatwo (v)" }],
    });
    explodeFrozenPages(dest, "agent-test");
    const page = rows[0];
    if (page === undefined) {
      throw new Error("import");
    }
    tagNoT2Function(dest, page.id, "agent-test");
    const out = path.join(path.dirname(dest), "approved-words.json");
    const result = exportApprovedWordsJson(dest, out, "agent-test");
    const parsed = JSON.parse(readFileSync(out, "utf8")) as { words: Array<string> };
    assert.equal(parsed.words.includes("qzvstelemmaone"), true);
    assert.equal(parsed.words.includes("qzvstelemmatwo"), false);
    assert.equal(result.lemmaCount, parsed.words.length);
  });
});

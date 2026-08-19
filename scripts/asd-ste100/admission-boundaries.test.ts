import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { scanForVocabularyLeak } from "./attestation.ts";
import { SYNTHETIC_DICTIONARY_NEEDLES } from "./mapping/merge.ts";
import { assertLiveRulesMatchEnforcedCheckers, loadLiveRuleMappings } from "./registry.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureRoot = path.join(repoRoot, "scripts/asd-ste100/test/fixtures");

const CAN_CAMPAIGN_PATHS = [
  "campaigns",
  "docs/campaigns",
  "can-campaign",
  "docs/can-campaign",
] as const;

function jsonHasWordsList(value: unknown): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => jsonHasWordsList(entry));
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.words) && record.words.length > 0) {
    return true;
  }
  return Object.values(record).some((entry) => jsonHasWordsList(entry));
}

function campaignTreeHasOfficialWordsShape(dir: string): boolean {
  if (!existsSync(dir)) {
    return false;
  }
  return walkFiles(dir).some((filePath) => {
    if (!filePath.endsWith(".json") && !filePath.endsWith(".yaml")) {
      return false;
    }
    try {
      return jsonHasWordsList(JSON.parse(readFileSync(filePath, "utf8")));
    } catch {
      return false;
    }
  });
}

function walkFiles(dir: string): Array<string> {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(full);
    }
    return [full];
  });
}

describe("AE10 CAN campaign files stay absent", () => {
  it("does not add CAN campaign implementation paths", () => {
    for (const relative of CAN_CAMPAIGN_PATHS) {
      assert.equal(
        existsSync(path.join(repoRoot, relative)),
        false,
        `AE10 forbids ${relative} during this unit`,
      );
    }
  });
});

describe("R54 suite is not a local commit hook", () => {
  it("has no T2-SQUARED root .husky/pre-commit that runs ci:asd-ste100", () => {
    const huskyDir = path.join(repoRoot, ".husky");
    const preCommit = path.join(huskyDir, "pre-commit");
    assert.equal(existsSync(huskyDir), false);
    assert.equal(existsSync(preCommit), false);
  });
});

describe("fixtures never contain official dictionary entries", () => {
  it("passes leak scan on committed asd-ste100 fixtures", () => {
    const texts = walkFiles(fixtureRoot).map((filePath) => readFileSync(filePath, "utf8"));
    const joined = texts.join("\n");
    for (const needle of SYNTHETIC_DICTIONARY_NEEDLES) {
      assert.equal(joined.includes(needle), false, `fixture leaked ${needle}`);
    }
    assert.doesNotMatch(joined, /did you mean|approved alternative|lemma list/i);
    const leak = scanForVocabularyLeak({
      texts,
      officialBytes: Buffer.from(`${SYNTHETIC_DICTIONARY_NEEDLES[0]}\n`),
    });
    assert.equal(leak.ok, true, leak.reason);
  });
});

describe("profile rules match enforced checkers", () => {
  it("reuses the live registry assert against committed mappings", () => {
    assertLiveRulesMatchEnforcedCheckers(loadLiveRuleMappings(repoRoot));
  });
});

describe("W4 and W5 hold Issue 9 words and CAN out of git", () => {
  it("keeps the live work-registry free of a words list payload", () => {
    assert.equal(
      campaignTreeHasOfficialWordsShape(path.join(repoRoot, "T2_Squared-Work-Registry")),
      false,
    );
  });

  it("fails a planted official-shaped words file in a campaign folder", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "t2-campaign-words-"));
    mkdirSync(path.join(dir, "sample"));
    writeFileSync(
      path.join(dir, "sample", "words.json"),
      `${JSON.stringify({ words: ["synthlemmaaaa"] })}\n`,
    );
    assert.equal(campaignTreeHasOfficialWordsShape(dir), true);
  });
});

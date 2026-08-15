import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { scanForVocabularyLeak } from "./attestation.ts";
import { SYNTHETIC_DICTIONARY_NEEDLES } from "./mapping/merge.ts";
import { assertLiveRulesMatchEnforcedCheckers, loadLiveRuleMappings } from "./registry.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureRoot = path.join(repoRoot, "scripts/asd-ste100/test/fixtures");

const WORK_REGISTRY_AND_CAN_PATHS = [
  "governance",
  "work-registry",
  "scripts/work-registry",
  "campaigns",
  "docs/campaigns",
  "docs/work-registry",
  "can-campaign",
  "docs/can-campaign",
] as const;

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

describe("AE10 work-registry and CAN campaign files stay absent", () => {
  it("does not add work-registry or CAN campaign implementation paths", () => {
    for (const relative of WORK_REGISTRY_AND_CAN_PATHS) {
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

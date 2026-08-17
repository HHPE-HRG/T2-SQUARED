import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { formatDiagnostic } from "./diagnostics.ts";
import {
  ASD_RULE_PREFIX,
  assertLiveRulesMatchEnforcedCheckers,
  enforcedChecker,
  loadLiveRuleMappings,
  registeredAsdIds,
} from "./registry.ts";
import type { AsdRuleMapping } from "./vocabulary.ts";

const loc = { path: "docs/note.md", line: 3, column: 5 };
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

function liveRulesFile(): { rules: Array<AsdRuleMapping> } {
  return JSON.parse(readFileSync(path.join(repoRoot, "t2.asd-ste100.rules.json"), "utf8")) as {
    rules: Array<AsdRuleMapping>;
  };
}

function liveProfile(): { claim: string; rules?: Array<AsdRuleMapping> } {
  return JSON.parse(readFileSync(path.join(repoRoot, "t2.asd-ste100.json"), "utf8")) as {
    claim: string;
    rules?: Array<AsdRuleMapping>;
  };
}

describe("live profile matches enforced checkers", () => {
  it("binds every live checker id to a registered implementation", () => {
    const live = liveRulesFile().rules;
    assertLiveRulesMatchEnforcedCheckers(live);
    for (const rule of live) {
      assert.equal(typeof rule.checker, "string");
      assert.equal(enforcedChecker(rule.checker ?? "").asdId, rule.id);
    }
  });

  it("lists every ASD id the mechanical and membership scan claims", () => {
    const liveIds = new Set(liveRulesFile().rules.map((rule) => rule.id));
    for (const asdId of registeredAsdIds()) {
      assert.equal(liveIds.has(asdId), true, `live profile missing ASD id ${asdId}`);
    }
  });

  it("keeps the mechanical rule-subset claim on the live profile", () => {
    assert.equal(liveProfile().claim, "ASD-STE100 mechanical rule-subset result");
  });

  it("records human-verified on the synthetic fixture pin", () => {
    const profile = liveProfile() as { vocabularyReview?: string; vocabularySha256: string };
    assert.equal(profile.vocabularyReview, "human-verified");
    const fixture = readFileSync(
      path.join(repoRoot, "scripts/asd-ste100/test/fixtures/vocab/synthetic.json"),
    );
    const digest = createHash("sha256").update(fixture).digest("hex");
    assert.equal(profile.vocabularySha256, digest);
  });

  it("pins connected G3 to the committed test vocabulary fixture", () => {
    const profile = liveProfile() as { vocabularySha256: string };
    const fixture = readFileSync(
      path.join(repoRoot, "scripts/asd-ste100/test/fixtures/vocab/synthetic.json"),
    );
    const digest = createHash("sha256").update(fixture).digest("hex");
    assert.equal(profile.vocabularySha256, digest);
  });

  it("keeps the ASD suite on Node rather than Effect CLI", () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    assert.match(pkg.scripts["ci:asd-ste100"] ?? "", /^node --experimental-strip-types /);
    assert.match(pkg.scripts["test:asd-ste100"] ?? "", /^node --experimental-strip-types /);
    assert.equal((pkg.scripts["ci:asd-ste100"] ?? "").includes("effect"), false);
  });

  it("rejects a checker id with no registered implementation", () => {
    assert.throws(
      () =>
        assertLiveRulesMatchEnforcedCheckers([
          { id: "1.1", reviewed: true, checker: "not-a-real-checker" },
        ]),
      (error: unknown) =>
        error instanceof Error && /unregistered checker: not-a-real-checker/.test(error.message),
    );
  });

  it("loads the same live mappings the profile file lists", () => {
    assert.deepEqual(loadLiveRuleMappings(repoRoot), liveRulesFile().rules);
  });
});

describe("reviewed deterministic fixtures", () => {
  it("fails Rule 5.1 with rule id and source location, and passes a short procedural sentence", () => {
    const checker = enforcedChecker("procedural-sentence-word-count");
    const failing = checker.check({
      ...loc,
      text: "Install the runner then open the pull request then wait for the result then merge the change after review finishes now.",
      kind: "procedural",
    });
    const hit = failing.find((finding) => finding.ruleId === `${ASD_RULE_PREFIX}5.1`);
    assert.ok(hit);
    assert.equal(hit.path, loc.path);
    assert.equal(hit.line, loc.line);
    assert.equal(hit.column, loc.column);
    assert.equal(
      formatDiagnostic(hit),
      `${loc.path}:${loc.line}:${loc.column} ${hit.ruleId} ${hit.message}`,
    );

    const passing = checker.check({
      ...loc,
      text: "Install the runner then open the pull request.",
      kind: "procedural",
    });
    assert.equal(
      passing.some((finding) => finding.ruleId === `${ASD_RULE_PREFIX}5.1`),
      false,
    );
  });

  it("fails Rule 6.3 with rule id and source location, and passes a short descriptive sentence", () => {
    const checker = enforcedChecker("descriptive-sentence-word-count");
    const failing = checker.check({
      ...loc,
      text: "The runner is a host process that waits for jobs from Forgejo and then executes those jobs on the local machine without Docker isolation for this label.",
      kind: "descriptive",
    });
    const hit = failing.find((finding) => finding.ruleId === `${ASD_RULE_PREFIX}6.3`);
    assert.ok(hit);
    assert.equal(hit.path, loc.path);
    assert.equal(hit.line, loc.line);
    assert.equal(hit.column, loc.column);
    assert.equal(
      formatDiagnostic(hit),
      `${loc.path}:${loc.line}:${loc.column} ${hit.ruleId} ${hit.message}`,
    );

    const passing = checker.check({
      ...loc,
      text: "The runner waits for jobs from Forgejo on this host.",
      kind: "descriptive",
    });
    assert.equal(
      passing.some((finding) => finding.ruleId === `${ASD_RULE_PREFIX}6.3`),
      false,
    );
  });

  it("fails Rule 6.6 with rule id and source location, and passes a short paragraph", () => {
    const checker = enforcedChecker("paragraph-sentence-count");
    const failing = checker.check({
      ...loc,
      text: "One. Two. Three. Four. Five. Six. Seven.",
      kind: "descriptive",
    });
    const hit = failing.find((finding) => finding.ruleId === `${ASD_RULE_PREFIX}6.6`);
    assert.ok(hit);
    assert.equal(hit.path, loc.path);
    assert.equal(hit.line, loc.line);
    assert.equal(hit.column, loc.column);
    assert.equal(
      formatDiagnostic(hit),
      `${loc.path}:${loc.line}:${loc.column} ${hit.ruleId} ${hit.message}`,
    );

    const passing = checker.check({
      ...loc,
      text: "One. Two. Three. Four. Five. Six.",
      kind: "descriptive",
    });
    assert.equal(
      passing.some((finding) => finding.ruleId === `${ASD_RULE_PREFIX}6.6`),
      false,
    );
  });
});

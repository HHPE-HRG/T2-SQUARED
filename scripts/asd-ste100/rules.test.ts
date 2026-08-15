import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkClaims } from "./claim.ts";
import { formatDiagnostic } from "./diagnostics.ts";
import { checkMechanicalRules, inferMechanicalKind } from "./rules.ts";

const loc = { path: "docs/note.md", line: 1, column: 1 };

const DESCRIPTIVE_22 =
  "Provider adapters accept configuration and return a typed client for downstream callers across every supported driver kind and keep that client ready.";

describe("inferMechanicalKind", () => {
  it("classifies markdown list items as procedural", () => {
    assert.equal(
      inferMechanicalKind("- Install the runner then open the pull request."),
      "procedural",
    );
  });

  it("classifies a clear imperative opener as procedural", () => {
    assert.equal(
      inferMechanicalKind(
        "Install the runner then open the pull request then wait for the result.",
      ),
      "procedural",
    );
  });

  it("defaults long capitalized descriptive prose to descriptive", () => {
    assert.equal(inferMechanicalKind(DESCRIPTIVE_22), "descriptive");
    assert.equal(
      inferMechanicalKind(
        "The runner waits for jobs from Forgejo and then executes those jobs on the local machine.",
      ),
      "descriptive",
    );
  });
});

describe("checkMechanicalRules", () => {
  it("reports Rule 5.1 when procedural text exceeds 20 words", () => {
    const text =
      "Install the runner then open the pull request then wait for the result then merge the change after review finishes now.";
    const findings = checkMechanicalRules({ ...loc, text, kind: "procedural" });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-5.1"),
      true,
    );
  });

  it("reports Rule 6.3 when descriptive text exceeds 25 words", () => {
    const text =
      "The runner is a host process that waits for jobs from Forgejo and then executes those jobs on the local machine without Docker isolation for this label.";
    const findings = checkMechanicalRules({ ...loc, text, kind: "descriptive" });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-6.3"),
      true,
    );
  });

  it("reports Rule 6.6 when a paragraph has more than six sentences", () => {
    const text = "One. Two. Three. Four. Five. Six. Seven.";
    const findings = checkMechanicalRules({ ...loc, text, kind: "descriptive" });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-6.6"),
      true,
    );
  });

  it("reports contractions and semicolons", () => {
    const findings = checkMechanicalRules({
      ...loc,
      text: "Don't use this path; it is wrong.",
      kind: "descriptive",
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "T2-HEURISTIC-contraction"),
      true,
    );
    assert.equal(
      findings.some((finding) => finding.ruleId === "T2-HEURISTIC-semicolon"),
      true,
    );
  });

  it("reports a passive-voice candidate", () => {
    const findings = checkMechanicalRules({
      ...loc,
      text: "The file is written by the runner.",
      kind: "descriptive",
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "T2-HEURISTIC-passive"),
      true,
    );
    assert.equal(
      findings.some((finding) => finding.ruleId.startsWith("ASD-STE100-")),
      false,
    );
  });

  it("reports non-American spelling", () => {
    const findings = checkMechanicalRules({
      ...loc,
      text: "The colour of the centre is wrong.",
      kind: "descriptive",
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "T2-HEURISTIC-spelling"),
      true,
    );
    assert.equal(
      findings.some((finding) => finding.ruleId.startsWith("ASD-STE100-")),
      false,
    );
  });

  it("reports a disallowed -ing verb form used as a noun", () => {
    const findings = checkMechanicalRules({
      ...loc,
      text: "The running of the job is slow.",
      kind: "descriptive",
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "T2-HEURISTIC-verb-form"),
      true,
    );
    assert.equal(
      findings.some((finding) => finding.ruleId.startsWith("ASD-STE100-")),
      false,
    );
  });

  it("does not report T2-HEURISTIC-passive on active voice", () => {
    const findings = checkMechanicalRules({
      ...loc,
      text: "The runner writes the file.",
      kind: "descriptive",
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "T2-HEURISTIC-passive"),
      false,
    );
  });

  it("does not report T2-HEURISTIC-spelling on American spelling", () => {
    const findings = checkMechanicalRules({
      ...loc,
      text: "The color of the center is wrong.",
      kind: "descriptive",
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "T2-HEURISTIC-spelling"),
      false,
    );
  });

  it("does not report T2-HEURISTIC-verb-form when -ing is not used as a noun", () => {
    const findings = checkMechanicalRules({
      ...loc,
      text: "The runner is running the job.",
      kind: "descriptive",
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "T2-HEURISTIC-verb-form"),
      false,
    );
  });
});

describe("checkClaims", () => {
  it("reports prohibited ASD certification claims with exact location", () => {
    const findings = checkClaims({
      ...loc,
      text: "This patch is ASD certified.",
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "T10"),
      true,
    );
  });
});

describe("formatDiagnostic", () => {
  it("emits a stable linter-style line", () => {
    const line = formatDiagnostic({
      path: "docs/note.md",
      line: 1,
      column: 1,
      ruleId: "ASD-STE100-5.1",
      message: "sentence has 24 words. Maximum is 20.",
    });
    assert.equal(line, "docs/note.md:1:1 ASD-STE100-5.1 sentence has 24 words. Maximum is 20.");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkClaims } from "./claim.ts";
import { formatDiagnostic } from "./diagnostics.ts";
import { checkMechanicalRules } from "./rules.ts";

const loc = { path: "docs/note.md", line: 1, column: 1 };

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

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { admitFailClosedUncheckable } from "./admission.ts";
import { formatDiagnostic } from "./diagnostics.ts";
import type { ForgejoPull, ForgejoReview, ReviewerRoster } from "./forgejo.ts";
import type { MappingRow } from "./mapping/merge.ts";
import type { CurrentFinding, ProposedOverride } from "./override.ts";
import { checkMechanicalRules } from "./rules.ts";

const sha = (value: string): string => createHash("sha256").update(value).digest("hex");
const content = "sentence that fails a rule";
const contentSha = sha(content);

const roster: ReviewerRoster = {
  identities: [{ userId: 1, principal: "author-1", kind: "human", ci: false }],
  reviewers: [
    { userId: 2, principal: "human-a", kind: "human", ci: false },
    { userId: 3, principal: "agent-b", kind: "agent", ci: false },
  ],
};

const pull = (overrides: Partial<ForgejoPull> = {}): ForgejoPull => ({
  id: 11,
  number: 3,
  repositoryId: 7,
  authorId: 1,
  headSha: "aaa111",
  title: "Add the gate.",
  body: "body",
  commits: [{ sha: "aaa111", authorId: 1, message: "Add the gate." }],
  ...overrides,
});

const overrideFinding = {
  file: "docs/note.md",
  line: 1,
  ruleId: "T2-ADMISSION-uncheckable",
  contentSha256: contentSha,
  occurrenceAnchor: "docs/note.md:1:T2-ADMISSION-uncheckable:0",
  repairAttemptHashes: [sha("attempt-1")],
  reason: "mapped row is not mechanically checkable",
};

const review = (overrides: Partial<ForgejoReview> = {}): ForgejoReview => ({
  id: 44,
  userId: 2,
  state: "APPROVED",
  commitId: "aaa111",
  body: JSON.stringify({
    asdSte100Override: {
      findings: [overrideFinding],
    },
  }),
  ...overrides,
});

const currentFinding = (overrides: Partial<CurrentFinding> = {}): CurrentFinding => ({
  file: "docs/note.md",
  line: 1,
  ruleId: "T2-ADMISSION-uncheckable",
  contentSha256: contentSha,
  occurrenceAnchor: "docs/note.md:1:T2-ADMISSION-uncheckable:0",
  ...overrides,
});

const proposed = (overrides: Partial<ProposedOverride> = {}): ProposedOverride => ({
  pullNumber: 3,
  repositoryId: 7,
  reviewId: 44,
  headSha: "aaa111",
  findings: [overrideFinding],
  ...overrides,
});

function uncheckableRow(partial: Partial<MappingRow> = {}): MappingRow {
  return {
    id: "9.2",
    class: "fail_closed_uncheckable",
    sourcePages: [21],
    proposedCheckerId: "fail-closed-uncheckable",
    reviewed: true,
    reviewerId: "reviewer-b",
    reviewNotes: null,
    ...partial,
  };
}

describe("admitFailClosedUncheckable", () => {
  it("fails closed with a named admission reason and no ASD diagnostic", () => {
    const result = admitFailClosedUncheckable({ row: uncheckableRow() });
    assert.equal(result.ok, false);
    assert.match(result.reason, /fail_closed_uncheckable|admission|override/i);
    assert.equal(result.findings.length > 0, true);
    for (const finding of result.findings) {
      assert.equal(finding.ruleId.startsWith("ASD-STE100-"), false);
      assert.equal(finding.ruleId, "T2-ADMISSION-uncheckable");
      assert.doesNotMatch(finding.message, /ASD-STE100-/);
      const line = formatDiagnostic(finding);
      assert.doesNotMatch(line, /ASD-STE100-/);
    }
  });

  it("does not ship a guessed heuristic that claims an ASD id", () => {
    const row = uncheckableRow();
    const mechanical = checkMechanicalRules({
      path: "docs/note.md",
      line: 1,
      column: 1,
      text: "The runner writes the file on this host.",
      kind: "descriptive",
    });
    const result = admitFailClosedUncheckable({ row });
    assert.equal(
      mechanical.some((finding) => finding.ruleId === `ASD-STE100-${row.id}`),
      false,
    );
    assert.equal(
      result.findings.some((finding) => finding.ruleId === `ASD-STE100-${row.id}`),
      false,
    );
    assert.equal(
      result.findings.some((finding) => finding.ruleId.startsWith("T2-HEURISTIC-")),
      false,
    );
  });

  it("admits when a targeted override from a different principal is valid", () => {
    const result = admitFailClosedUncheckable({
      row: uncheckableRow(),
      override: {
        pull: pull(),
        review: review(),
        roster,
        mergeBaseRoster: roster,
        proposed: proposed(),
        currentFindings: [currentFinding()],
        changedPaths: ["docs/note.md"],
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.findings.length, 0);
  });

  it("fails when the override is from the same principal as the author", () => {
    const result = admitFailClosedUncheckable({
      row: uncheckableRow(),
      override: {
        pull: pull(),
        review: review({ userId: 1 }),
        roster,
        mergeBaseRoster: roster,
        proposed: proposed(),
        currentFindings: [currentFinding()],
        changedPaths: ["docs/note.md"],
      },
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /self-review/i);
    assert.equal(
      result.findings.some((finding) => finding.ruleId.startsWith("ASD-STE100-")),
      false,
    );
  });
});

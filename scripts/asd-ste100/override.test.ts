import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import type { ForgejoPull, ForgejoReview, ReviewerRoster } from "./forgejo.ts";
import { validateOverride, validateReview } from "./override.ts";
import type { CurrentFinding, ProposedOverride } from "./override.ts";

const sha = (value: string): string => createHash("sha256").update(value).digest("hex");

const content = "sentence that fails a rule";
const contentSha = sha(content);

const roster: ReviewerRoster = {
  identities: [{ userId: 1, principal: "author-1", kind: "human", ci: false }],
  reviewers: [
    { userId: 2, principal: "human-a", kind: "human", ci: false },
    { userId: 3, principal: "agent-b", kind: "agent", ci: false },
    { userId: 99, principal: "ci", kind: "agent", ci: true },
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

const review = (overrides: Partial<ForgejoReview> = {}): ForgejoReview => ({
  id: 44,
  userId: 2,
  state: "APPROVED",
  commitId: "aaa111",
  body: JSON.stringify({
    asdSte100Override: {
      findings: [
        {
          file: "docs/note.md",
          line: 1,
          ruleId: "ASD-STE100-5.1",
          contentSha256: contentSha,
          occurrenceAnchor: "docs/note.md:1:ASD-STE100-5.1:0",
          repairAttemptHashes: [sha("attempt-1")],
          reason: "proper name cannot be shortened",
        },
      ],
    },
  }),
  ...overrides,
});

const finding = (overrides: Partial<CurrentFinding> = {}): CurrentFinding => ({
  file: "docs/note.md",
  line: 1,
  ruleId: "ASD-STE100-5.1",
  contentSha256: contentSha,
  occurrenceAnchor: "docs/note.md:1:ASD-STE100-5.1:0",
  ...overrides,
});

const proposed = (overrides: Partial<ProposedOverride> = {}): ProposedOverride => ({
  pullNumber: 3,
  repositoryId: 7,
  reviewId: 44,
  headSha: "aaa111",
  findings: [
    {
      file: "docs/note.md",
      line: 1,
      ruleId: "ASD-STE100-5.1",
      contentSha256: contentSha,
      occurrenceAnchor: "docs/note.md:1:ASD-STE100-5.1:0",
      repairAttemptHashes: [sha("attempt-1")],
      reason: "proper name cannot be shortened",
    },
  ],
  ...overrides,
});

describe("validateReview", () => {
  it("passes when author and reviewer have different authorized IDs", () => {
    const result = validateReview({ pull: pull(), review: review(), roster });
    assert.equal(result.ok, true);
  });

  it("fails author self-review even when the review is approved", () => {
    const result = validateReview({
      pull: pull(),
      review: review({ userId: 1 }),
      roster,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /self-review/i);
  });

  it("allows author self-review when one human profile is in self-sign mode", () => {
    const selfSignRoster: ReviewerRoster = {
      identities: [{ userId: 1, principal: "t2-single-operator", kind: "human", ci: false }],
      reviewers: [{ userId: 1, principal: "t2-single-operator", kind: "human", ci: false }],
      selfSignAllowed: true,
    };
    const result = validateReview({
      pull: pull(),
      review: review({ userId: 1 }),
      roster: selfSignRoster,
    });
    assert.equal(result.ok, true);
  });

  it("rejects a shared CI identity as rule-subset review", () => {
    const result = validateReview({
      pull: pull(),
      review: review({ userId: 99 }),
      roster,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /ci/i);
  });

  it("fails when the reviewer authored or committed governed content", () => {
    const result = validateReview({
      pull: pull({
        commits: [{ sha: "aaa111", authorId: 2, message: "Add the gate." }],
      }),
      review: review(),
      roster,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /committed/i);
  });

  it("fails when a commit identity cannot resolve to an immutable Forgejo user ID", () => {
    const result = validateReview({
      pull: pull({
        commits: [{ sha: "aaa111", authorId: null, message: "Add the gate." }],
      }),
      review: review(),
      roster,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /user ID/i);
  });

  it("accepts human and agent reviewers through the same path", () => {
    const human = validateReview({ pull: pull(), review: review({ userId: 2 }), roster });
    const agent = validateReview({ pull: pull(), review: review({ userId: 3 }), roster });
    assert.equal(human.ok, true);
    assert.equal(agent.ok, true);
  });

  it("fails a review for an old head SHA", () => {
    const result = validateReview({
      pull: pull(),
      review: review({ commitId: "old999" }),
      roster,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /head/i);
  });

  it("fails when author and reviewer share a principal", () => {
    const shared: ReviewerRoster = {
      identities: [{ userId: 1, principal: "human-a", kind: "human", ci: false }],
      reviewers: roster.reviewers,
    };
    const result = validateReview({ pull: pull(), review: review(), roster: shared });
    assert.equal(result.ok, false);
    assert.match(result.reason, /principal/i);
  });
});

describe("validateOverride", () => {
  it("passes an idempotent rerun for the same head and review", () => {
    const first = validateOverride({
      pull: pull(),
      review: review(),
      roster,
      mergeBaseRoster: roster,
      proposed: proposed(),
      currentFindings: [finding()],
      changedPaths: ["docs/note.md"],
    });
    const second = validateOverride({
      pull: pull(),
      review: review(),
      roster,
      mergeBaseRoster: roster,
      proposed: proposed(),
      currentFindings: [finding()],
      changedPaths: ["docs/note.md"],
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
  });

  it("invalidates the override when the head commit changes", () => {
    const result = validateOverride({
      pull: pull({ headSha: "bbb222" }),
      review: review(),
      roster,
      mergeBaseRoster: roster,
      proposed: proposed(),
      currentFindings: [finding()],
      changedPaths: ["docs/note.md"],
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /head/i);
  });

  it("fails a content-hash mismatch", () => {
    const result = validateOverride({
      pull: pull(),
      review: review(),
      roster,
      mergeBaseRoster: roster,
      proposed: proposed(),
      currentFindings: [finding({ contentSha256: sha("changed") })],
      changedPaths: ["docs/note.md"],
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /hash/i);
  });

  it("fails when file, line, rule, reason, or review ID is missing", () => {
    const result = validateOverride({
      pull: pull(),
      review: review(),
      roster,
      mergeBaseRoster: roster,
      proposed: proposed({
        findings: [
          {
            file: "",
            line: 1,
            ruleId: "ASD-STE100-5.1",
            contentSha256: contentSha,
            occurrenceAnchor: "x",
            repairAttemptHashes: [sha("attempt-1")],
            reason: "reason",
          },
        ],
      }),
      currentFindings: [finding()],
      changedPaths: ["docs/note.md"],
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /missing/i);
  });

  it("fails when a review body overrides more than its listed findings", () => {
    const extra = proposed({
      findings: [
        ...proposed().findings,
        {
          file: "docs/other.md",
          line: 2,
          ruleId: "ASD-STE100-6.3",
          contentSha256: sha("other"),
          occurrenceAnchor: "docs/other.md:2:ASD-STE100-6.3:0",
          repairAttemptHashes: [sha("attempt-1")],
          reason: "extra",
        },
      ],
    });
    const result = validateOverride({
      pull: pull(),
      review: review(),
      roster,
      mergeBaseRoster: roster,
      proposed: extra,
      currentFindings: [
        finding(),
        finding({
          file: "docs/other.md",
          line: 2,
          ruleId: "ASD-STE100-6.3",
          contentSha256: sha("other"),
          occurrenceAnchor: "docs/other.md:2:ASD-STE100-6.3:0",
        }),
      ],
      changedPaths: ["docs/note.md", "docs/other.md"],
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /listed/i);
  });

  it("fails an override copied to another pull request", () => {
    const result = validateOverride({
      pull: pull({ number: 9, id: 12 }),
      review: review(),
      roster,
      mergeBaseRoster: roster,
      proposed: proposed(),
      currentFindings: [finding()],
      changedPaths: ["docs/note.md"],
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /pull/i);
  });

  it("fails when one override covers two matching finding occurrences", () => {
    const secondAnchor = "docs/note.md:1:ASD-STE100-5.1:1";
    const result = validateOverride({
      pull: pull(),
      review: review(),
      roster,
      mergeBaseRoster: roster,
      proposed: proposed(),
      currentFindings: [finding(), finding({ occurrenceAnchor: secondAnchor })],
      changedPaths: ["docs/note.md"],
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /occurrence/i);
  });

  it("fails a reviewer added only in the PR-head roster for a roster change", () => {
    const headOnly: ReviewerRoster = {
      identities: roster.identities,
      reviewers: [...roster.reviewers, { userId: 8, principal: "new", kind: "human", ci: false }],
    };
    const result = validateOverride({
      pull: pull(),
      review: review({ userId: 8 }),
      roster: headOnly,
      mergeBaseRoster: roster,
      proposed: proposed(),
      currentFindings: [finding()],
      changedPaths: ["t2.asd-ste100.reviewers.json"],
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /roster/i);
  });

  it("fails a proposed override without repair-attempt hashes", () => {
    const result = validateOverride({
      pull: pull(),
      review: review({
        body: JSON.stringify({
          asdSte100Override: {
            findings: [
              {
                file: "docs/note.md",
                line: 1,
                ruleId: "ASD-STE100-5.1",
                contentSha256: contentSha,
                occurrenceAnchor: "docs/note.md:1:ASD-STE100-5.1:0",
                repairAttemptHashes: [],
                reason: "proper name cannot be shortened",
              },
            ],
          },
        }),
      }),
      roster,
      mergeBaseRoster: roster,
      proposed: proposed({
        findings: [
          {
            file: "docs/note.md",
            line: 1,
            ruleId: "ASD-STE100-5.1",
            contentSha256: contentSha,
            occurrenceAnchor: "docs/note.md:1:ASD-STE100-5.1:0",
            repairAttemptHashes: [],
            reason: "proper name cannot be shortened",
          },
        ],
      }),
      currentFindings: [finding()],
      changedPaths: ["docs/note.md"],
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /repair/i);
  });
});

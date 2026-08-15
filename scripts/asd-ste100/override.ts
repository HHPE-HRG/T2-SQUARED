import { findIdentity, findReviewer } from "./forgejo.ts";
import type { ForgejoPull, ForgejoReview, ReviewerRoster } from "./forgejo.ts";

export interface ValidationResult {
  ok: boolean;
  reason: string;
}

export interface OverrideFinding {
  file: string;
  line: number;
  ruleId: string;
  contentSha256: string;
  occurrenceAnchor: string;
  repairAttemptHashes: Array<string>;
  reason: string;
}

export interface ProposedOverride {
  pullNumber: number;
  repositoryId: number;
  reviewId: number;
  headSha: string;
  findings: Array<OverrideFinding>;
}

export interface CurrentFinding {
  file: string;
  line: number;
  ruleId: string;
  contentSha256: string;
  occurrenceAnchor: string;
}

interface ReviewBodyOverride {
  findings: Array<OverrideFinding>;
}

const fail = (reason: string): ValidationResult => ({ ok: false, reason });
const pass = (): ValidationResult => ({ ok: true, reason: "" });

function findingKey(finding: {
  file: string;
  line: number;
  ruleId: string;
  occurrenceAnchor: string;
}): string {
  return `${finding.file}|${finding.line}|${finding.ruleId}|${finding.occurrenceAnchor}`;
}

export function parseOverrideBody(body: string): ReviewBodyOverride | null {
  try {
    const parsed = JSON.parse(body) as {
      asdSte100Override?: { findings?: Array<OverrideFinding> };
    };
    const findings = parsed.asdSte100Override?.findings;
    if (!Array.isArray(findings)) {
      return null;
    }
    return { findings };
  } catch {
    return null;
  }
}

export function validateReview(input: {
  pull: ForgejoPull;
  review: ForgejoReview;
  roster: ReviewerRoster;
}): ValidationResult {
  if (input.review.state === "DISMISSED") {
    return fail("review is dismissed or stale");
  }
  if (input.review.state !== "APPROVED") {
    return fail("review is not approved");
  }
  if (input.review.commitId !== input.pull.headSha) {
    return fail("review commit SHA does not match the current head");
  }
  if (input.review.userId === input.pull.authorId) {
    return fail("author self-review is not permitted");
  }
  const author = findIdentity(input.roster, input.pull.authorId);
  if (author === undefined) {
    return fail("author principal cannot resolve");
  }
  const reviewer = findReviewer(input.roster, input.review.userId);
  if (reviewer === undefined) {
    return fail("reviewer is not in the authorized roster");
  }
  if (author.principal === reviewer.principal) {
    return fail("author principal must differ from reviewer principal");
  }
  if (reviewer.ci) {
    return fail("CI identity cannot count as rule-subset review");
  }
  for (const commit of input.pull.commits) {
    if (commit.authorId === null) {
      return fail("commit identity cannot resolve to an immutable Forgejo user ID");
    }
    if (commit.authorId === input.review.userId) {
      return fail("reviewer committed governed content");
    }
  }
  return pass();
}

function requiredFindingFields(finding: OverrideFinding): string | null {
  if (finding.file.trim() === "") {
    return "missing file";
  }
  if (!Number.isInteger(finding.line) || finding.line < 1) {
    return "missing line";
  }
  if (finding.ruleId.trim() === "") {
    return "missing rule";
  }
  if (finding.reason.trim() === "") {
    return "missing reason";
  }
  if (finding.occurrenceAnchor.trim() === "") {
    return "missing occurrence";
  }
  if (finding.contentSha256.trim() === "") {
    return "missing hash";
  }
  if (finding.repairAttemptHashes.length === 0) {
    return "repair-attempt hashes are required";
  }
  return null;
}

export function validateOverride(input: {
  pull: ForgejoPull;
  review: ForgejoReview;
  roster: ReviewerRoster;
  mergeBaseRoster: ReviewerRoster;
  proposed: ProposedOverride;
  currentFindings: Array<CurrentFinding>;
  changedPaths: Array<string>;
}): ValidationResult {
  if (input.proposed.reviewId !== input.review.id) {
    return fail("missing review ID");
  }
  if (
    input.proposed.pullNumber !== input.pull.number ||
    input.proposed.repositoryId !== input.pull.repositoryId
  ) {
    return fail("override pull does not match the current pull request");
  }
  if (
    input.proposed.headSha !== input.pull.headSha ||
    input.review.commitId !== input.pull.headSha
  ) {
    return fail("review commit SHA does not match the current head");
  }

  const rosterForAuth = input.changedPaths.some((path) =>
    path.endsWith("t2.asd-ste100.reviewers.json"),
  )
    ? input.mergeBaseRoster
    : input.roster;
  const reviewResult = validateReview({
    pull: input.pull,
    review: input.review,
    roster: rosterForAuth,
  });
  if (!reviewResult.ok) {
    if (rosterForAuth !== input.roster) {
      return fail("reviewer is not in the merge-base roster");
    }
    return reviewResult;
  }

  const listed = parseOverrideBody(input.review.body);
  if (listed === null) {
    return fail("review body does not list override findings");
  }
  const listedKeys = new Set(listed.findings.map((item) => findingKey(item)));

  for (const item of input.proposed.findings) {
    const missing = requiredFindingFields(item);
    if (missing !== null) {
      return fail(missing);
    }
    if (!listedKeys.has(findingKey(item))) {
      return fail("review body cannot override more than its listed findings");
    }
    const matches = input.currentFindings.filter(
      (current) =>
        current.file === item.file && current.line === item.line && current.ruleId === item.ruleId,
    );
    if (
      matches.length > 1 &&
      !matches.some((current) => current.occurrenceAnchor === item.occurrenceAnchor)
    ) {
      return fail("one override cannot cover two matching finding occurrences");
    }
    if (matches.length > 1 && input.proposed.findings.length < matches.length) {
      return fail("one override cannot cover two matching finding occurrences");
    }
    const current = input.currentFindings.find((entry) => findingKey(entry) === findingKey(item));
    if (current === undefined) {
      return fail("override does not match a current finding occurrence");
    }
    if (current.contentSha256 !== item.contentSha256) {
      return fail("content hash mismatch");
    }
  }
  return pass();
}

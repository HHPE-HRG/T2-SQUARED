import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractPullProse, parseForgejoPull, parseForgejoReview } from "./forgejo.ts";

const pullPayload = {
  id: 11,
  number: 3,
  repository: { id: 7 },
  user: { id: 1, login: "author" },
  head: { sha: "aaa111" },
  title: "Add the gate.",
  body: "This pull request adds the enforcement suite.",
};

describe("parseForgejoPull", () => {
  it("reads immutable numeric user IDs from a Forgejo pull payload", () => {
    const pull = parseForgejoPull(pullPayload);
    assert.equal(pull.authorId, 1);
    assert.equal(pull.number, 3);
    assert.equal(pull.repositoryId, 7);
    assert.equal(pull.headSha, "aaa111");
  });
});

describe("parseForgejoReview", () => {
  it("reads review identity, state, and commit SHA", () => {
    const review = parseForgejoReview({
      id: 44,
      user: { id: 2, login: "reviewer" },
      state: "APPROVED",
      commit_id: "aaa111",
      body: "{}",
    });
    assert.equal(review.id, 44);
    assert.equal(review.userId, 2);
    assert.equal(review.commitId, "aaa111");
    assert.equal(review.state, "APPROVED");
  });
});

describe("extractPullProse", () => {
  it("converts PR title and body into extractable text records", () => {
    const records = extractPullProse(parseForgejoPull(pullPayload));
    assert.equal(
      records.some((record) => record.text === "Add the gate."),
      true,
    );
    assert.equal(
      records.some((record) => record.text.includes("enforcement suite")),
      true,
    );
  });
});

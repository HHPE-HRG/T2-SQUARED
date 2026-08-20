import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { loadConnectedReviewFromEnv } from "./connected-review.ts";
import { MAPPING_PRINCIPALS_PATH } from "./mapping/promote.ts";
import { validateReview } from "./override.ts";

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value)}\n`);
}

function connectedRoot(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "asd-g5-"));
  writeJson(path.join(dir, "t2.asd-ste100.reviewers.json"), { reviewers: [] });
  writeJson(path.join(dir, MAPPING_PRINCIPALS_PATH), {
    selfSignWhenHumanProfileCountBelow: 2,
    profiles: [
      {
        id: "operator",
        kind: "human",
        principal: "t2-single-operator",
        credentials: [{ id: "forgejo-ssh", provider: "forgejo", subject: "maxholden" }],
      },
    ],
    identities: [
      { id: "operator-self-sign", principal: "t2-single-operator", kind: "human" },
    ],
  });
  return dir;
}

const pullEvent = {
  pull_request: {
    id: 11,
    number: 3,
    user: { id: 1, login: "maxholden" },
    head: { sha: "aaa111" },
    title: "Add the gate.",
    body: "",
  },
  repository: { id: 7 },
};

const approvedReview = {
  id: 44,
  user: { id: 1, login: "maxholden" },
  state: "APPROVED",
  commit_id: "aaa111",
  body: "KTD28 self-sign: single operator",
};

describe("loadConnectedReviewFromEnv", () => {
  it("loads a Forgejo pull event and an approved self-sign review", () => {
    const root = connectedRoot();
    const eventPath = path.join(root, "event.json");
    const reviewPath = path.join(root, "review.json");
    writeJson(eventPath, pullEvent);
    writeJson(reviewPath, approvedReview);
    const previousEvent = process.env.GITHUB_EVENT_PATH;
    const previousReview = process.env.ASD_STE100_REVIEW_JSON;
    process.env.GITHUB_EVENT_PATH = eventPath;
    process.env.ASD_STE100_REVIEW_JSON = reviewPath;
    try {
      const loaded = loadConnectedReviewFromEnv(root);
      assert.equal(loaded.pull?.number, 3);
      assert.equal(loaded.pull?.authorId, 1);
      assert.equal(loaded.review?.state, "APPROVED");
      assert.equal(loaded.review?.userId, 1);
      assert.equal(loaded.roster?.selfSignAllowed, true);
      const result = validateReview({
        pull: loaded.pull!,
        review: loaded.review!,
        roster: loaded.roster!,
      });
      assert.equal(result.ok, true);
    } finally {
      if (previousEvent === undefined) {
        delete process.env.GITHUB_EVENT_PATH;
      } else {
        process.env.GITHUB_EVENT_PATH = previousEvent;
      }
      if (previousReview === undefined) {
        delete process.env.ASD_STE100_REVIEW_JSON;
      } else {
        process.env.ASD_STE100_REVIEW_JSON = previousReview;
      }
    }
  });

  it("leaves review missing when the event has no review payload", () => {
    const root = connectedRoot();
    const eventPath = path.join(root, "event.json");
    writeJson(eventPath, pullEvent);
    const previousEvent = process.env.GITHUB_EVENT_PATH;
    const previousReview = process.env.ASD_STE100_REVIEW_JSON;
    process.env.GITHUB_EVENT_PATH = eventPath;
    delete process.env.ASD_STE100_REVIEW_JSON;
    try {
      const loaded = loadConnectedReviewFromEnv(root);
      assert.equal(loaded.pull?.number, 3);
      assert.equal(loaded.review, undefined);
    } finally {
      if (previousEvent === undefined) {
        delete process.env.GITHUB_EVENT_PATH;
      } else {
        process.env.GITHUB_EVENT_PATH = previousEvent;
      }
      if (previousReview !== undefined) {
        process.env.ASD_STE100_REVIEW_JSON = previousReview;
      }
    }
  });

  it("does not count a CI identity as the self-sign reviewer", () => {
    const root = connectedRoot();
    writeJson(path.join(root, "t2.asd-ste100.reviewers.json"), {
      reviewers: [{ userId: 2, principal: "ci", kind: "agent", ci: true }],
    });
    const eventPath = path.join(root, "event.json");
    const reviewPath = path.join(root, "review.json");
    writeJson(eventPath, pullEvent);
    writeJson(reviewPath, {
      id: 9,
      user: { id: 2, login: "hhpe-ci" },
      state: "APPROVED",
      commit_id: "aaa111",
      body: "",
    });
    const previousEvent = process.env.GITHUB_EVENT_PATH;
    const previousReview = process.env.ASD_STE100_REVIEW_JSON;
    process.env.GITHUB_EVENT_PATH = eventPath;
    process.env.ASD_STE100_REVIEW_JSON = reviewPath;
    try {
      const loaded = loadConnectedReviewFromEnv(root);
      const result = validateReview({
        pull: loaded.pull!,
        review: loaded.review!,
        roster: loaded.roster!,
      });
      assert.equal(result.ok, false);
      assert.match(result.reason, /ci/i);
    } finally {
      if (previousEvent === undefined) {
        delete process.env.GITHUB_EVENT_PATH;
      } else {
        process.env.GITHUB_EVENT_PATH = previousEvent;
      }
      if (previousReview === undefined) {
        delete process.env.ASD_STE100_REVIEW_JSON;
      } else {
        process.env.ASD_STE100_REVIEW_JSON = previousReview;
      }
    }
  });
});

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("live connected reviewer roster", () => {
  it("authorizes a distinct human Forgejo reviewer and keeps CI out", () => {
    const roster = JSON.parse(
      readFileSync(path.join(repoRoot, "t2.asd-ste100.reviewers.json"), "utf8"),
    ) as {
      reviewers: Array<{ userId: number; principal: string; kind: string; ci: boolean }>;
    };
    const byId = new Map(roster.reviewers.map((entry) => [entry.userId, entry]));
    assert.equal(byId.get(1)?.kind, "human");
    assert.equal(byId.get(1)?.ci, false);
    assert.equal(byId.get(1)?.principal, "t2-single-operator");
    assert.equal(byId.get(3)?.kind, "human");
    assert.equal(byId.get(3)?.ci, false);
    assert.equal(byId.get(3)?.principal, "t2-reviewer-operator");
    assert.equal(
      roster.reviewers.some((entry) => entry.ci === true || entry.userId === 2),
      false,
    );
    assert.equal(new Set(roster.reviewers.map((entry) => entry.principal)).size, 2);
  });
});

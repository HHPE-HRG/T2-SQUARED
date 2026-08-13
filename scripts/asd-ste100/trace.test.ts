import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  evaluateGeneratedText,
  evaluateIntentApplicability,
  rejectProductionCommsFields,
  validateOriginHashes,
  validateRepair,
  validateTraceLinks,
} from "./trace.ts";
import type { TraceFixture } from "./trace.ts";

const sha = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "test/fixtures/trace");

const loadFixture = (name: string): TraceFixture =>
  JSON.parse(readFileSync(path.join(fixtureDir, name), "utf8")) as TraceFixture;

const passingText = "Open the pull request.";
const failingText =
  "Install the runner then open the pull request then wait for the result then merge the change after review finishes now.";

describe("validateOriginHashes", () => {
  it("accepts raw prompt and conversation bytes that match recorded origin hashes", () => {
    const fixture = loadFixture("origin-preserved.json");
    const result = validateOriginHashes(fixture);
    assert.equal(result.ok, true);
    assert.equal(result.findings.length, 0);
  });

  it("fails when recorded origin hashes do not match the stored bytes", () => {
    const fixture = loadFixture("origin-preserved.json");
    const result = validateOriginHashes({
      ...fixture,
      originSha256: sha("tampered"),
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /origin/i);
  });
});

describe("evaluateGeneratedText", () => {
  it("never accepts generated text that fails a mechanical rule", () => {
    const result = evaluateGeneratedText({
      path: "generated.md",
      text: failingText,
      kind: "procedural",
      claimedStatus: "accepted",
    });
    assert.equal(result.ok, false);
    assert.notEqual(result.status, "accepted");
    assert.equal(
      result.findings.some((finding) => finding.ruleId === "ASD-STE100-5.1"),
      true,
    );
  });
});

describe("validateRepair", () => {
  it("passes only when the final repaired text passes U2 checks", () => {
    const failed = validateRepair({
      path: "generated.md",
      kind: "procedural",
      attempts: [{ text: failingText, sha256: sha(failingText) }],
      finalText: failingText,
    });
    const passed = validateRepair({
      path: "generated.md",
      kind: "procedural",
      attempts: [
        { text: failingText, sha256: sha(failingText) },
        { text: passingText, sha256: sha(passingText) },
      ],
      finalText: passingText,
    });
    assert.equal(failed.ok, false);
    assert.equal(passed.ok, true);
    assert.equal(passed.findings.length, 0);
  });
});

describe("validateTraceLinks", () => {
  it("fails a missing origin, intent, system-text, review, or hash link", () => {
    const complete = loadFixture("complete-trace.json");
    assert.equal(validateTraceLinks(complete).ok, true);
    const missing = validateTraceLinks({
      ...complete,
      reviewSha256: "",
    });
    assert.equal(missing.ok, false);
    assert.match(missing.reason, /review|link|hash/i);
  });

  it("fails when a linked hash does not match the stored bytes", () => {
    const complete = loadFixture("complete-trace.json");
    const result = validateTraceLinks({
      ...complete,
      systemTextSha256: sha("different system text"),
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /hash/i);
  });
});

describe("evaluateIntentApplicability", () => {
  it("returns typed not_applicable for a repository-only pull request", () => {
    const result = evaluateIntentApplicability({
      changedPaths: ["docs/note.md", "scripts/asd-ste100/rules.ts"],
    });
    assert.equal(result.status, "not_applicable");
    assert.equal(result.ok, true);
  });
});

describe("rejectProductionCommsFields", () => {
  it("rejects fields that imply a production comms contract", () => {
    const result = rejectProductionCommsFields({
      webhook: "https://example.invalid/hook",
      manifold: {},
      runtimeHook: "on-message",
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /webhook|manifold|runtime/i);
  });
});

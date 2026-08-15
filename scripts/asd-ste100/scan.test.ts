import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { scanGovernedFindings } from "./cli.ts";
import { formatDiagnostic } from "./diagnostics.ts";
import { unapprovedTokenMessage } from "./membership.ts";
import { VocabularyChecksumMismatchError } from "./vocabulary.ts";

const LEAK_UNSAFE = /did you mean|dictionary|approved alternative|lemma list|for example/i;

const SYNTH_WORDS = [
  "install",
  "the",
  "runner",
  "then",
  "open",
  "pull",
  "request",
  "wait",
  "for",
  "result",
  "merge",
  "change",
  "after",
  "review",
  "finishes",
  "now",
];

const PROCEDURAL_21 =
  "Install the runner then open the pull request then wait for the result then merge the change after review finishes now.";

function sha256(contents: string | Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function git(cwd: string, args: ReadonlyArray<string>): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function write(root: string, relative: string, contents: string): void {
  const full = path.join(root, relative);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

function officialBytes(words: ReadonlyArray<string> = SYNTH_WORDS): Buffer {
  return Buffer.from(`${JSON.stringify({ words })}\n`);
}

function profileJson(vocabularySha256: string): string {
  return `${JSON.stringify({
    issue: "9",
    vocabularySha256,
    claim: "ASD-STE100 mechanical rule-subset result",
    rules: [{ id: "1.1", reviewed: true, checker: "vocabulary-membership" }],
  })}\n`;
}

function ownershipJson(): string {
  return `${JSON.stringify({
    ownedGlobs: ["docs/**"],
    rawGlobs: [],
    machineGlobs: [],
    fixtureGlobs: [],
    privilegedGlobs: ["t2.asd-ste100.json", "t2.asd-ste100.*.json"],
    externalEvidenceGlobs: [],
  })}\n`;
}

function termsJson(
  terms: Array<{ term: string; kind: "noun" | "verb"; reviewed: boolean }>,
): string {
  return `${JSON.stringify({ terms })}\n`;
}

function initScanRepo(input: {
  prose: string;
  terms?: Array<{ term: string; kind: "noun" | "verb"; reviewed: boolean }>;
  vocabularySha256?: string;
}): { root: string; sha: string; bytes: Buffer } {
  const root = mkdtempSync(path.join(tmpdir(), "asd-scan-"));
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test"]);
  git(root, ["config", "commit.gpgsign", "false"]);
  const bytes = officialBytes();
  write(root, "t2.asd-ste100.ownership.json", ownershipJson());
  write(
    root,
    "t2.asd-ste100.terms.json",
    termsJson(input.terms ?? [{ term: "Forgejo", kind: "noun", reviewed: true }]),
  );
  write(root, "t2.asd-ste100.json", profileJson(input.vocabularySha256 ?? sha256(bytes)));
  write(root, "docs/note.md", `${input.prose}\n`);
  git(root, ["add", "-A"]);
  git(root, ["commit", "-m", "scan fixture"]);
  return { root, sha: git(root, ["rev-parse", "HEAD"]), bytes };
}

function scan(root: string, sha: string, bytes: Buffer | null) {
  return scanGovernedFindings({
    cwd: root,
    mode: "corpus",
    baseSha: sha,
    headSha: sha,
    officialBytes: bytes,
  });
}

describe("scanGovernedFindings", () => {
  it("reports AE8 for an unapproved word without official alternative text", () => {
    const { root, sha, bytes } = initScanRepo({ prose: "Install the xyzzy runner." });
    const scanned = scan(root, sha, bytes);
    const hit = scanned.findings.find((finding) => finding.ruleId === "ASD-STE100-1.1");
    assert.ok(hit);
    assert.equal(hit.message, unapprovedTokenMessage("xyzzy"));
    assert.doesNotMatch(hit.message, LEAK_UNSAFE);
    assert.doesNotMatch(formatDiagnostic(hit), LEAK_UNSAFE);
    for (const word of ["install", "runner"]) {
      assert.equal(
        hit.message.toLowerCase().includes(word),
        false,
        `diagnostic leaked approved token ${word}`,
      );
    }
  });

  it("reports AE9 missing article as ASD-STE100-4.5", () => {
    const { root, sha, bytes } = initScanRepo({
      prose: "Install runner.",
      terms: [{ term: "runner", kind: "noun", reviewed: true }],
    });
    const scanned = scan(root, sha, bytes);
    assert.equal(
      scanned.findings.some((finding) => finding.ruleId === "ASD-STE100-4.5"),
      true,
    );
  });

  it("accepts a reviewed T2 technical name in owned prose", () => {
    const { root, sha, bytes } = initScanRepo({ prose: "Install the Forgejo runner." });
    const scanned = scan(root, sha, bytes);
    assert.equal(
      scanned.findings.some((finding) => finding.ruleId === "ASD-STE100-1.1"),
      false,
    );
  });

  it("fails a checksum mismatch before language checks", () => {
    const { root, sha } = initScanRepo({
      prose: "Install the xyzzy runner.",
      vocabularySha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    assert.throws(
      () => scan(root, sha, officialBytes()),
      (error: unknown) =>
        error instanceof VocabularyChecksumMismatchError ||
        (error instanceof Error && error.name === "VocabularyChecksumMismatchError"),
    );
  });

  it("emits ASD-STE100-5.1 for a long procedural sentence", () => {
    const { root, sha, bytes } = initScanRepo({
      prose: `- ${PROCEDURAL_21}`,
    });
    const scanned = scan(root, sha, bytes);
    assert.equal(
      scanned.findings.some((finding) => finding.ruleId === "ASD-STE100-5.1"),
      true,
    );
    assert.equal(
      scanned.findings.some((finding) => finding.ruleId === "ASD-STE100-6.3"),
      false,
    );
  });
});

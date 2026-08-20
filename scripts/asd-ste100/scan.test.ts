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
import { VocabularyChecksumMismatchError, type TechnicalTerm } from "./vocabulary.ts";

const QUALIFIED_FORGEJO: TechnicalTerm = {
  term: "Forgejo",
  kind: "noun",
  reviewed: true,
  concept: "The self-hosted git forge that admits T2 work.",
  canonical: true,
  technicalTermClass: "product-name",
  subjectFields: ["asd-enforcement"],
  asdBasis: ["1.5"],
  softwareForms: { typescriptType: "ForgejoHost" },
};

const QUALIFIED_RUNNER: TechnicalTerm = {
  term: "runner",
  kind: "noun",
  reviewed: true,
  concept: "A trusted host that runs Forgejo jobs.",
  canonical: true,
  technicalTermClass: "subject-field-noun",
  subjectFields: ["asd-enforcement"],
  asdBasis: ["1.5"],
  softwareForms: { typescriptType: "RunnerHost" },
};

const QUALIFIED_WORK_REGISTRY: TechnicalTerm = {
  term: "work-registry",
  kind: "noun",
  reviewed: true,
  concept: "The git store of T2 campaign records.",
  canonical: true,
  technicalTermClass: "subject-field-noun",
  subjectFields: ["work-registry"],
  asdBasis: ["1.5"],
  softwareForms: { typescriptType: "WorkRegistry" },
};

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

function profileJson(
  vocabularySha256: string,
  rules: Array<{ id: string; reviewed: boolean; checker: string }> = [
    { id: "1.1", reviewed: true, checker: "vocabulary-membership" },
  ],
): string {
  return `${JSON.stringify({
    issue: "9",
    vocabularySha256,
    claim: "ASD-STE100 mechanical rule-subset result",
    rules,
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

function termsJson(terms: Array<TechnicalTerm>): string {
  const subjectFields: Record<string, { admittedTerms: Array<string> }> = {};
  for (const term of terms) {
    for (const field of term.subjectFields ?? []) {
      const record = subjectFields[field] ?? { admittedTerms: [] };
      if (!record.admittedTerms.includes(term.term)) {
        record.admittedTerms.push(term.term);
      }
      subjectFields[field] = record;
    }
  }
  return `${JSON.stringify({ subjectFields, terms })}\n`;
}

function initScanRepo(input: {
  prose: string;
  terms?: Array<TechnicalTerm>;
  vocabularySha256?: string;
  rules?: Array<{ id: string; reviewed: boolean; checker: string }>;
}): { root: string; sha: string; bytes: Buffer } {
  const root = mkdtempSync(path.join(tmpdir(), "asd-scan-"));
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test"]);
  git(root, ["config", "commit.gpgsign", "false"]);
  const bytes = officialBytes();
  write(root, "t2.asd-ste100.ownership.json", ownershipJson());
  write(root, "t2.asd-ste100.terms.json", termsJson(input.terms ?? [QUALIFIED_FORGEJO]));
  write(
    root,
    "t2.asd-ste100.json",
    profileJson(input.vocabularySha256 ?? sha256(bytes), input.rules),
  );
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
      terms: [QUALIFIED_RUNNER],
      rules: [
        { id: "1.1", reviewed: true, checker: "vocabulary-membership" },
        { id: "4.5", reviewed: true, checker: "article-before-noun" },
      ],
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

  it("reports T2-TERM-canonical for a noncanonical human form without using Rule 1.1", () => {
    const { root, sha, bytes } = initScanRepo({
      prose: "Install the Work-Registry runner.",
      terms: [QUALIFIED_WORK_REGISTRY, QUALIFIED_RUNNER],
    });
    const scanned = scan(root, sha, bytes);
    assert.equal(
      scanned.findings.some((finding) => finding.ruleId === "T2-TERM-canonical"),
      true,
    );
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
      rules: [
        { id: "1.1", reviewed: true, checker: "vocabulary-membership" },
        { id: "5.1", reviewed: true, checker: "procedural-sentence-word-count" },
      ],
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

  it("does not emit ASD-STE100-5.1 for long capitalized descriptive prose", () => {
    const { root, sha, bytes } = initScanRepo({
      prose:
        "Provider adapters accept configuration and return a typed client for downstream callers across every supported driver kind and keep that client ready.",
    });
    const scanned = scan(root, sha, bytes);
    assert.equal(
      scanned.findings.some((finding) => finding.ruleId === "ASD-STE100-5.1"),
      false,
    );
  });

  it("does not emit 5.1 when the checker profile lists only 4.5", () => {
    const { root, sha, bytes } = initScanRepo({
      prose: `- ${PROCEDURAL_21}`,
      rules: [{ id: "4.5", reviewed: true, checker: "article-before-noun" }],
    });
    const scanned = scan(root, sha, bytes);
    assert.equal(
      scanned.findings.some((finding) => finding.ruleId === "ASD-STE100-5.1"),
      false,
    );
  });

  it("loads rules from checker cwd and file bytes from the tree cwd", () => {
    const tree = initScanRepo({
      prose: `- ${PROCEDURAL_21}`,
      rules: [
        { id: "1.1", reviewed: true, checker: "vocabulary-membership" },
        { id: "5.1", reviewed: true, checker: "procedural-sentence-word-count" },
      ],
    });
    const checker = mkdtempSync(path.join(tmpdir(), "asd-checker-"));
    write(checker, "t2.asd-ste100.ownership.json", ownershipJson());
    write(checker, "t2.asd-ste100.terms.json", termsJson([QUALIFIED_FORGEJO]));
    write(checker, "t2.asd-ste100.json", profileJson(sha256(tree.bytes)));
    const scanned = scanGovernedFindings({
      cwd: tree.root,
      checkerCwd: checker,
      treeCwd: tree.root,
      mode: "corpus",
      baseSha: tree.sha,
      headSha: tree.sha,
      officialBytes: tree.bytes,
    });
    assert.equal(
      scanned.findings.some((finding) => finding.ruleId === "ASD-STE100-5.1"),
      false,
    );
  });
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { ForgejoPull, ForgejoReview, ReviewerRoster } from "./forgejo.ts";
import type { ProposedOverride } from "./override.ts";
import { VocabularyMissingError } from "./vocabulary.ts";
import {
  EXIT,
  createDefaultDeps,
  loadMainBaseline,
  loadScanLexicon,
  parseMode,
  resolvePrGitRefs,
  runCli,
  runFixtureSelfTest,
  skipScanPath,
} from "./cli.ts";
import type { CliDeps } from "./cli.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const deps = (overrides: Partial<CliDeps> = {}): CliDeps => ({
  cwd: repoRoot,
  now: () => "2026-08-13T00:00:00.000Z",
  githubActionsState: () => "disabled",
  officialVocabularyBytes: () => Buffer.from("synthetic-official-bytes"),
  leakScanAvailable: true,
  gitHead: () => "headsha",
  gitMergeBase: () => "basesha",
  eventHeadSha: "event-sha-must-be-ignored",
  baseline: {
    ok: true,
    sourceSha: "headsha",
  },
  attestationPresent: true,
  changedPaths: ["docs/note.md"],
  corpusPaths: ["docs/note.md", "scripts/asd-ste100/cli.ts"],
  findings: [],
  authorIds: [],
  reviewerIds: [],
  overrides: [],
  governedSystemTextWithoutTrace: false,
  writeOutput: () => undefined,
  ...overrides,
});

function sha256(contents: string | Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function connectedCwd(
  vocabularySha256: string,
  extra: { vocabularyReview?: "pending-human" | "human-verified" } = {},
): string {
  const dir = mkdtempSync(path.join(tmpdir(), "asd-g3-"));
  writeFileSync(
    path.join(dir, "t2.asd-ste100.json"),
    `${JSON.stringify({
      issue: "9",
      vocabularySha256,
      claim: "ASD-STE100 mechanical rule-subset result",
      vocabularyReview: extra.vocabularyReview,
      rules: [{ id: "1.1", reviewed: true, checker: "vocabulary-membership" }],
    })}\n`,
  );
  writeFileSync(
    path.join(dir, "t2.upstream.json"),
    `${JSON.stringify({ acceptedBaseSha: "basesha" })}\n`,
  );
  writeFileSync(
    path.join(dir, "t2.asd-ste100.terms.json"),
    `${JSON.stringify({
      subjectFields: {
        "asd-enforcement": { admittedTerms: ["Forgejo"] },
      },
      terms: [
        {
          term: "Forgejo",
          kind: "noun",
          reviewed: true,
          concept: "The self-hosted git forge that admits T2 work.",
          canonical: true,
          technicalTermClass: "product-name",
          subjectFields: ["asd-enforcement"],
          asdBasis: ["1.5"],
          softwareForms: { typescriptType: "ForgejoHost" },
        },
      ],
    })}\n`,
  );
  writeFileSync(
    path.join(dir, "t2.asd-ste100.ownership.json"),
    `${JSON.stringify({
      ownedGlobs: ["docs/**"],
      rawGlobs: [],
      machineGlobs: [],
      fixtureGlobs: [],
      privilegedGlobs: [],
      externalEvidenceGlobs: [],
    })}\n`,
  );
  return dir;
}

function gate(
  result: { gates: Array<{ id: string; ok: boolean; reason: string; status?: string }> },
  id: string,
) {
  const found = result.gates.find((entry) => entry.id === id);
  assert.ok(found, `missing gate ${id}`);
  return found;
}

const HEAD_SHA = "headsha";

const reviewRoster: ReviewerRoster = {
  identities: [{ userId: 1, principal: "author-1", kind: "human", ci: false }],
  reviewers: [{ userId: 2, principal: "human-a", kind: "human", ci: false }],
};

const reviewPull = (extra: Partial<ForgejoPull> = {}): ForgejoPull => ({
  id: 11,
  number: 3,
  repositoryId: 7,
  authorId: 1,
  headSha: HEAD_SHA,
  title: "Add the gate.",
  body: "body",
  commits: [{ sha: HEAD_SHA, authorId: 1, message: "Add the gate." }],
  ...extra,
});

const approvedReview = (extra: Partial<ForgejoReview> = {}): ForgejoReview => ({
  id: 44,
  userId: 2,
  state: "APPROVED",
  commitId: HEAD_SHA,
  body: "",
  ...extra,
});

function withValidReview(extra: Partial<CliDeps> = {}): Partial<CliDeps> {
  return {
    pull: reviewPull(),
    review: approvedReview(),
    roster: reviewRoster,
    mergeBaseRoster: reviewRoster,
    ...extra,
  };
}

function connectedOfficial(extra: Partial<CliDeps> = {}): Partial<CliDeps> {
  const official = Buffer.from(`${JSON.stringify({ words: ["synthlemmaaaa"] })}\n`);
  return {
    cwd: connectedCwd(sha256(official)),
    officialVocabularyBytes: () => official,
    ...extra,
  };
}

describe("package scripts", () => {
  it("keeps root and scripts-workspace ci:asd-ste100 on the same cli.ts", () => {
    const root = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const workspace = JSON.parse(
      readFileSync(path.join(repoRoot, "scripts/package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
    };
    assert.match(root.scripts["ci:asd-ste100"] ?? "", /asd-ste100\/cli\.ts/);
    assert.match(workspace.scripts["ci:asd-ste100"] ?? "", /asd-ste100\/cli\.ts/);
  });
});

describe("parseMode", () => {
  it("defaults to fixture self-test", () => {
    assert.equal(parseMode([]), "fixture");
  });
});

describe("skipScanPath", () => {
  it("keeps campaign plans and the mapping heuristic card out of corpus findings", () => {
    assert.equal(
      skipScanPath("docs/plans/2026-08-14-001-fix-asd-ste100-remediation-wave-1-plan.md"),
      true,
    );
    assert.equal(skipScanPath("scripts/asd-ste100/mapping/AGENT_HEURISTIC.md"), true);
    assert.equal(skipScanPath("scripts/asd-ste100/mapping/records/official-unreviewed.json"), true);
    assert.equal(skipScanPath("docs/operations/asd-ste100-forgejo.md"), false);
  });
});

describe("resolvePrGitRefs", () => {
  it("resolves merge base and head from git, not event payload", () => {
    const refs = resolvePrGitRefs({
      gitHead: () => "real-head",
      gitMergeBase: () => "real-base",
      eventHeadSha: "event-sha",
    });
    assert.equal(refs.headSha, "real-head");
    assert.equal(refs.mergeBaseSha, "real-base");
  });
});

describe("runCli", () => {
  it("fails connected modes when GitHub Actions are enabled or unverified", () => {
    for (const state of ["enabled", "unknown"] as const) {
      const result = runCli(["--mode", "pr"], deps({ githubActionsState: () => state }));
      assert.notEqual(result.exitCode, EXIT.ok);
      assert.equal(result.exitCategory, "github_actions");
      assert.equal(result.outputs.length, 0);
    }
  });

  it("uses the prerequisite exit category when official vocabulary is missing", () => {
    const result = runCli(
      ["--mode", "main"],
      deps({
        officialVocabularyBytes: () => {
          throw new VocabularyMissingError();
        },
      }),
    );
    assert.equal(result.exitCategory, "prerequisite");
    assert.equal(result.exitCode, EXIT.prerequisite);
    assert.equal(gate(result, "G3").ok, false);
    assert.match(gate(result, "G3").reason, /missing/i);
  });

  it("passes fixture mode without the official vocabulary file", () => {
    const result = runCli(
      ["--mode", "fixture"],
      deps({
        officialVocabularyBytes: () => {
          throw new VocabularyMissingError();
        },
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.exitCode, EXIT.ok);
    assert.equal(gate(result, "G3").ok, true);
  });

  it("fails G3 in connected modes on checksum mismatch before using vocabulary bytes", () => {
    const official = Buffer.from(JSON.stringify({ words: ["synthlemmaaaa"] }));
    const result = runCli(
      ["--mode", "pr"],
      deps({
        cwd: connectedCwd("a".repeat(64)),
        officialVocabularyBytes: () => official,
      }),
    );
    assert.equal(result.ok, false);
    assert.equal(gate(result, "G3").ok, false);
    assert.match(gate(result, "G3").reason, /checksum/i);
    assert.equal(gate(result, "G3").reason.includes("synthlemmaaaa"), false);
    assert.equal(JSON.stringify(result.aggregate).includes("synthlemmaaaa"), false);
  });

  it("fails G3 in connected modes when official bytes are opaque", () => {
    const official = Buffer.from("%PDF-1.4\nsecret-vocab-token");
    const result = runCli(
      ["--mode", "main"],
      deps({
        cwd: connectedCwd(sha256(official)),
        officialVocabularyBytes: () => official,
      }),
    );
    assert.equal(result.ok, false);
    assert.equal(gate(result, "G3").ok, false);
    assert.match(gate(result, "G3").reason, /opaque/i);
    assert.equal(gate(result, "G3").reason.includes("secret-vocab-token"), false);
    assert.equal(JSON.stringify(result.aggregate).includes("secret-vocab-token"), false);
  });

  it("fails G3 in connected modes when the derived words array is empty", () => {
    const official = Buffer.from(JSON.stringify({ words: [] }));
    const result = runCli(
      ["--mode", "release"],
      deps({
        cwd: connectedCwd(sha256(official)),
        officialVocabularyBytes: () => official,
      }),
    );
    assert.equal(result.ok, false);
    assert.equal(gate(result, "G3").ok, false);
    assert.match(gate(result, "G3").reason, /empty/i);
  });

  it("passes G3 in connected modes when the pin matches a derived words JSON list", () => {
    const result = runCli(["--mode", "pr"], deps(connectedOfficial(withValidReview())));
    assert.equal(gate(result, "G3").ok, true);
    assert.equal(result.ok, true);
  });

  it("fails release mode without a current successful main baseline", () => {
    const result = runCli(
      ["--mode", "release"],
      deps({ baseline: { ok: false, sourceSha: "headsha" } }),
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /baseline/i);
  });

  it("fails release mode when an attestation is missing", () => {
    const result = runCli(["--mode", "release"], deps({ attestationPresent: false }));
    assert.equal(result.ok, false);
    assert.match(result.reason, /attestation/i);
  });

  it("fails release when the baseline source SHA does not equal the candidate SHA", () => {
    const result = runCli(
      ["--mode", "release"],
      deps({ baseline: { ok: true, sourceSha: "other" } }),
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /source[\s`]*SHA/i);
  });

  it("fails the aggregate when any required gate fails", () => {
    const result = runCli(
      ["--mode", "pr"],
      deps({
        findings: [
          {
            path: "docs/note.md",
            line: 1,
            column: 1,
            ruleId: "ASD-STE100-5.1",
            message: "The count stay 24. The maximum stay 20.",
          },
        ],
      }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.exitCategory, "findings");
    assert.equal(
      result.gates.some((gate) => gate.id === "G2" && gate.ok === false),
      true,
    );
  });

  it("does not fail G2 on Rule 1.1 while vocabulary review is pending-human", () => {
    const official = Buffer.from(`${JSON.stringify({ words: ["qzvstelemmaone"] })}\n`);
    const result = runCli(
      ["--mode", "pr"],
      deps({
        cwd: connectedCwd(sha256(official), { vocabularyReview: "pending-human" }),
        officialVocabularyBytes: () => official,
        findings: [
          {
            path: "docs/note.md",
            line: 1,
            column: 1,
            ruleId: "ASD-STE100-1.1",
            message: 'keep "must" out of the approved set.',
          },
        ],
      }),
    );
    assert.equal(gate(result, "G2").ok, true);
  });

  it("fails G2 on Rule 1.1 after a human verifies the vocabulary", () => {
    const official = Buffer.from(`${JSON.stringify({ words: ["qzvstelemmaone"] })}\n`);
    const result = runCli(
      ["--mode", "pr"],
      deps({
        cwd: connectedCwd(sha256(official), { vocabularyReview: "human-verified" }),
        officialVocabularyBytes: () => official,
        findings: [
          {
            path: "docs/note.md",
            line: 1,
            column: 1,
            ruleId: "ASD-STE100-1.1",
            message: 'keep "must" out of the approved set.',
          },
        ],
      }),
    );
    assert.equal(gate(result, "G2").ok, false);
  });

  it("keeps T2-HEURISTIC findings visible without failing G2", () => {
    const result = runCli(
      ["--mode", "fixture"],
      deps({
        findings: [
          {
            path: "docs/note.md",
            line: 1,
            column: 1,
            ruleId: "T2-HEURISTIC-contraction",
            message: "contraction is not used in STE.",
          },
        ],
      }),
    );
    assert.equal(gate(result, "G2").ok, true);
    assert.equal(result.ok, true);
    const printed = result.aggregate.findings as Array<string>;
    assert.equal(
      printed.some((line) => line.includes("T2-HEURISTIC-contraction")),
      true,
    );
  });

  it("fails G2 on T10 claim findings", () => {
    const result = runCli(
      ["--mode", "fixture"],
      deps({
        findings: [
          {
            path: "docs/note.md",
            line: 1,
            column: 1,
            ruleId: "T10",
            message: "The T2 reject this approval or this name.",
          },
        ],
      }),
    );
    assert.equal(gate(result, "G2").ok, false);
    assert.equal(result.ok, false);
  });

  it("fails G2 on T2 identifier-policy findings", () => {
    const result = runCli(
      ["--mode", "fixture"],
      deps({
        findings: [
          {
            path: "docs/note.md",
            line: 1,
            column: 1,
            ruleId: "T2-IDENTIFIER-projection",
            message: 'The T2 keep "xyzzyGate" off this name.',
          },
        ],
      }),
    );
    assert.equal(gate(result, "G2").ok, false);
    assert.equal(result.ok, false);
  });

  it("fails G2 on T2 canonical-term findings", () => {
    const result = runCli(
      ["--mode", "fixture"],
      deps({
        findings: [
          {
            path: "docs/note.md",
            line: 1,
            column: 1,
            ruleId: "T2-TERM-canonical",
            message: 'Keep "Work-Registry" as the work-registry.',
          },
        ],
      }),
    );
    assert.equal(gate(result, "G2").ok, false);
    assert.equal(result.ok, false);
  });

  it("does not let a not-applicable intent result hide another gate failure", () => {
    const result = runCli(
      ["--mode", "pr"],
      deps({
        changedPaths: ["docs/note.md"],
        findings: [
          {
            path: "docs/note.md",
            line: 1,
            column: 1,
            ruleId: "ASD-STE100-5.1",
            message: "The count stay 24. The maximum stay 20.",
          },
        ],
      }),
    );
    assert.equal(
      result.gates.some((gate) => gate.id === "G4" && gate.status === "not_applicable"),
      true,
    );
    assert.equal(result.ok, false);
  });

  it("fails G5 in PR mode when the review is missing", () => {
    const result = runCli(["--mode", "pr"], deps());
    assert.equal(gate(result, "G5").ok, false);
    assert.match(gate(result, "G5").reason, /review[\s`]*is[\s`]*missing/i);
    assert.equal(result.ok, false);
  });

  it("passes G5 in PR mode with a valid distinct-principal APPROVED review on head", () => {
    const result = runCli(["--mode", "pr"], deps(connectedOfficial(withValidReview())));
    assert.equal(gate(result, "G5").ok, true);
    assert.equal(result.ok, true);
  });

  it("fails G5 in PR mode when the author reviews their own pull", () => {
    const result = runCli(
      ["--mode", "pr"],
      deps({
        pull: reviewPull(),
        review: approvedReview({ userId: 1 }),
        roster: reviewRoster,
      }),
    );
    assert.equal(gate(result, "G5").ok, false);
    assert.match(gate(result, "G5").reason, /self-review/i);
    assert.equal(result.ok, false);
  });

  it("fails G6 when a proposed override is rejected", () => {
    const proposedOverride: ProposedOverride = {
      pullNumber: 3,
      repositoryId: 7,
      reviewId: 44,
      headSha: HEAD_SHA,
      findings: [
        {
          file: "docs/note.md",
          line: 1,
          ruleId: "ASD-STE100-5.1",
          contentSha256: "a".repeat(64),
          occurrenceAnchor: "docs/note.md:1:ASD-STE100-5.1:0",
          repairAttemptHashes: ["b".repeat(64)],
          reason: "proper name cannot be shortened",
        },
      ],
    };
    for (const mode of ["pr", "release"] as const) {
      const result = runCli(
        ["--mode", mode],
        deps(
          connectedOfficial(
            withValidReview({
              proposedOverride,
              overrideCurrentFindings: [],
            }),
          ),
        ),
      );
      assert.equal(gate(result, "G5").ok, true, `${mode} G5`);
      assert.equal(gate(result, "G6").ok, false, `${mode} G6`);
      assert.equal(result.ok, false, `${mode} aggregate`);
    }
  });

  it("passes G6 in PR mode when a valid review has no override", () => {
    const result = runCli(["--mode", "pr"], deps(connectedOfficial(withValidReview())));
    assert.equal(gate(result, "G6").ok, true);
    assert.equal(result.ok, true);
  });

  it("keeps G5 not applicable in fixture and main modes", () => {
    const fixture = runCli(["--mode", "fixture"], deps());
    const main = runCli(["--mode", "main"], deps(connectedOfficial()));
    assert.equal(gate(fixture, "G5").ok, true);
    assert.equal(gate(fixture, "G5").status, "not_applicable");
    assert.equal(gate(main, "G5").ok, true);
    assert.equal(gate(main, "G5").status, "not_applicable");
    assert.equal(fixture.ok, true);
    assert.equal(main.ok, true);
  });

  it("keeps G5 not applicable in release mode when no pull is present", () => {
    const result = runCli(["--mode", "release"], deps());
    assert.equal(gate(result, "G5").ok, true);
    assert.equal(gate(result, "G5").status, "not_applicable");
  });

  it("loads a matching main-result.json as the release baseline", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "asd-baseline-"));
    mkdirSync(path.join(dir, ".cache/asd-ste100"), { recursive: true });
    writeFileSync(
      path.join(dir, ".cache/asd-ste100/main-result.json"),
      `${JSON.stringify({ ok: true, sourceSha: "headsha" })}\n`,
    );
    const loaded = loadMainBaseline(dir, "headsha");
    assert.equal(loaded.ok, true);
    assert.equal(loaded.sourceSha, "headsha");
    assert.equal(loaded.attestationPresent, true);
    const missing = loadMainBaseline(dir, "other");
    assert.equal(missing.ok, false);
    assert.equal(missing.attestationPresent, false);
  });

  it("fails intent applicability when governed system text has no trace evidence", () => {
    const result = runCli(
      ["--mode", "pr"],
      deps({
        changedPaths: ["docs/system-text.md"],
        governedSystemTextWithoutTrace: true,
      }),
    );
    assert.equal(result.ok, false);
    assert.equal(
      result.gates.some((gate) => gate.id === "G4" && gate.ok === false),
      true,
    );
  });

  it("records main-mode corpus paths rather than a PR delta", () => {
    const result = runCli(["--mode", "main"], deps());
    assert.deepEqual(result.scannedPaths, ["docs/note.md", "scripts/asd-ste100/cli.ts"]);
  });

  it("writes nothing when the leak scan fails or is unavailable", () => {
    const unavailable = runCli(["--mode", "main"], deps({ leakScanAvailable: false }));
    const leaked = runCli(
      ["--mode", "main"],
      deps({
        officialVocabularyBytes: () => Buffer.from("secret-vocab-token"),
        findings: [
          {
            path: "docs/note.md",
            line: 1,
            column: 1,
            ruleId: "ASD-STE100-5.1",
            message: "secret-vocab-token",
          },
        ],
      }),
    );
    assert.equal(unavailable.exitCategory, "leak");
    assert.equal(unavailable.outputs.length, 0);
    assert.equal(leaked.exitCategory, "leak");
    assert.equal(leaked.outputs.length, 0);
  });

  it("keeps private vocabulary bytes out of result JSON", () => {
    const result = runCli(
      ["--mode", "fixture"],
      deps({ officialVocabularyBytes: () => Buffer.from("secret-vocab-token") }),
    );
    assert.equal(JSON.stringify(result.aggregate).includes("secret-vocab-token"), false);
  });
});

describe("loadScanLexicon", () => {
  it("uses official words and reviewed terms only, not synthetic fixture words", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "asd-lexicon-"));
    writeFileSync(
      path.join(dir, "t2.asd-ste100.terms.json"),
      `${JSON.stringify({
        subjectFields: {
          "asd-enforcement": { admittedTerms: ["Forgejo"] },
        },
        terms: [
          {
            term: "Forgejo",
            kind: "noun",
            reviewed: true,
            concept: "The self-hosted git forge that admits T2 work.",
            canonical: true,
            technicalTermClass: "product-name",
            subjectFields: ["asd-enforcement"],
            asdBasis: ["1.5"],
            softwareForms: { typescriptType: "ForgejoHost" },
          },
        ],
      })}\n`,
    );
    const syntheticDir = path.join(dir, "scripts/asd-ste100/test/fixtures/vocab");
    mkdirSync(syntheticDir, { recursive: true });
    writeFileSync(
      path.join(syntheticDir, "synthetic.json"),
      JSON.stringify({ words: ["attestation", "runner", "override"] }),
    );
    const lexicon = loadScanLexicon(dir, Buffer.from(JSON.stringify({ words: ["synthlemmaaaa"] })));
    assert.equal(lexicon.approvedWords.has("synthlemmaaaa"), true);
    assert.equal(lexicon.approvedWords.has("attestation"), false);
    assert.equal(
      lexicon.technicalTerms.some((term) => term.term === "Forgejo"),
      true,
    );
  });
});

describe("createDefaultDeps", () => {
  it("fails closed when connected mode has no official vocabulary file", () => {
    const previous = process.env.ASD_STE100_VOCABULARY;
    delete process.env.ASD_STE100_VOCABULARY;
    try {
      assert.throws(
        () => createDefaultDeps(repoRoot, "pr"),
        (error: unknown) =>
          error instanceof VocabularyMissingError ||
          (error instanceof Error && error.name === "VocabularyMissingError"),
      );
    } finally {
      if (previous === undefined) {
        delete process.env.ASD_STE100_VOCABULARY;
      } else {
        process.env.ASD_STE100_VOCABULARY = previous;
      }
    }
  });
});

describe("runFixtureSelfTest", () => {
  it("requires mapping records for live reviewed rules", () => {
    assert.doesNotThrow(() => runFixtureSelfTest(repoRoot));
  });
});

describe("attestation fields", () => {
  it("copies author and reviewer ids from the run", () => {
    const result = runCli(
      ["--mode", "fixture"],
      deps({
        authorIds: [11],
        reviewerIds: [22],
        overrides: [{ reviewId: 3 }],
      }),
    );
    assert.deepEqual(result.attestation?.authorIds, [11]);
    assert.deepEqual(result.attestation?.reviewerIds, [22]);
    assert.deepEqual(result.attestation?.overrides, [{ reviewId: 3 }]);
    assert.notEqual(result.attestation?.ownershipSha256, result.attestation?.vocabularySha256);
  });
});

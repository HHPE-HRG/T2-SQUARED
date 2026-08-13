import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { VocabularyMissingError } from "./vocabulary.ts";
import { EXIT, parseMode, resolvePrGitRefs, runCli } from "./cli.ts";
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
  governedSystemTextWithoutTrace: false,
  writeOutput: () => undefined,
  ...overrides,
});

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
    assert.match(result.reason, /source SHA/i);
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
            message: "sentence has 24 words. Maximum is 20.",
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
            message: "sentence has 24 words. Maximum is 20.",
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

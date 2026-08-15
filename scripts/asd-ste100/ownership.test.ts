import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { scanGovernedFindings } from "./cli.ts";
import {
  classifyCommitMessage,
  classifyPath,
  collectScopeRecords,
  loadOwnershipManifest,
  resolveUpstreamAncestry,
} from "./ownership.ts";
import type { OwnershipManifest, UpstreamLock } from "./ownership.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoOwnershipPath = path.join(repoRoot, "t2.asd-ste100.ownership.json");
const nonSteSentence =
  "This conversation sentence is deliberately longer than twenty-five words so it would fail a T2 length rule.\n";

function git(cwd: string, args: ReadonlyArray<string>): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function initRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "asd-own-"));
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test"]);
  git(root, ["config", "commit.gpgsign", "false"]);
  return root;
}

function write(root: string, relative: string, contents: string): void {
  const full = path.join(root, relative);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

function commit(root: string, message: string): string {
  git(root, ["add", "-A"]);
  git(root, ["commit", "-m", message]);
  return git(root, ["rev-parse", "HEAD"]);
}

const emptyManifest = (): OwnershipManifest => ({
  ownedGlobs: [],
  rawGlobs: [],
  machineGlobs: [],
  fixtureGlobs: [],
  privilegedGlobs: [],
  externalEvidenceGlobs: [],
});

describe("classifyPath", () => {
  it("fails a new T2 file that matches no owned pattern", () => {
    const result = classifyPath("docs/new-operator-note.md", emptyManifest());
    assert.equal(result.className, "unclassified");
    assert.match(result.reason, /no owned pattern/i);
  });

  it("classifies privileged control files before review validation", () => {
    const manifest = emptyManifest();
    manifest.privilegedGlobs.push("t2.asd-ste100.json");
    const result = classifyPath("t2.asd-ste100.json", manifest);
    assert.equal(result.className, "privileged");
  });

  it("classifies a provider error fixture as external evidence that requires redaction", () => {
    const manifest = emptyManifest();
    manifest.externalEvidenceGlobs.push("scripts/asd-ste100/test/fixtures/evidence/**");
    const result = classifyPath(
      "scripts/asd-ste100/test/fixtures/evidence/provider-error.txt",
      manifest,
    );
    assert.equal(result.className, "external-evidence");
    assert.equal(result.requiresRedaction, true);
  });
});

describe("collectScopeRecords", () => {
  it("excludes unchanged upstream Markdown from the governed set", () => {
    const root = initRepo();
    write(
      root,
      "README.md",
      "This upstream sentence is deliberately longer than twenty words so it would fail a T2 length rule.\n",
    );
    const base = commit(root, "upstream readme");
    git(root, ["checkout", "-b", "t2"]);
    write(root, "scripts/asd-ste100/cli.ts", "export {}\n");
    const head = commit(root, "add checker");

    const manifest = emptyManifest();
    manifest.ownedGlobs.push("scripts/asd-ste100/**");
    const records = collectScopeRecords({
      cwd: root,
      mode: "pr",
      baseSha: base,
      headSha: head,
      manifest,
    });
    assert.equal(
      records.some((record) => record.path === "README.md"),
      false,
    );
    assert.equal(
      records.some(
        (record) => record.path === "scripts/asd-ste100/cli.ts" && record.className === "owned",
      ),
      true,
    );
  });

  it("marks only T2-added paths as owned when an upstream file also changes", () => {
    const root = initRepo();
    write(root, "apps/server/src/index.ts", "export const n = 1;\n");
    const base = commit(root, "upstream source");
    git(root, ["checkout", "-b", "t2"]);
    write(
      root,
      "apps/server/src/index.ts",
      'export const n = 1;\nexport const t2Warning = "Do not skip the gate.";\n',
    );
    write(root, "scripts/asd-ste100/cli.ts", "export {}\n");
    const head = commit(root, "add warning");

    const manifest = emptyManifest();
    manifest.ownedGlobs.push("scripts/asd-ste100/**");
    const records = collectScopeRecords({
      cwd: root,
      mode: "pr",
      baseSha: base,
      headSha: head,
      manifest,
    });
    const upstreamChange = records.find((record) => record.path === "apps/server/src/index.ts");
    assert.ok(upstreamChange);
    assert.equal(upstreamChange.className, "owned-delta");
  });

  it("excludes fixture prose from full-corpus findings", () => {
    const root = initRepo();
    write(root, "scripts/asd-ste100/cli.ts", "export {}\n");
    write(
      root,
      "scripts/asd-ste100/test/fixtures/prose/failing.md",
      "This fixture sentence is intentionally noncompliant.\n",
    );
    const sha = commit(root, "fixtures");
    const manifest = emptyManifest();
    manifest.ownedGlobs.push("scripts/asd-ste100/**");
    manifest.fixtureGlobs.push("scripts/asd-ste100/test/fixtures/**");
    const records = collectScopeRecords({
      cwd: root,
      mode: "corpus",
      baseSha: sha,
      headSha: sha,
      manifest,
    });
    const fixture = records.find((record) =>
      record.path.endsWith("test/fixtures/prose/failing.md"),
    );
    assert.ok(fixture);
    assert.equal(fixture.className, "fixture");
    assert.equal(fixture.includeInCorpusFindings, false);
  });
});

describe("classifyCommitMessage", () => {
  it("keeps an imported upstream commit message outside the governed set", () => {
    const result = classifyCommitMessage({
      sha: "abc123",
      message: "fix(web): keep lists scrollable (#6423)",
      imported: true,
    });
    assert.equal(result.className, "upstream-unchanged");
    assert.equal(result.includeInCorpusFindings, false);
  });
});

describe("resolveUpstreamAncestry", () => {
  it("fails when the upstream URL does not match the lock", () => {
    const root = initRepo();
    write(root, "README.md", "x\n");
    const sha = commit(root, "init");
    git(root, ["remote", "add", "upstream", "https://example.com/wrong.git"]);
    const lock: UpstreamLock = {
      url: "https://github.com/pingdotgg/t3code.git",
      acceptedBaseSha: sha,
    };
    assert.throws(
      () => resolveUpstreamAncestry({ cwd: root, lock }),
      (error: unknown) => error instanceof Error && /upstream URL/i.test(error.message),
    );
  });

  it("fails when the locked base is not an ancestor", () => {
    const root = initRepo();
    write(root, "README.md", "x\n");
    commit(root, "init");
    git(root, ["remote", "add", "upstream", "https://github.com/pingdotgg/t3code.git"]);
    const lock: UpstreamLock = {
      url: "https://github.com/pingdotgg/t3code.git",
      acceptedBaseSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    };
    assert.throws(
      () => resolveUpstreamAncestry({ cwd: root, lock }),
      (error: unknown) => error instanceof Error && /ancestor/i.test(error.message),
    );
  });
});

describe("loadOwnershipManifest", () => {
  it("loads a closed manifest from disk", () => {
    const root = initRepo();
    write(
      root,
      "t2.asd-ste100.ownership.json",
      JSON.stringify({
        ownedGlobs: ["scripts/asd-ste100/**"],
        rawGlobs: ["scripts/asd-ste100/test/fixtures/raw/**"],
        machineGlobs: [],
        fixtureGlobs: ["scripts/asd-ste100/test/fixtures/**"],
        privilegedGlobs: ["t2.asd-ste100*.json"],
        externalEvidenceGlobs: ["scripts/asd-ste100/test/fixtures/evidence/**"],
      }),
    );
    const manifest = loadOwnershipManifest(path.join(root, "t2.asd-ste100.ownership.json"));
    assert.deepEqual(manifest.ownedGlobs, ["scripts/asd-ste100/**"]);
  });
});

describe("repo ownership admission exclusions", () => {
  const manifest = loadOwnershipManifest(repoOwnershipPath);

  it("classifies transcripts as raw and keeps them out of corpus findings", () => {
    const result = classifyPath("transcripts/session.md", manifest);
    assert.equal(result.className, "raw");
    assert.equal(result.includeInCorpusFindings, false);
    const nested = classifyPath("transcripts/agent/chat.jsonl", manifest);
    assert.equal(nested.className, "raw");
    assert.equal(nested.includeInCorpusFindings, false);
  });

  it("classifies lockfiles, images, and binaries as machine text", () => {
    const paths = [
      "pnpm-lock.yaml",
      "package-lock.json",
      "apps/web/package-lock.json",
      "logo.png",
      "assets/logo.png",
      "docs/diagram.jpg",
      "native/tool.bin",
    ];
    for (const filePath of paths) {
      const result = classifyPath(filePath, manifest);
      assert.equal(result.className, "machine", filePath);
      assert.equal(result.includeInCorpusFindings, false, filePath);
    }
  });

  it("does not report an STE finding for a noncompliant transcript and leaves bytes unchanged", () => {
    const root = initRepo();
    write(root, "t2.asd-ste100.ownership.json", readFileSync(repoOwnershipPath, "utf8"));
    write(
      root,
      "t2.asd-ste100.terms.json",
      JSON.stringify({
        terms: [{ term: "Forgejo", kind: "noun", reviewed: true }],
      }),
    );
    write(root, "transcripts/session.md", nonSteSentence);
    write(root, "pnpm-lock.yaml", `lockfileVersion: 9.0\n# ${nonSteSentence}`);
    const sha = commit(root, "raw transcript and lockfile");
    const records = collectScopeRecords({
      cwd: root,
      mode: "corpus",
      baseSha: sha,
      headSha: sha,
      manifest: loadOwnershipManifest(path.join(root, "t2.asd-ste100.ownership.json")),
    });
    assert.equal(
      records.find((record) => record.path === "transcripts/session.md")?.className,
      "raw",
    );
    assert.equal(records.find((record) => record.path === "pnpm-lock.yaml")?.className, "machine");
    const before = createHash("sha256")
      .update(readFileSync(path.join(root, "transcripts/session.md")))
      .digest("hex");

    const scanned = scanGovernedFindings({
      cwd: root,
      mode: "corpus",
      baseSha: sha,
      headSha: sha,
      officialBytes: null,
    });
    const after = createHash("sha256")
      .update(readFileSync(path.join(root, "transcripts/session.md")))
      .digest("hex");

    assert.equal(before, after);
    assert.equal(
      scanned.findings.some((finding) => finding.path.startsWith("transcripts/")),
      false,
    );
    assert.equal(
      scanned.findings.some((finding) => finding.path.endsWith("pnpm-lock.yaml")),
      false,
    );
    assert.equal(scanned.paths.includes("transcripts/session.md"), false);
    assert.equal(scanned.paths.includes("pnpm-lock.yaml"), false);
  });
});

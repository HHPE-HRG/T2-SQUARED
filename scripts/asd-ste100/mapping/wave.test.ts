import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_CHUNK_PAGES,
  MAX_CHUNK_PAGES,
  MIN_CHUNK_PAGES,
  type ManifestPage,
} from "./chunk.ts";
import { scanMappingLeak, type MappingAgentChunk, type MappingRow } from "./merge.ts";
import {
  HEURISTIC_CARD_PATH,
  SYNTHETIC_DICTIONARY_NEEDLES,
  buildCoverageLedger,
  buildWaveJob,
  partitionWaves,
  runWaves,
  scanGitDiffLeak,
  type WaveJob,
} from "./wave.ts";

const mappingDir = path.dirname(fileURLToPath(import.meta.url));

function syntheticManifest(pageCount: number, startPage = 1): Array<ManifestPage> {
  return Array.from({ length: pageCount }, (_, offset) => {
    const page = startPage + offset;
    return {
      page,
      path: `/off-git/synthetic/page-${String(page).padStart(3, "0")}.bin`,
    };
  });
}

describe("partitionWaves", () => {
  it("splits a 430-page synthetic ordered set into 22 waves at default size 20 (420+10)", () => {
    const manifest = syntheticManifest(430);
    const waves = partitionWaves(manifest);
    assert.equal(waves.length, 22);
    assert.ok(waves.every((wave) => wave.pageCount >= MIN_CHUNK_PAGES));
    assert.ok(waves.every((wave) => wave.pageCount <= MAX_CHUNK_PAGES));
    assert.ok(waves.slice(0, 21).every((wave) => wave.pageCount === DEFAULT_CHUNK_PAGES));
    assert.equal(waves[21]?.pageCount, 10);
    assert.equal(waves[0]?.startPage, 1);
    assert.equal(waves[0]?.endPage, 20);
    assert.equal(waves[21]?.startPage, 421);
    assert.equal(waves[21]?.endPage, 430);
  });

  it("absorbs a remainder under 10 pages so every chunk stays in 10-40", () => {
    const manifest = syntheticManifest(429);
    const waves = partitionWaves(manifest, DEFAULT_CHUNK_PAGES);
    assert.equal(
      waves.reduce((sum, wave) => sum + wave.pageCount, 0),
      429,
    );
    assert.ok(waves.every((wave) => wave.pageCount >= MIN_CHUNK_PAGES));
    assert.ok(waves.every((wave) => wave.pageCount <= MAX_CHUNK_PAGES));
    assert.equal(waves.at(-1)?.pageCount, 29);
    assert.equal(waves.at(-1)?.startPage, 401);
    assert.equal(waves.at(-1)?.endPage, 429);
  });

  it("reuses consecutive closed ranges from the synthetic manifest", () => {
    const manifest = syntheticManifest(430);
    const waves = partitionWaves(manifest);
    for (const wave of waves) {
      assert.equal(wave.pageCount, wave.endPage - wave.startPage + 1);
      assert.equal(wave.pages.length, wave.pageCount);
      assert.equal(wave.pages[0]?.page, wave.startPage);
      assert.equal(wave.pages.at(-1)?.page, wave.endPage);
      assert.equal(
        wave.pages[0]?.path,
        `/off-git/synthetic/page-${String(wave.startPage).padStart(3, "0")}.bin`,
      );
    }
  });
});

describe("buildCoverageLedger", () => {
  it("assigns every source page exactly once across 430 pages", () => {
    const manifest = syntheticManifest(430);
    const waves = partitionWaves(manifest);
    const ledger = buildCoverageLedger(waves);
    assert.equal(ledger.length, 430);
    const pages = ledger.map((entry) => entry.page);
    assert.deepEqual(
      pages,
      Array.from({ length: 430 }, (_, offset) => offset + 1),
    );
    assert.equal(new Set(pages).size, 430);
    for (const entry of ledger) {
      const wave = waves[entry.waveIndex];
      assert.ok(wave);
      assert.ok(entry.page >= wave.startPage && entry.page <= wave.endPage);
    }
  });
});

describe("buildWaveJob", () => {
  it("isolates a wave payload to its range plus the heuristic card path only", () => {
    const manifest = syntheticManifest(430);
    const waves = partitionWaves(manifest);
    const job = buildWaveJob(waves[3]!, HEURISTIC_CARD_PATH);
    assert.equal(job.startPage, 61);
    assert.equal(job.endPage, 80);
    assert.equal(job.pageCount, 20);
    assert.equal(job.pages.length, 20);
    assert.equal(job.heuristicCardPath, HEURISTIC_CARD_PATH);
    assert.equal(path.basename(job.heuristicCardPath), "AGENT_HEURISTIC.md");
    assert.equal(path.dirname(path.resolve(mappingDir, job.heuristicCardPath)), mappingDir);
    assert.deepEqual(Object.keys(job).sort(), [
      "endPage",
      "heuristicCardPath",
      "pageCount",
      "pages",
      "startPage",
    ]);
    assert.equal("waves" in job, false);
    assert.equal("coverage" in job, false);
    assert.equal("priorWaves" in job, false);
    const encoded = JSON.stringify(job);
    assert.equal(encoded.includes('"startPage":1,'), false);
    assert.equal(encoded.includes("page-001"), false);
    assert.equal(encoded.includes("page-421"), false);
  });
});

function mappingRow(partial: Partial<MappingRow> & Pick<MappingRow, "id" | "class">): MappingRow {
  return {
    sourcePages: partial.sourcePages ?? [1],
    proposedCheckerId: partial.proposedCheckerId ?? `checker-${partial.id}`,
    reviewed: false,
    reviewerId: null,
    reviewNotes: null,
    ...partial,
  };
}

function chunkForJob(job: WaveJob, rows: Array<MappingRow>): MappingAgentChunk {
  return { startPage: job.startPage, endPage: job.endPage, rows };
}

function initTempGit(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "asd-ste100-wave-"));
  execFileSync("git", ["init"], { cwd: dir, stdio: "pipe" });
  writeFileSync(path.join(dir, "README"), "synthetic-wave-workspace\n");
  execFileSync("git", ["add", "README"], { cwd: dir, stdio: "pipe" });
  execFileSync(
    "git",
    ["-c", "user.email=wave@test", "-c", "user.name=wave", "commit", "-m", "init"],
    { cwd: dir, stdio: "pipe" },
  );
  return dir;
}

function gitOutput(cwd: string, args: Array<string>): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const err = error as { stdout?: string };
    return typeof err.stdout === "string" ? err.stdout : "";
  }
}

function gitDiffIncludingUntracked(cwd: string): string {
  const untracked = gitOutput(cwd, ["ls-files", "--others", "--exclude-standard"]);
  const parts = [gitOutput(cwd, ["diff"]), gitOutput(cwd, ["diff", "--cached"])];
  for (const rel of untracked.split("\n").filter(Boolean)) {
    parts.push(gitOutput(cwd, ["diff", "--no-index", "--", "/dev/null", path.join(cwd, rel)]));
  }
  return parts.join("\n");
}

describe("runWaves", () => {
  it("retries a failed wave only on its page range and merges sibling ids without duplicates", async () => {
    const waves = partitionWaves(syntheticManifest(40), DEFAULT_CHUNK_PAGES);
    const calls: Array<{ startPage: number; endPage: number }> = [];
    let secondWaveAttempts = 0;
    const agent = (job: WaveJob): MappingAgentChunk => {
      calls.push({ startPage: job.startPage, endPage: job.endPage });
      if (job.startPage === 21) {
        secondWaveAttempts += 1;
        if (secondWaveAttempts === 1) {
          throw new Error("transient vision failure");
        }
        return chunkForJob(job, [
          mappingRow({ id: "5.1", class: "deterministic", sourcePages: [21] }),
          mappingRow({ id: "9.2", class: "fail_closed_uncheckable", sourcePages: [22] }),
        ]);
      }
      return chunkForJob(job, [
        mappingRow({ id: "5.1", class: "deterministic", sourcePages: [1] }),
        mappingRow({ id: "2.1", class: "private_lexicon", sourcePages: [2] }),
      ]);
    };

    const dir = mkdtempSync(path.join(tmpdir(), "asd-ste100-wave-out-"));
    const result = await runWaves(waves, agent, { outputDir: dir, maxAttempts: 2 });

    assert.equal(calls.filter((call) => call.startPage === 1).length, 1);
    assert.equal(calls.filter((call) => call.startPage === 21).length, 2);
    assert.ok(calls.every((call) => call.endPage - call.startPage + 1 === 20));
    assert.deepEqual(
      calls.filter((call) => call.startPage === 21),
      [
        { startPage: 21, endPage: 40 },
        { startPage: 21, endPage: 40 },
      ],
    );
    assert.equal(
      calls.some((call) => call.startPage === 1 && call.endPage !== 20),
      false,
    );
    const ids = result.records.map((entry) => entry.id);
    assert.deepEqual(ids, [...new Set(ids)]);
    assert.deepEqual(ids, ["2.1", "5.1", "9.2"]);
    const shared = result.records.find((entry) => entry.id === "5.1");
    assert.deepEqual(shared?.sourcePages, [1, 21]);
    assert.equal(result.attemptsByWave[1], 2);
    assert.equal(result.attemptsByWave[0], 1);
  });

  it("does not write records when a wave payload contains a synthetic leak", async () => {
    const waves = partitionWaves(syntheticManifest(20), DEFAULT_CHUNK_PAGES);
    const needle = SYNTHETIC_DICTIONARY_NEEDLES[0]!;
    const agent = (job: WaveJob): MappingAgentChunk =>
      chunkForJob(job, [
        mappingRow({
          id: "8.1",
          class: "private_lexicon",
          sourcePages: [job.startPage],
          proposedCheckerId: needle,
        }),
      ]);

    const dir = mkdtempSync(path.join(tmpdir(), "asd-ste100-wave-leak-"));
    await assert.rejects(() => runWaves(waves, agent, { outputDir: dir, maxAttempts: 2 }), /leak/i);
    assert.equal(existsSync(path.join(dir, "records.json")), false);
    assert.deepEqual(readdirSync(dir), []);
  });
});

describe("scanGitDiffLeak", () => {
  it("flags JPG bytes and synthetic official dictionary needles in a git diff", () => {
    const needle = SYNTHETIC_DICTIONARY_NEEDLES[0]!;
    const jpgDiff = `diff --git a/x.jpg b/x.jpg\nindex 111..222\nBinary files /dev/null and b/x.jpg differ\n${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("binary")}`;
    const jpgScan = scanGitDiffLeak(jpgDiff, SYNTHETIC_DICTIONARY_NEEDLES);
    assert.equal(jpgScan.ok, false);
    assert.match(jpgScan.reason, /jpg|jpeg/i);

    const wordDiff = `diff --git a/records.json b/records.json\n+  "proposedCheckerId": "${needle}"\n`;
    const wordScan = scanGitDiffLeak(wordDiff, SYNTHETIC_DICTIONARY_NEEDLES);
    assert.equal(wordScan.ok, false);
    assert.match(wordScan.reason, /dictionary|official|leak/i);
  });

  it("keeps git diff free of JPG bytes and official needles after a clean wave write", async () => {
    const repo = initTempGit();
    const outputDir = path.join(repo, "records");
    mkdirSync(outputDir);
    const waves = partitionWaves(syntheticManifest(20), DEFAULT_CHUNK_PAGES);
    const agent = (job: WaveJob): MappingAgentChunk =>
      chunkForJob(job, [
        mappingRow({
          id: "6.3",
          class: "deterministic",
          sourcePages: [job.startPage],
          proposedCheckerId: "procedural-sentence-word-count",
        }),
      ]);

    await runWaves(waves, agent, { outputDir, gitCwd: repo, maxAttempts: 1 });
    execFileSync("git", ["add", "-A"], { cwd: repo, stdio: "pipe" });
    const diff = gitDiffIncludingUntracked(repo);
    const scan = scanGitDiffLeak(diff, SYNTHETIC_DICTIONARY_NEEDLES);
    assert.equal(scan.ok, true);
    assert.equal(
      scanMappingLeak([
        {
          id: "6.3",
          class: "deterministic",
          sourcePages: [1],
          proposedCheckerId: "procedural-sentence-word-count",
          reviewed: false,
          reviewerId: null,
          reviewNotes: null,
        },
      ]).ok,
      true,
    );
    assert.equal(diff.includes("\xff\xd8"), false);
    for (const needle of SYNTHETIC_DICTIONARY_NEEDLES) {
      assert.equal(diff.includes(needle), false);
    }
  });

  it("flags an untracked leak file in gitCwd and does not write records.json", async () => {
    const repo = initTempGit();
    const outputDir = path.join(repo, "records");
    mkdirSync(outputDir);
    const needle = SYNTHETIC_DICTIONARY_NEEDLES[0]!;
    writeFileSync(path.join(repo, "untracked-leak.txt"), `${needle}\n`);

    const waves = partitionWaves(syntheticManifest(20), DEFAULT_CHUNK_PAGES);
    const agent = (job: WaveJob): MappingAgentChunk =>
      chunkForJob(job, [
        mappingRow({
          id: "6.3",
          class: "deterministic",
          sourcePages: [job.startPage],
          proposedCheckerId: "procedural-sentence-word-count",
        }),
      ]);

    await assert.rejects(
      () => runWaves(waves, agent, { outputDir, gitCwd: repo, maxAttempts: 1 }),
      /dictionary|official|leak/i,
    );
    assert.equal(existsSync(path.join(outputDir, "records.json")), false);
  });

  it("never writes records.json when git-diff leak scan fails", async () => {
    const repo = initTempGit();
    const outputDir = path.join(repo, "records");
    mkdirSync(outputDir);
    const needle = SYNTHETIC_DICTIONARY_NEEDLES[0]!;
    writeFileSync(path.join(repo, "staged-leak.txt"), `${needle}\n`);
    execFileSync("git", ["add", "staged-leak.txt"], { cwd: repo, stdio: "pipe" });
    chmodSync(outputDir, 0o555);

    const waves = partitionWaves(syntheticManifest(20), DEFAULT_CHUNK_PAGES);
    const agent = (job: WaveJob): MappingAgentChunk =>
      chunkForJob(job, [
        mappingRow({
          id: "6.3",
          class: "deterministic",
          sourcePages: [job.startPage],
          proposedCheckerId: "procedural-sentence-word-count",
        }),
      ]);

    try {
      await assert.rejects(
        () => runWaves(waves, agent, { outputDir, gitCwd: repo, maxAttempts: 1 }),
        /dictionary|official|leak/i,
      );
      assert.equal(existsSync(path.join(outputDir, "records.json")), false);
    } finally {
      chmodSync(outputDir, 0o755);
    }
  });

  it("fails closed when git diff cannot run in the wave cwd", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "asd-ste100-nongit-"));
    const waves = partitionWaves(syntheticManifest(20), DEFAULT_CHUNK_PAGES);
    const agent = (job: WaveJob): MappingAgentChunk =>
      chunkForJob(job, [
        mappingRow({
          id: "6.3",
          class: "deterministic",
          sourcePages: [job.startPage],
          proposedCheckerId: "procedural-sentence-word-count",
        }),
      ]);
    await assert.rejects(
      () => runWaves(waves, agent, { outputDir: dir, gitCwd: dir, maxAttempts: 1 }),
      /git diff failed/i,
    );
  });
});

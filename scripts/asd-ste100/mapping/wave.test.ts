import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_CHUNK_PAGES,
  MAX_CHUNK_PAGES,
  MIN_CHUNK_PAGES,
  type ManifestPage,
} from "./chunk.ts";
import { HEURISTIC_CARD_PATH, buildCoverageLedger, buildWaveJob, partitionWaves } from "./wave.ts";

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

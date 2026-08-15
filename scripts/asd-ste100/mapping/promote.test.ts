import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { AsdProfile } from "../vocabulary.ts";
import { DEFAULT_CHUNK_PAGES, type ManifestPage } from "./chunk.ts";
import { scanMappingLeak, type MappingRow } from "./merge.ts";
import {
  attachMappingRule,
  coverageFromPrivateLexicon,
  markMappingReviewed,
  promoteMappingToProfile,
  scanCoverageLeak,
  writePrivateLexiconCoverage,
} from "./promote.ts";
import { buildCoverageLedger, partitionWaves } from "./wave.ts";

const mappingDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(mappingDir, "../../..");

function sha256(contents: string): string {
  return createHash("sha256").update(contents, "utf8").digest("hex");
}

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

function syntheticManifest(pageCount: number): Array<ManifestPage> {
  return Array.from({ length: pageCount }, (_, offset) => {
    const page = offset + 1;
    return {
      page,
      path: `/off-git/synthetic/page-${String(page).padStart(3, "0")}.bin`,
    };
  });
}

function liveProfileCopy(): AsdProfile {
  const profile = JSON.parse(
    readFileSync(path.join(repoRoot, "t2.asd-ste100.json"), "utf8"),
  ) as AsdProfile;
  const rulesFile = JSON.parse(
    readFileSync(path.join(repoRoot, "t2.asd-ste100.rules.json"), "utf8"),
  ) as { rules: NonNullable<AsdProfile["rules"]> };
  return {
    ...profile,
    rules: rulesFile.rules.map((rule) => ({ ...rule })),
  };
}

describe("markMappingReviewed", () => {
  it("refuses reviewed:true without a different reviewerId than the author", () => {
    const row = mappingRow({ id: "9.2", class: "fail_closed_uncheckable", sourcePages: [21] });
    assert.throws(
      () =>
        markMappingReviewed(row, {
          authorId: "mapper-a",
          reviewerId: "mapper-a",
          reviewNotes: null,
        }),
      /self-review|reviewerId|distinct/i,
    );
    assert.throws(
      () =>
        markMappingReviewed(row, {
          authorId: "mapper-a",
          reviewerId: "",
          reviewNotes: null,
        }),
      /reviewerId/i,
    );
    const reviewed = markMappingReviewed(row, {
      authorId: "mapper-a",
      reviewerId: "reviewer-b",
      reviewNotes: "KTD28",
    });
    assert.equal(reviewed.reviewed, true);
    assert.equal(reviewed.reviewerId, "reviewer-b");
    assert.equal(row.reviewed, false);
  });
});

describe("attachMappingRule / promoteMappingToProfile", () => {
  it("cannot attach an unreviewed deterministic mapping row as reviewed: true", () => {
    const profile = liveProfileCopy();
    const priorIds = (profile.rules ?? []).map((rule) => rule.id);
    const unreviewed = mappingRow({
      id: "8.4",
      class: "deterministic",
      sourcePages: [40],
      proposedCheckerId: "synthetic-new-checker",
      reviewed: false,
      reviewerId: null,
    });

    assert.throws(() => attachMappingRule(profile, unreviewed), /unreviewed/i);

    const forced: MappingRow = { ...unreviewed, reviewed: true, reviewerId: null };
    assert.throws(() => attachMappingRule(profile, forced), /reviewerId|unreviewed|distinct/i);

    const promoted = promoteMappingToProfile(profile, [unreviewed]);
    assert.equal(
      (promoted.rules ?? []).some((rule) => rule.id === "8.4"),
      false,
    );
    assert.deepEqual(
      (promoted.rules ?? []).map((rule) => rule.id),
      priorIds,
    );
    assert.equal(
      (promoted.rules ?? []).every((rule) => rule.reviewed === true),
      true,
    );
    assert.equal(
      (profile.rules ?? []).every((rule) => rule.reviewed === true),
      true,
    );
  });

  it("cannot attach an unreviewed row to t2.asd-ste100.rules.json as reviewed: true", () => {
    const rulesPath = path.join(repoRoot, "t2.asd-ste100.rules.json");
    const rulesFile = JSON.parse(readFileSync(rulesPath, "utf8")) as {
      rules: NonNullable<AsdProfile["rules"]>;
    };
    const profile = liveProfileCopy();
    assert.equal(profile.rules?.length, rulesFile.rules.length);
    assert.deepEqual(
      (profile.rules ?? []).map((rule) => rule.id),
      rulesFile.rules.map((rule) => rule.id),
    );
    assert.equal(
      rulesFile.rules.every((rule) => rule.reviewed === true),
      true,
    );

    const unreviewed = mappingRow({
      id: "8.4",
      class: "deterministic",
      sourcePages: [40],
      proposedCheckerId: "synthetic-rules-json-checker",
      reviewed: false,
      reviewerId: null,
    });

    assert.throws(() => attachMappingRule(profile, unreviewed), /unreviewed/i);

    const forcedReviewed: MappingRow = { ...unreviewed, reviewed: true, reviewerId: null };
    assert.throws(
      () => attachMappingRule(profile, forcedReviewed),
      /reviewerId|unreviewed|distinct/i,
    );
    assert.equal(
      JSON.parse(readFileSync(rulesPath, "utf8")).rules.some(
        (rule: { id: string; reviewed: boolean }) => rule.id === "8.4" && rule.reviewed === true,
      ),
      false,
    );

    const uncheckableReviewed = mappingRow({
      id: "9.2",
      class: "fail_closed_uncheckable",
      sourcePages: [21],
      proposedCheckerId: "fail-closed-uncheckable",
      reviewed: true,
      reviewerId: "reviewer-b",
    });
    assert.throws(
      () => attachMappingRule(profile, uncheckableReviewed),
      /deterministic|live profile/i,
    );
    assert.equal(
      rulesFile.rules.some((rule) => rule.id === "9.2" && rule.reviewed === true),
      false,
    );
  });

  it("keeps the coverage ledger complete after a promote skip", () => {
    const manifest = syntheticManifest(40);
    const waves = partitionWaves(manifest, DEFAULT_CHUNK_PAGES);
    const ledger = buildCoverageLedger(waves);
    assert.equal(ledger.length, 40);
    assert.deepEqual(
      ledger.map((entry) => entry.page),
      Array.from({ length: 40 }, (_, offset) => offset + 1),
    );

    const profile = liveProfileCopy();
    const skipped = mappingRow({
      id: "8.4",
      class: "deterministic",
      sourcePages: [21],
      proposedCheckerId: "synthetic-skipped-checker",
    });
    const promoted = promoteMappingToProfile(profile, [skipped]);
    assert.equal(
      (promoted.rules ?? []).some((rule) => rule.id === "8.4"),
      false,
    );
    const ledgerAfter = buildCoverageLedger(waves);
    assert.equal(ledgerAfter.length, 40);
    assert.deepEqual(ledgerAfter, ledger);
  });
});

describe("private_lexicon coverage", () => {
  it("records digest and lemma counts without a word list, and leak-scan fails a word-list payload", () => {
    const extract = "synthlemmaaaa synthlemmabbb synthlemmaccc";
    const rows = [
      mappingRow({
        id: "2.1",
        class: "private_lexicon",
        sourcePages: [30, 31],
        proposedCheckerId: "vocabulary-membership",
      }),
    ];
    const coverage = coverageFromPrivateLexicon({
      rows,
      startPage: 21,
      endPage: 40,
      lemmaCount: 3,
      privateExtract: extract,
    });
    assert.equal(coverage.class, "private_lexicon");
    assert.equal(coverage.startPage, 21);
    assert.equal(coverage.endPage, 40);
    assert.equal(coverage.lemmaCount, 3);
    assert.equal(coverage.privateExtractDigest, sha256(extract));
    assert.equal("words" in coverage, false);
    assert.equal(JSON.stringify(coverage).includes(extract), false);
    assert.equal(scanCoverageLeak(coverage).ok, true);
    assert.equal(scanMappingLeak(rows).ok, true);

    const dir = mkdtempSync(path.join(tmpdir(), "asd-ste100-coverage-"));
    const written = writePrivateLexiconCoverage(coverage, dir);
    const payload = JSON.parse(readFileSync(written, "utf8")) as Record<string, unknown>;
    assert.equal("words" in payload, false);
    assert.doesNotMatch(JSON.stringify(payload), /synthlemmaaaa/);

    const leaked = { ...coverage, words: ["synthlemmaaaa", "synthlemmabbb"] };
    const leak = scanCoverageLeak(leaked);
    assert.equal(leak.ok, false);
    assert.match(leak.reason, /word.?list/i);
    writeFileSync(path.join(dir, "leaked.json"), `${JSON.stringify(leaked)}\n`);
    assert.throws(() => writePrivateLexiconCoverage(leaked, dir), /word.?list/i);
    assert.equal(readdirSync(dir).includes("coverage.json"), true);
  });
});

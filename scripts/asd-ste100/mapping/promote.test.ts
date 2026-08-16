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
  assertReviewedRulesHaveMappingRecords,
  coverageFromPrivateLexicon,
  humanIdentityCount,
  loadLiveMappingRecords,
  loadMappingPrincipals,
  markMappingReviewed,
  promoteMappingToProfile,
  reviewOfficialMappingRows,
  scanCoverageLeak,
  selfSignAllowed,
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
    assert.equal(reviewed.authorId, "mapper-a");
    assert.equal(row.reviewed, false);
    assert.throws(
      () =>
        markMappingReviewed(
          mappingRow({
            id: "9.2",
            class: "fail_closed_uncheckable",
            authorId: "u12-wave-author",
          }),
          {
            authorId: "laundered-author",
            reviewerId: "u12-wave-author",
            reviewNotes: null,
          },
        ),
      /self-review|distinct|principal/i,
    );
  });
});

describe("reviewOfficialMappingRows", () => {
  const identities = [
    { id: "u12-wave-author", principal: "t2-asd-u12-mapping-session", kind: "agent" as const },
    { id: "u12-wave-subagent", principal: "t2-asd-u12-mapping-session", kind: "agent" as const },
    { id: "operator-reviewer", principal: "operator-human", kind: "human" as const },
  ];

  it("refuses a sub-agent reviewer that shares the mapping principal", () => {
    const rows = [
      mappingRow({
        id: "1.1",
        class: "deterministic",
        authorId: "u12-wave-author",
        proposedCheckerId: "vocabulary-membership",
      }),
    ];
    assert.throws(
      () =>
        reviewOfficialMappingRows(
          rows,
          {
            authorId: "u12-wave-author",
            reviewerId: "u12-wave-subagent",
            reviewNotes: "KTD28",
          },
          identities,
        ),
      /principal|human|agent/i,
    );
  });

  it("marks writing-rule rows when the reviewer principal differs, and leaves private_lexicon unreviewed", () => {
    const rows = [
      mappingRow({
        id: "1.1",
        class: "deterministic",
        authorId: "u12-wave-author",
        proposedCheckerId: "vocabulary-membership",
        sourcePages: [41],
      }),
      mappingRow({
        id: "part2-dictionary",
        class: "private_lexicon",
        authorId: "u12-wave-author",
        proposedCheckerId: "vocabulary-membership",
        sourcePages: [181],
      }),
    ];
    const next = reviewOfficialMappingRows(
      rows,
      {
        authorId: "u12-wave-author",
        reviewerId: "operator-reviewer",
        reviewNotes: "KTD28",
      },
      identities,
    );
    const writing = next.find((row) => row.id === "1.1");
    const lexicon = next.find((row) => row.id === "part2-dictionary");
    assert.equal(writing?.reviewed, true);
    assert.equal(writing?.reviewerId, "operator-reviewer");
    assert.equal(lexicon?.reviewed, false);
    assert.equal(lexicon?.reviewerId, null);
  });

  it("allows a human to self-sign when fewer than two humans exist, and still refuses agent reviewers", () => {
    const singleHuman = [
      { id: "u12-wave-author", principal: "t2-single-operator", kind: "agent" as const },
      { id: "operator-self-sign", principal: "t2-single-operator", kind: "human" as const },
    ];
    assert.equal(humanIdentityCount(singleHuman), 1);
    assert.equal(selfSignAllowed(singleHuman), true);
    const rows = [
      mappingRow({
        id: "1.1",
        class: "deterministic",
        authorId: "u12-wave-author",
        proposedCheckerId: "vocabulary-membership",
        sourcePages: [41],
      }),
    ];
    const signed = reviewOfficialMappingRows(
      rows,
      {
        authorId: "u12-wave-author",
        reviewerId: "operator-self-sign",
        reviewNotes: "KTD28 self-sign: single operator",
      },
      singleHuman,
    );
    assert.equal(signed[0]?.reviewed, true);
    assert.equal(signed[0]?.reviewerId, "operator-self-sign");
    assert.match(signed[0]?.reviewNotes ?? "", /self-sign/i);

    assert.throws(
      () =>
        reviewOfficialMappingRows(
          rows,
          {
            authorId: "u12-wave-author",
            reviewerId: "u12-wave-author",
            reviewNotes: "KTD28 self-sign: single operator",
          },
          singleHuman,
        ),
      /agent|principal|human/i,
    );

    const twoHumans = [
      ...singleHuman,
      { id: "second-human", principal: "other-human", kind: "human" as const },
    ];
    assert.equal(selfSignAllowed(twoHumans), false);
    assert.throws(
      () =>
        reviewOfficialMappingRows(
          rows,
          {
            authorId: "u12-wave-author",
            reviewerId: "operator-self-sign",
            reviewNotes: "KTD28 self-sign: single operator",
          },
          twoHumans,
        ),
      /principal/i,
    );
  });

  it("keeps committed official wave rows unreviewed as the merge artifact", () => {
    const officialPath = path.join(mappingDir, "records/official-unreviewed.json");
    const payload = JSON.parse(readFileSync(officialPath, "utf8")) as { rows: Array<MappingRow> };
    const identitiesOnDisk = loadMappingPrincipals(repoRoot);
    assert.equal(
      identitiesOnDisk.some((entry) => entry.id === "u12-wave-author"),
      true,
    );
    assert.equal(
      identitiesOnDisk.some((entry) => entry.id === "operator-self-sign" && entry.kind === "human"),
      true,
    );
    assert.equal(selfSignAllowed(identitiesOnDisk), true);
    assert.throws(
      () =>
        reviewOfficialMappingRows(
          payload.rows,
          {
            authorId: "u12-wave-author",
            reviewerId: "u12-wave-author",
            reviewNotes: "KTD28",
          },
          identitiesOnDisk,
        ),
      /self-review|distinct|principal|human|agent/i,
    );
    assert.equal(
      payload.rows.every((row) => row.reviewed === false && row.reviewerId === null),
      true,
    );
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

describe("live mapping records", () => {
  it("keeps reviewerId and sourcePages on a promoted live rule", () => {
    const profile = liveProfileCopy();
    const row = mappingRow({
      id: "5.1",
      class: "deterministic",
      sourcePages: [12, 13],
      proposedCheckerId: "procedural-sentence-word-count",
      reviewed: true,
      authorId: "mapper-a",
      reviewerId: "reviewer-b",
    });
    const next = attachMappingRule(profile, row);
    const live = (next.rules ?? []).find((rule) => rule.id === "5.1");
    assert.equal(live?.reviewerId, "reviewer-b");
    assert.deepEqual(live?.sourcePages, [12, 13]);
    assert.equal(live?.authorId, "mapper-a");
  });

  it("fails reviewed live rules without a mapping record", () => {
    assert.throws(
      () =>
        assertReviewedRulesHaveMappingRecords(
          [{ id: "1.1", reviewed: true, checker: "vocabulary-membership" }],
          [],
        ),
      /mapping record/i,
    );
  });

  it("loads mapping records for every live reviewed rule", () => {
    const profile = liveProfileCopy();
    const records = loadLiveMappingRecords(repoRoot);
    assertReviewedRulesHaveMappingRecords(profile.rules ?? [], records);
    assert.equal(
      records.every((row) => row.reviewerId !== null && row.reviewerId !== row.authorId),
      true,
    );
  });

  it("assigns every official source page once in the committed coverage ledger", () => {
    const ledgerPath = path.join(mappingDir, "records/coverage-ledger.json");
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as Array<{
      page: number;
      waveIndex: number;
    }>;
    assert.equal(ledger.length, 430);
    assert.deepEqual(
      ledger.map((entry) => entry.page),
      Array.from({ length: 430 }, (_, offset) => offset + 1),
    );
    const waves = new Set(ledger.map((entry) => entry.waveIndex));
    assert.equal(waves.size, 22);
    const leak = scanMappingLeak(
      ledger.map((entry) =>
        mappingRow({
          id: `p${entry.page}`,
          class: "private_lexicon",
          sourcePages: [entry.page],
          proposedCheckerId: "coverage-ledger",
        }),
      ),
    );
    assert.equal(leak.ok, true);
  });

  it("records Issue 9 self-sign provenance on live mapping rows", () => {
    const livePath = path.join(mappingDir, "records/records.json");
    const live = JSON.parse(readFileSync(livePath, "utf8")) as {
      coverageKind: string;
      issue9PagesMapped: boolean;
      selfSign: boolean;
      rows: Array<MappingRow>;
    };
    assert.equal(live.coverageKind, "issue9-self-sign");
    assert.equal(live.issue9PagesMapped, true);
    assert.equal(live.selfSign, true);
    assert.equal(
      live.rows.every((row) => row.reviewed === true && row.reviewerId === "operator-self-sign"),
      true,
    );
    assert.equal(
      live.rows.every((row) => row.sourcePages.length > 0),
      true,
    );
    assert.equal(
      live.rows.every((row) => /self-sign/i.test(row.reviewNotes ?? "")),
      true,
    );
  });

  it("assigns every official page in unreviewed mapping rows without claiming review", () => {
    const officialPath = path.join(mappingDir, "records/official-unreviewed.json");
    const payload = JSON.parse(readFileSync(officialPath, "utf8")) as {
      coverageKind: string;
      issue9PagesMapped: boolean;
      rows: Array<MappingRow>;
    };
    assert.equal(payload.coverageKind, "official-wave-unreviewed");
    assert.equal(payload.issue9PagesMapped, true);
    assert.equal(
      payload.rows.every((row) => row.reviewed === false),
      true,
    );
    assert.equal(
      payload.rows.every((row) => row.reviewerId === null && row.reviewNotes === null),
      true,
    );
    const pages = new Set(payload.rows.flatMap((row) => row.sourcePages));
    assert.equal(pages.size, 430);
    for (let page = 1; page <= 430; page += 1) {
      assert.equal(pages.has(page), true, `missing page ${page}`);
    }
    assert.equal(scanMappingLeak(payload.rows).ok, true);
  });
});

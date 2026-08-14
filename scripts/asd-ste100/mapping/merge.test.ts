import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  dryRunSyntheticMerge,
  mergeMappings,
  scanMappingLeak,
  writeMappingRecords,
  type MappingAgentChunk,
  type MappingRow,
} from "./merge.ts";

function row(partial: Partial<MappingRow> & Pick<MappingRow, "id" | "class">): MappingRow {
  return {
    sourcePages: partial.sourcePages ?? [1],
    proposedCheckerId: partial.proposedCheckerId ?? `checker-${partial.id}`,
    reviewed: partial.reviewed ?? false,
    reviewerId: partial.reviewerId ?? null,
    reviewNotes: partial.reviewNotes ?? null,
    ...partial,
  };
}

function agent(startPage: number, endPage: number, rows: Array<MappingRow>): MappingAgentChunk {
  return { startPage, endPage, rows };
}

describe("mergeMappings", () => {
  it("merges two agents on disjoint ranges into a set with stable key order", () => {
    const first = agent(1, 20, [
      row({ id: "6.3", class: "deterministic", sourcePages: [11, 12] }),
      row({ id: "5.1", class: "deterministic", sourcePages: [1, 2] }),
    ]);
    const second = agent(21, 40, [
      row({ id: "9.2", class: "fail_closed_uncheckable", sourcePages: [21] }),
      row({ id: "2.1", class: "private_lexicon", sourcePages: [30] }),
    ]);

    const merged = mergeMappings([first, second]);
    assert.deepEqual(
      merged.map((entry) => entry.id),
      ["2.1", "5.1", "6.3", "9.2"],
    );
    assert.equal(merged[0]?.class, "private_lexicon");
    assert.equal(merged[1]?.class, "deterministic");
    assert.equal(merged[2]?.class, "deterministic");
    assert.equal(merged[3]?.class, "fail_closed_uncheckable");
  });

  it("fails when overlapping ranges disagree on checker class", () => {
    const first = agent(1, 20, [row({ id: "5.1", class: "deterministic", sourcePages: [18, 19] })]);
    const second = agent(15, 34, [
      row({ id: "5.1", class: "fail_closed_uncheckable", sourcePages: [15, 16] }),
    ]);
    assert.throws(() => mergeMappings([first, second]), /class|conflict|overlap/i);
  });

  it("does not mark unreviewed rows as reviewed", () => {
    const merged = mergeMappings([
      agent(1, 10, [
        row({
          id: "4.5",
          class: "deterministic",
          sourcePages: [4],
          reviewed: true,
          reviewerId: "agent-self",
          reviewNotes: "premature",
        }),
      ]),
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.reviewed, false);
    assert.equal(merged[0]?.reviewerId, null);
    assert.equal(merged[0]?.reviewNotes, null);
  });
});

describe("scanMappingLeak", () => {
  it("fails a dictionary-shaped token and does not write records", () => {
    const leaked = row({
      id: "8.1",
      class: "private_lexicon",
      sourcePages: [8],
      proposedCheckerId: "ZZZXSYNTH (n)",
    });
    const scan = scanMappingLeak([leaked]);
    assert.equal(scan.ok, false);
    assert.match(scan.reason, /dictionary|leak/i);

    const dir = mkdtempSync(path.join(tmpdir(), "asd-ste100-merge-"));
    assert.throws(() => writeMappingRecords([leaked], dir), /dictionary|leak/i);
    assert.deepEqual(readdirSync(dir), []);
  });

  it("fails an example-like quotation and does not write records", () => {
    const leaked = row({
      id: "7.1",
      class: "deterministic",
      sourcePages: [7],
      proposedCheckerId: 'checker-7.1 "SYNTH_EXAMPLE_QUOTE_ZZ."',
    });
    const scan = scanMappingLeak([leaked]);
    assert.equal(scan.ok, false);
    assert.match(scan.reason, /example|quot|leak/i);

    const dir = mkdtempSync(path.join(tmpdir(), "asd-ste100-merge-"));
    assert.throws(() => writeMappingRecords([leaked], dir), /example|quot|leak/i);
    assert.equal(existsSync(path.join(dir, "records.json")), false);
  });
});

describe("dryRunSyntheticMerge", () => {
  it("produces the mapping record schema from synthetic pages without Issue 9 bytes", () => {
    const records = dryRunSyntheticMerge();
    assert.ok(records.length >= 1);
    for (const entry of records) {
      assert.equal(typeof entry.id, "string");
      assert.match(entry.id, /^[0-9]+(\.[0-9]+)*$/);
      assert.ok(
        entry.class === "deterministic" ||
          entry.class === "fail_closed_uncheckable" ||
          entry.class === "private_lexicon",
      );
      assert.ok(Array.isArray(entry.sourcePages));
      assert.ok(entry.sourcePages.every((page) => Number.isInteger(page) && page > 0));
      assert.equal(typeof entry.proposedCheckerId, "string");
      assert.equal(entry.reviewed, false);
      assert.equal(entry.reviewerId, null);
      assert.equal(entry.reviewNotes, null);
    }

    const dir = mkdtempSync(path.join(tmpdir(), "asd-ste100-merge-"));
    const written = writeMappingRecords(records, dir);
    const payload = JSON.parse(readFileSync(written, "utf8")) as Array<MappingRow>;
    assert.deepEqual(
      payload.map((entry) => entry.id),
      [...payload].map((entry) => entry.id).sort(),
    );
    const serialized = JSON.stringify(payload);
    assert.doesNotMatch(serialized, /Issue 9/i);
    assert.equal(scanMappingLeak(payload).ok, true);
  });
});

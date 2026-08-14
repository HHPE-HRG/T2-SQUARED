import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { dryRunSyntheticMerge, scanMappingLeak, type MappingRow } from "./merge.ts";

const mappingDir = path.dirname(fileURLToPath(import.meta.url));
const heuristicPath = path.join(mappingDir, "AGENT_HEURISTIC.md");
const gitkeepPath = path.join(mappingDir, "records", ".gitkeep");

function scanText(text: string): ReturnType<typeof scanMappingLeak> {
  const row: MappingRow = {
    id: "0",
    class: "deterministic",
    sourcePages: [1],
    proposedCheckerId: text,
    reviewed: false,
    reviewerId: null,
    reviewNotes: null,
  };
  return scanMappingLeak([row]);
}

describe("AGENT_HEURISTIC.md", () => {
  it("exists as the mapping-agent heuristic card", () => {
    assert.equal(existsSync(heuristicPath), true);
  });

  it("tells agents to extract identifiers only and classify checker families", () => {
    const card = readFileSync(heuristicPath, "utf8");
    assert.match(card, /identifier/i);
    assert.match(card, /instruction/i);
    assert.match(card, /rule/i);
    assert.match(card, /schema/i);
    assert.match(card, /specification/i);
    assert.match(card, /deterministic/);
    assert.match(card, /fail_closed_uncheckable/);
    assert.match(card, /private_lexicon/);
  });

  it("forbids quoting dictionary rows, examples, or definitions into git records", () => {
    const card = readFileSync(heuristicPath, "utf8");
    assert.match(card, /dictionary/i);
    assert.match(card, /example/i);
    assert.match(card, /definition/i);
    assert.match(card, /git/i);
    assert.doesNotMatch(card, /\bexamples?\s*:/i);
  });

  it("maps from pages in front of the agent with chunk 10-40 and default 20", () => {
    const card = readFileSync(heuristicPath, "utf8");
    assert.match(card, /KTD31/);
    assert.match(card, /\b10\b/);
    assert.match(card, /\b40\b/);
    assert.match(card, /\b20\b/);
  });

  it("leaves review fields empty until KTD28", () => {
    const card = readFileSync(heuristicPath, "utf8");
    assert.match(card, /KTD28/);
    assert.match(card, /review/i);
  });

  it("contains no dictionary-shaped token or example-like quotation", () => {
    const card = readFileSync(heuristicPath, "utf8");
    const scan = scanText(card);
    assert.equal(scan.ok, true);
  });

  it("fails leak scan if a dictionary-shaped token is inserted", () => {
    const card = readFileSync(heuristicPath, "utf8");
    const scan = scanText(`${card}\nZZZXSYNTH (n)`);
    assert.equal(scan.ok, false);
    assert.match(scan.reason, /dictionary|leak/i);
  });

  it("fails leak scan if an example-like quotation is inserted", () => {
    const card = readFileSync(heuristicPath, "utf8");
    const scan = scanText(`${card}\n"SYNTH_EXAMPLE_QUOTE_ZZ."`);
    assert.equal(scan.ok, false);
    assert.match(scan.reason, /example|quot|leak/i);
  });
});

describe("records/.gitkeep", () => {
  it("exists so the mapping records directory is tracked", () => {
    assert.equal(existsSync(gitkeepPath), true);
  });
});

describe("dry-run mapping schema", () => {
  it("still holds for synthetic merge records", () => {
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
    assert.equal(scanMappingLeak(records).ok, true);
  });
});

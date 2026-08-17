import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { enforcementClassFor, ENFORCEMENT_CLASSES } from "./enforcement-class.ts";
import type { CheckerClass, MappingRow } from "./merge.ts";
import { scanCoverageLeak } from "./promote.ts";

const recordsPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "records/official-unreviewed.json",
);
const overlayPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "records/enforcement-classes.json",
);

describe("enforcementClassFor", () => {
  it("maps live mechanical ids and overlay classes without quoting Issue 9 text", () => {
    assert.equal(enforcementClassFor("1.1", "deterministic"), "deterministic");
    assert.equal(enforcementClassFor("5.1", "deterministic"), "parser-mechanical");
    assert.equal(enforcementClassFor("1.5", "fail_closed_uncheckable"), "contextual/semantic");
    assert.equal(enforcementClassFor("1.2", "fail_closed_uncheckable"), "human-review");
    assert.equal(
      enforcementClassFor("part2-dictionary", "private_lexicon"),
      "not-applicable-to-surface",
    );
    assert.equal(
      enforcementClassFor("GR-1", "fail_closed_uncheckable"),
      "not-applicable-to-surface",
    );
  });
});

describe("enforcement-classes overlay", () => {
  it("classifies every official-unreviewed id", () => {
    const source = JSON.parse(readFileSync(recordsPath, "utf8")) as {
      rows: Array<MappingRow>;
    };
    const overlay = JSON.parse(readFileSync(overlayPath, "utf8")) as {
      classes: Array<{ id: string; enforcementClass: string; mappingClass: CheckerClass }>;
    };
    const overlayIds = new Set(overlay.classes.map((row) => row.id));
    for (const row of source.rows) {
      assert.equal(overlayIds.has(row.id), true, row.id);
      const expected = enforcementClassFor(row.id, row.class);
      const got = overlay.classes.find((entry) => entry.id === row.id);
      assert.equal(got?.enforcementClass, expected);
      assert.equal(ENFORCEMENT_CLASSES.includes(expected), true);
    }
    assert.equal(overlay.classes.length, source.rows.length);
    assert.equal(scanCoverageLeak(overlay).ok, true);
  });
});

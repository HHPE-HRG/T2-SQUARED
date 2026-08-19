import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { enforcementClassFor, ENFORCEMENT_CLASSES } from "./enforcement-class.ts";
import type { CheckerClass, MappingRow } from "./merge.ts";
import { loadLiveMappingRecords, scanCoverageLeak } from "./promote.ts";

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

  it("keeps overlay-only classes out of live G2 mapping records", () => {
    const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const overlay = JSON.parse(readFileSync(overlayPath, "utf8")) as {
      classes: Array<{ id: string; enforcementClass: string }>;
    };
    const profile = JSON.parse(readFileSync(path.join(repoRoot, "t2.asd-ste100.json"), "utf8")) as {
      rules: Array<{ id: string }>;
    };
    const liveIds = new Set(profile.rules.map((rule) => rule.id));
    const liveRecords = loadLiveMappingRecords(repoRoot);
    const liveRecordIds = new Set(liveRecords.map((row) => row.id));
    for (const row of overlay.classes) {
      const mechanical =
        row.enforcementClass === "deterministic" || row.enforcementClass === "parser-mechanical";
      assert.equal(liveIds.has(row.id), mechanical, row.id);
      assert.equal(liveRecordIds.has(row.id), mechanical, row.id);
    }
    assert.equal(
      liveRecords.every((row) => row.class !== "fail_closed_uncheckable"),
      true,
    );
  });
});

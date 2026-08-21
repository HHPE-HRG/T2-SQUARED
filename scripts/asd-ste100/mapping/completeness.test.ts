import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { admissionFindingsForRows } from "../admission.ts";
import { assertClassificationComplete, WRITING_RULE_IDS } from "./completeness.ts";
import { ENFORCEMENT_CLASSES, enforcementClassFor } from "./enforcement-class.ts";
import type { CheckerClass, MappingRow } from "./merge.ts";
import { loadLiveMappingRecords } from "./promote.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("writing-rule classification completeness", () => {
  it("locks the reviewed 63-id writing-rule ledger", () => {
    assert.equal(WRITING_RULE_IDS.length, 63);
    assert.doesNotThrow(() => assertClassificationComplete(repoRoot));
  });

  it("keeps live mapping records at the five mechanical ids", () => {
    const live = loadLiveMappingRecords(repoRoot);
    assert.deepEqual(
      live.map((row) => row.id),
      ["1.1", "4.5", "5.1", "6.3", "6.6"],
    );
  });

  it("fails when one inventory id is removed", () => {
    const root = ledgerFixture({ dropId: "9.4" });
    assert.throws(() => assertClassificationComplete(root), /missing writing-rule id: 9\.4/);
  });

  it("fails when an id has two classes or an unknown class", () => {
    const unknown = ledgerFixture({
      overlayPatch: { id: "1.2", enforcementClass: "invented" },
    });
    assert.throws(() => assertClassificationComplete(unknown), /unknown class: 1\.2/);
    const duplicate = ledgerFixture({ duplicateOverlayId: "1.2" });
    assert.throws(() => assertClassificationComplete(duplicate), /duplicate class: 1\.2/);
  });

  it("fails when a writing-rule row is unreviewed", () => {
    const root = ledgerFixture({ unreviewedId: "1.2" });
    assert.throws(() => assertClassificationComplete(root), /unreviewed writing-rule id: 1\.2/);
  });

  it("mints no overlay admission findings on the live five-id mapping", () => {
    const live = loadLiveMappingRecords(repoRoot);
    assert.equal(admissionFindingsForRows(live).length, 0);
    assert.equal(
      live.every((row) => {
        const mapped = enforcementClassFor(row.id, row.class);
        return mapped === "deterministic" || mapped === "parser-mechanical";
      }),
      true,
    );
  });

  it("fails closed when live mapping includes uncheckable 1.2 without an override", () => {
    const live = loadLiveMappingRecords(repoRoot);
    const findings = admissionFindingsForRows([
      ...live,
      {
        id: "1.2",
        class: "fail_closed_uncheckable",
        sourcePages: [41],
        proposedCheckerId: "fail-closed-uncheckable",
        reviewed: true,
        authorId: "u12-wave-author",
        reviewerId: "operator-co-sign",
        reviewNotes: "KTD28 co-sign: distinct mapping reviewer",
      },
    ]);
    assert.equal(
      findings.some((finding) => finding.ruleId === "T2-ADMISSION-uncheckable"),
      true,
    );
  });

  it("does not mint admission findings for overlay not-applicable ids absent from live mapping", () => {
    const liveIds = new Set(loadLiveMappingRecords(repoRoot).map((row) => row.id));
    assert.equal(liveIds.has("GR-1"), false);
    assert.equal(liveIds.has("front-matter"), false);
    assert.equal(admissionFindingsForRows(loadLiveMappingRecords(repoRoot)).length, 0);
  });
});

function ledgerFixture(input: {
  dropId?: string;
  unreviewedId?: string;
  duplicateOverlayId?: string;
  overlayPatch?: { id: string; enforcementClass: string };
}): string {
  const root = mkdtempSync(path.join(tmpdir(), "t2-asd-completeness-"));
  const recordsDir = path.join(root, "scripts/asd-ste100/mapping/records");
  mkdirSync(recordsDir, { recursive: true });
  const ids = WRITING_RULE_IDS.filter((id) => id !== input.dropId);
  const rows: Array<MappingRow> = ids.map((id) => {
    const mappingClass: CheckerClass =
      id === "1.1"
        ? "deterministic"
        : id === "part2-dictionary"
          ? "private_lexicon"
          : id === "4.5" || id === "5.1" || id === "6.3" || id === "6.6"
            ? "deterministic"
            : "fail_closed_uncheckable";
    return {
      id,
      class: mappingClass,
      sourcePages: [1],
      proposedCheckerId:
        mappingClass === "deterministic" ? "vocabulary-membership" : "fail-closed-uncheckable",
      reviewed: id === "part2-dictionary" ? false : id !== input.unreviewedId,
      authorId: "u12-wave-author",
      reviewerId:
        id === "part2-dictionary" || id === input.unreviewedId ? null : "operator-co-sign",
      reviewNotes:
        id === "part2-dictionary" || id === input.unreviewedId
          ? null
          : "KTD28 co-sign: distinct mapping reviewer",
    };
  });
  const classes = rows.map((row) => {
    const enforcementClass =
      input.overlayPatch?.id === row.id
        ? input.overlayPatch.enforcementClass
        : enforcementClassFor(row.id, row.class);
    return {
      id: row.id,
      mappingClass: row.class,
      enforcementClass,
      sourcePages: row.sourcePages,
    };
  });
  if (input.duplicateOverlayId !== undefined) {
    const original = classes.find((row) => row.id === input.duplicateOverlayId);
    if (original !== undefined) {
      classes.push({ ...original });
    }
  }
  writeFileSync(
    path.join(recordsDir, "official-unreviewed.json"),
    `${JSON.stringify({ coverageKind: "issue9-writing-rule-classification", rows }, null, 2)}\n`,
  );
  writeFileSync(
    path.join(recordsDir, "enforcement-classes.json"),
    `${JSON.stringify({ coverageKind: "issue9-enforcement-class-overlay", classes }, null, 2)}\n`,
  );
  assert.equal(ENFORCEMENT_CLASSES.includes("human-review"), true);
  return root;
}

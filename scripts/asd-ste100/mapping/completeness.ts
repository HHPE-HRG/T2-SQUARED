import { readFileSync } from "node:fs";
import path from "node:path";

import { ENFORCEMENT_CLASSES, enforcementClassFor } from "./enforcement-class.ts";
import type { CheckerClass, MappingRow } from "./merge.ts";

/**
 * Closed Issue 9 writing-rule inventory for T2 classification completeness.
 * Ids only. Do not copy official rule text into Git.
 */
export const WRITING_RULE_IDS = [
  "1.1",
  "1.10",
  "1.11",
  "1.12",
  "1.13",
  "1.14",
  "1.2",
  "1.3",
  "1.4",
  "1.5",
  "1.6",
  "1.7",
  "1.8",
  "1.9",
  "2.1",
  "2.2",
  "3.1",
  "3.2",
  "3.3",
  "3.4",
  "3.5",
  "3.6",
  "3.7",
  "4.1",
  "4.2",
  "4.3",
  "4.4",
  "4.5",
  "5.1",
  "5.2",
  "5.3",
  "5.4",
  "5.5",
  "6.1",
  "6.2",
  "6.3",
  "6.4",
  "6.5",
  "6.6",
  "7.1",
  "7.2",
  "7.3",
  "8.1",
  "8.2",
  "8.3",
  "8.4",
  "8.5",
  "8.6",
  "8.7",
  "9.1",
  "9.2",
  "9.3",
  "9.4",
  "GR-1",
  "GR-2",
  "GR-3",
  "GR-4",
  "GR-5",
  "GR-6",
  "GR-7",
  "GR-8",
  "front-matter",
  "part2-dictionary",
] as const;

export const CLASSIFICATION_LEDGER_PATH =
  "scripts/asd-ste100/mapping/records/official-unreviewed.json";
export const ENFORCEMENT_OVERLAY_PATH =
  "scripts/asd-ste100/mapping/records/enforcement-classes.json";

const INVENTORY = new Set<string>(WRITING_RULE_IDS);

export class ClassificationCompleteError extends Error {
  override readonly name = "ClassificationCompleteError";
  constructor(message: string) {
    super(message);
  }
}

interface OverlayRow {
  id: string;
  mappingClass: CheckerClass;
  enforcementClass: string;
}

function loadJson<T>(root: string, relative: string): T {
  return JSON.parse(readFileSync(path.join(root, relative), "utf8")) as T;
}

export function assertClassificationComplete(root: string): void {
  const ledger = loadJson<{ rows?: Array<MappingRow> }>(root, CLASSIFICATION_LEDGER_PATH);
  const overlay = loadJson<{ classes?: Array<OverlayRow> }>(root, ENFORCEMENT_OVERLAY_PATH);
  const rows = ledger.rows ?? [];
  const classes = overlay.classes ?? [];
  const rowIds = new Set<string>();
  for (const row of rows) {
    if (rowIds.has(row.id)) {
      throw new ClassificationCompleteError(`duplicate class: ${row.id}`);
    }
    rowIds.add(row.id);
  }
  for (const id of WRITING_RULE_IDS) {
    if (!rowIds.has(id)) {
      throw new ClassificationCompleteError(`missing writing-rule id: ${id}`);
    }
  }
  const overlayCounts = new Map<string, number>();
  for (const entry of classes) {
    overlayCounts.set(entry.id, (overlayCounts.get(entry.id) ?? 0) + 1);
  }
  for (const [id, count] of overlayCounts) {
    if (count > 1) {
      throw new ClassificationCompleteError(`duplicate class: ${id}`);
    }
  }
  for (const entry of classes) {
    if (!(ENFORCEMENT_CLASSES as ReadonlyArray<string>).includes(entry.enforcementClass)) {
      throw new ClassificationCompleteError(`unknown class: ${entry.id}`);
    }
  }
  for (const row of rows) {
    if (!INVENTORY.has(row.id)) {
      throw new ClassificationCompleteError(`unknown writing-rule id: ${row.id}`);
    }
    const overlayRow = classes.find((entry) => entry.id === row.id);
    if (overlayRow === undefined) {
      throw new ClassificationCompleteError(`missing writing-rule id: ${row.id}`);
    }
    const expected = enforcementClassFor(row.id, row.class);
    if (overlayRow.enforcementClass !== expected) {
      throw new ClassificationCompleteError(`unknown class: ${row.id}`);
    }
    if (row.class === "private_lexicon") {
      continue;
    }
    if (!row.reviewed || row.reviewerId === null || row.reviewerId.length === 0) {
      throw new ClassificationCompleteError(`unreviewed writing-rule id: ${row.id}`);
    }
  }
}

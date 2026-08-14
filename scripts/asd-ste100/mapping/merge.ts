import { writeFileSync } from "node:fs";
import path from "node:path";

export const CHECKER_CLASSES = [
  "deterministic",
  "fail_closed_uncheckable",
  "private_lexicon",
] as const;

export type CheckerClass = (typeof CHECKER_CLASSES)[number];

export interface MappingRow {
  id: string;
  class: CheckerClass;
  sourcePages: Array<number>;
  proposedCheckerId: string;
  reviewed: boolean;
  reviewerId: string | null;
  reviewNotes: string | null;
}

export interface MappingAgentChunk {
  startPage: number;
  endPage: number;
  rows: Array<MappingRow>;
}

export interface MappingLeakScan {
  ok: boolean;
  reason: string;
}

/** Synthetic Issue 9 stand-ins. Never copy official dictionary words into git. */
export const SYNTHETIC_DICTIONARY_NEEDLES = ["SYNTHOFFICIALLEMMAZZZX"] as const;

const JPEG_SOI = "\xff\xd8";
const JPEG_SOI_HEX = /ff\s*d8\s*ff/i;
const JPEG_BASE64 = /\/9j\//;

const DICTIONARY_SHAPED = /\b[A-Za-z][A-Za-z'-]*\s+(?:\((?:n|v|adj|adv)\)|(?:n|v|adj|adv)\.)/;
const EXAMPLE_LIKE_QUOTE = /["“][^"”]{8,}[.!?]["”]/;
const EXAMPLE_LABEL = /\bexamples?\s*:/i;

function emptyReview(row: MappingRow): MappingRow {
  return {
    id: row.id,
    class: row.class,
    sourcePages: [...row.sourcePages].sort((left, right) => left - right),
    proposedCheckerId: row.proposedCheckerId,
    reviewed: false,
    reviewerId: null,
    reviewNotes: null,
  };
}

function rangesOverlap(left: MappingAgentChunk, right: MappingAgentChunk): boolean {
  return left.startPage <= right.endPage && right.startPage <= left.endPage;
}

function collectStrings(value: unknown): Array<string> {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

export function scanMappingLeak(rows: ReadonlyArray<MappingRow>): MappingLeakScan {
  for (const row of rows) {
    for (const text of collectStrings(row)) {
      if (text.includes(JPEG_SOI) || JPEG_SOI_HEX.test(text) || JPEG_BASE64.test(text)) {
        return { ok: false, reason: "jpg byte leak" };
      }
      for (const needle of SYNTHETIC_DICTIONARY_NEEDLES) {
        if (text.includes(needle)) {
          return { ok: false, reason: "official dictionary word leak" };
        }
      }
      if (DICTIONARY_SHAPED.test(text)) {
        return { ok: false, reason: "dictionary-shaped token leak" };
      }
      if (EXAMPLE_LIKE_QUOTE.test(text) || EXAMPLE_LABEL.test(text)) {
        return { ok: false, reason: "example-like quotation leak" };
      }
    }
  }
  return { ok: true, reason: "" };
}

export function compareDottedIds(left: string, right: string): number {
  return left.localeCompare(right, "en", { numeric: true });
}

export function mergeMappings(agents: ReadonlyArray<MappingAgentChunk>): Array<MappingRow> {
  const byId = new Map<string, MappingRow>();
  const owners = new Map<string, Array<MappingAgentChunk>>();

  for (const agent of agents) {
    for (const raw of agent.rows) {
      const next = emptyReview(raw);
      const existing = byId.get(next.id);
      if (existing !== undefined && existing.class !== next.class) {
        const prior = owners.get(next.id) ?? [];
        const overlapped = prior.some((other) => rangesOverlap(other, agent));
        const detail = overlapped ? "overlapping ranges" : "duplicate id";
        throw new Error(`checker class conflict for ${next.id} (${detail})`);
      }
      if (existing === undefined) {
        byId.set(next.id, next);
      } else {
        const pages = new Set([...existing.sourcePages, ...next.sourcePages]);
        byId.set(next.id, {
          ...existing,
          sourcePages: [...pages].sort((left, right) => left - right),
          proposedCheckerId: existing.proposedCheckerId,
        });
      }
      const seen = owners.get(next.id) ?? [];
      seen.push(agent);
      owners.set(next.id, seen);
    }
  }

  return [...byId.values()].sort((left, right) => compareDottedIds(left.id, right.id));
}

export function writeMappingRecords(rows: ReadonlyArray<MappingRow>, outputDir: string): string {
  const scan = scanMappingLeak(rows);
  if (!scan.ok) {
    throw new Error(scan.reason);
  }
  const normalized = mergeMappings([
    {
      startPage: 1,
      endPage: 1,
      rows: rows.map((row) => emptyReview(row)),
    },
  ]);
  const target = path.join(outputDir, "records.json");
  writeFileSync(target, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return target;
}

export function dryRunSyntheticMerge(): Array<MappingRow> {
  return mergeMappings([
    {
      startPage: 1,
      endPage: 20,
      rows: [
        emptyReview({
          id: "5.1",
          class: "deterministic",
          sourcePages: [1, 2],
          proposedCheckerId: "procedural-sentence-word-count",
          reviewed: false,
          reviewerId: null,
          reviewNotes: null,
        }),
        emptyReview({
          id: "6.3",
          class: "deterministic",
          sourcePages: [11],
          proposedCheckerId: "descriptive-sentence-word-count",
          reviewed: false,
          reviewerId: null,
          reviewNotes: null,
        }),
      ],
    },
    {
      startPage: 21,
      endPage: 40,
      rows: [
        emptyReview({
          id: "2.1",
          class: "private_lexicon",
          sourcePages: [30],
          proposedCheckerId: "vocabulary-membership",
          reviewed: false,
          reviewerId: null,
          reviewNotes: null,
        }),
        emptyReview({
          id: "9.2",
          class: "fail_closed_uncheckable",
          sourcePages: [21],
          proposedCheckerId: "fail-closed-uncheckable",
          reviewed: false,
          reviewerId: null,
          reviewNotes: null,
        }),
      ],
    },
  ]);
}

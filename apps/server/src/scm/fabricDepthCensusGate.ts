/**
 * Fabric-depth census gate (FD0 contracts).
 *
 * Intended: refuse Ordered depth exit / soft-fallback-retire GREEN while any
 * sole-lander census row for that slice’s activatable seams is stub|observe.
 * Handoff stubs on non-lander slices do not block when a lander row is real
 * (proof-bar.md / manifold-io-census.md).
 *
 * Observed: reads docs/scm/fabric-depth/evidence/manifold-io-census.json.
 * Does not mutate inventory radius. Does not invent G11.
 */
import { readFileSync } from "node:fs";

import type { G10FabricSliceId } from "./g10Types.ts";

/** Manifold I/O honesty class from Battery A census. */
export type ManifoldIoClass = "real" | "stub" | "observe" | "dormant-exempt" | "unknown";

/** One census row (machine schema). */
export type ManifoldIoCensusRow = {
  readonly commId: string;
  readonly landerModule: string;
  readonly slice: string;
  readonly manifoldClass: ManifoldIoClass;
  readonly evidencePath?: string;
  readonly note?: string;
};

/** Parsed census document. */
export type ManifoldIoCensusDoc = {
  readonly schemaVersion: number;
  readonly rows: readonly ManifoldIoCensusRow[];
};

/**
 * Load census JSON from disk.
 */
export const loadManifoldIoCensus = (censusPath: string): ManifoldIoCensusDoc => {
  const raw = JSON.parse(readFileSync(censusPath, "utf8")) as ManifoldIoCensusDoc;
  if (!Array.isArray(raw.rows)) {
    throw new Error(`Fabric-depth census gate: missing rows in ${censusPath}`);
  }
  return raw;
};

/**
 * True when a stub/observe row is a handoff (non-blocking) per census note.
 *
 * Agent: sole-lander debt is rows whose lander path is still stub|observe.
 * Notes containing "handoff" mark non-lander bookkeeping stubs.
 */
export const isHandoffStubRow = (row: ManifoldIoCensusRow): boolean => {
  const note = (row.note ?? "").toLowerCase();
  return note.includes("handoff");
};

/**
 * Sole-lander blocking rows for a slice: stub|observe and not handoff.
 */
export const soleLanderDebtForSlice = (
  doc: ManifoldIoCensusDoc,
  slice: G10FabricSliceId,
): readonly ManifoldIoCensusRow[] =>
  doc.rows.filter(
    (row) =>
      row.slice === slice &&
      (row.manifoldClass === "stub" || row.manifoldClass === "observe") &&
      !isHandoffStubRow(row),
  );

/**
 * Refuse depth-exit / soft-fallback-retire while sole-lander debt remains.
 *
 * Throws
 * ------
 * Error
 *     When any non-handoff stub|observe row exists for the slice.
 */
export const assertSoleLandersRealForSlice = (
  censusPath: string,
  slice: G10FabricSliceId,
): void => {
  const doc = loadManifoldIoCensus(censusPath);
  const debt = soleLanderDebtForSlice(doc, slice);
  if (debt.length > 0) {
    const ids = debt.map((r) => `${r.commId}:${r.manifoldClass}`).join(", ");
    throw new Error(
      `Fabric-depth census gate: ${slice} sole-lander debt blocks depth GREEN ([${ids}])`,
    );
  }
};

/**
 * Predicate: slice may enter Ordered depth exit / retire under census law.
 */
export const censusAllowsDepthExit = (censusPath: string, slice: G10FabricSliceId): boolean => {
  try {
    assertSoleLandersRealForSlice(censusPath, slice);
    return true;
  } catch {
    return false;
  }
};

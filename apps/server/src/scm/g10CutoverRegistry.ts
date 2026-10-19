// @effect-diagnostics nodeBuiltinImport:off
/**
 * G10 cutover radius registry (S0 foundation).
 *
 * Intended: load activatable `comm_id`s by slice from
 * `docs/scm/g10/seam-inventory-completeness.json` at test/runtime via repo-root
 * helper. Campaign radius is inventory-authoritative — helpers refuse shrink
 * and expand APIs. Dormant `INV-T2-SCM-HOME-BUS-LINK` is exempt (not activatable).
 *
 * Observed: parses per_slice_comm_ids + phase cutover_activation. S0/S8 have
 * empty activatable sets (contracts / campaign close, not fabric rows).
 * Does not wire fabric seams. Does not activate home-bus-link.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { G10FabricSliceId, G10SliceId } from "./g10Types.ts";

/** Dormant-preserved row — exempt from cutover / exit / inversion. */
export const G10_DORMANT_HOME_BUS_COMM_ID = "INV-T2-SCM-HOME-BUS-LINK" as const;

/** Relative path from monorepo root (inventory-authoritative radius). */
export const G10_SEAM_INVENTORY_RELATIVE_PATH =
  "docs/scm/g10/seam-inventory-completeness.json" as const;

/** Fabric slices that own inventory `comm_id` rows. */
export const G10_FABRIC_SLICE_IDS: readonly G10FabricSliceId[] = [
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
] as const;

/**
 * Resolve T2-SQUARED repo root from this module's location.
 *
 * Intended: apps/server/src/scm → four parents → monorepo root.
 * Observed: same depth as resolveG9RepoRoot().
 */
export const resolveG10RepoRoot = (): string =>
  join(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** Raw inventory JSON shape (fields we consume). */
type SeamInventoryJson = {
  readonly completeness?: {
    readonly per_slice_comm_ids?: Partial<Record<string, readonly string[]>>;
    readonly comm_id_count?: number;
  };
  readonly phases?: ReadonlyArray<{
    readonly comm_id: string;
    readonly cutover_activation?: string;
  }>;
};

/**
 * Loaded cutover registry: activatable ids by fabric slice + dormant exempt set.
 *
 * Agent: radiusSet is the frozen activatable union; do not mutate membership
 * via shrink/expand helpers (they throw).
 */
export type G10CutoverRegistry = {
  readonly repoRoot: string;
  /** Activatable `comm_id`s per fabric slice (home-bus excluded). */
  readonly bySlice: Readonly<Record<G10FabricSliceId, readonly string[]>>;
  /** Frozen campaign radius (sorted unique activatable ids). */
  readonly radiusSet: ReadonlySet<string>;
  /** Dormant-preserved ids (currently only home-bus-link). */
  readonly dormantExempt: ReadonlySet<string>;
  /** Inventory total `comm_id` count (74). */
  readonly inventoryCommIdCount: number;
};

/**
 * Load and validate the cutover registry from seam-inventory-completeness.json.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     Monorepo root (defaults to resolveG10RepoRoot()).
 *
 * Returns
 * -------
 * G10CutoverRegistry
 *     Activatable-by-slice + radius + dormant exempt.
 *
 * Throws
 * ------
 * Error
 *     Missing inventory, empty fabric slices, or radius/count mismatch.
 */
export const loadG10CutoverRegistry = (
  repoRoot: string = resolveG10RepoRoot(),
): G10CutoverRegistry => {
  const path = join(repoRoot, G10_SEAM_INVENTORY_RELATIVE_PATH);
  const raw = JSON.parse(readFileSync(path, "utf8")) as SeamInventoryJson;
  const perSlice = raw.completeness?.per_slice_comm_ids ?? {};
  const phases = raw.phases ?? [];

  // Collect dormant-preserved comm_ids from phase activation marks.
  const dormantExempt = new Set<string>();
  for (const phase of phases) {
    if (phase.cutover_activation === "dormant-preserved") {
      dormantExempt.add(phase.comm_id);
    }
  }
  // Hard-lock known dormant id even if a future inventory omits the mark.
  dormantExempt.add(G10_DORMANT_HOME_BUS_COMM_ID);

  const bySlice = {} as Record<G10FabricSliceId, readonly string[]>;
  const radius = new Set<string>();

  for (const slice of G10_FABRIC_SLICE_IDS) {
    const listed = perSlice[slice] ?? [];
    const activatable = listed.filter((id) => !dormantExempt.has(id));
    bySlice[slice] = Object.freeze([...activatable]);
    for (const id of activatable) radius.add(id);
  }

  const inventoryCommIdCount = raw.completeness?.comm_id_count ?? 0;
  // Sanity: inventory total = radius + dormant (when inventory lists all ids).
  const dormantInInventory = [...dormantExempt].filter((id) =>
    G10_FABRIC_SLICE_IDS.some((s) => (perSlice[s] ?? []).includes(id)),
  ).length;
  if (inventoryCommIdCount > 0 && radius.size + dormantInInventory !== inventoryCommIdCount) {
    throw new Error(
      `G10 registry radius mismatch: activatable=${radius.size} dormantInInventory=${dormantInInventory} inventoryCommIdCount=${inventoryCommIdCount}`,
    );
  }

  return {
    repoRoot,
    bySlice: Object.freeze(bySlice),
    radiusSet: radius,
    dormantExempt,
    inventoryCommIdCount,
  };
};

/**
 * Activatable `comm_id`s for a fabric slice (empty for S0/S8).
 */
export const activatableCommIdsForSlice = (
  registry: G10CutoverRegistry,
  slice: G10SliceId,
): readonly string[] => {
  if (slice === "S0" || slice === "S8") return [];
  return registry.bySlice[slice];
};

/**
 * True when `comm_id` is dormant-preserved (exempt from cutover/exit/inversion).
 */
export const isDormantExempt = (registry: G10CutoverRegistry, commId: string): boolean =>
  registry.dormantExempt.has(commId);

/**
 * Refuse radius shrink. Campaign radius is inventory-authoritative (runbook §1).
 *
 * Parameters
 * ----------
 * registry : G10CutoverRegistry
 *     Loaded registry.
 * proposedDrop : readonly string[]
 *     `comm_id`s the caller wants to remove from the radius.
 *
 * Throws
 * ------
 * Error
 *     Always when proposedDrop is non-empty (shrink refused).
 */
export const refuseRadiusShrink = (
  registry: G10CutoverRegistry,
  proposedDrop: readonly string[],
): void => {
  if (proposedDrop.length === 0) return;
  const inRadius = proposedDrop.filter((id) => registry.radiusSet.has(id));
  throw new Error(
    `G10 radius shrink refused (inventory-authoritative; cannot drop ${inRadius.length || proposedDrop.length} id(s): ${proposedDrop.slice(0, 3).join(", ")}${proposedDrop.length > 3 ? "…" : ""})`,
  );
};

/**
 * Refuse radius expand. No codec / eleventh bus / home-bus activation via this API.
 *
 * Parameters
 * ----------
 * registry : G10CutoverRegistry
 *     Loaded registry.
 * proposedAdd : readonly string[]
 *     `comm_id`s the caller wants to add outside inventory radius.
 *
 * Throws
 * ------
 * Error
 *     Always when proposedAdd is non-empty (expand refused).
 */
export const refuseRadiusExpand = (
  registry: G10CutoverRegistry,
  proposedAdd: readonly string[],
): void => {
  if (proposedAdd.length === 0) return;
  const novel = proposedAdd.filter((id) => !registry.radiusSet.has(id));
  throw new Error(
    `G10 radius expand refused (inventory-authoritative; cannot add ${novel.length || proposedAdd.length} id(s): ${proposedAdd.slice(0, 3).join(", ")}${proposedAdd.length > 3 ? "…" : ""}; radius size=${registry.radiusSet.size})`,
  );
};

/**
 * Assert a candidate set equals the frozen radius (no reorder-as-resize).
 *
 * Throws when sizes or membership differ.
 */
export const assertRadiusUnchanged = (
  registry: G10CutoverRegistry,
  candidate: ReadonlySet<string> | readonly string[],
): void => {
  const cand = candidate instanceof Set ? candidate : new Set(candidate);
  if (cand.size !== registry.radiusSet.size) {
    throw new Error(
      `G10 radius resize detected: candidate=${cand.size} frozen=${registry.radiusSet.size}`,
    );
  }
  for (const id of cand) {
    if (!registry.radiusSet.has(id)) {
      throw new Error(`G10 radius membership drift: unexpected ${id}`);
    }
  }
};

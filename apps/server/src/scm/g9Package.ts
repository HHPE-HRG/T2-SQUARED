// @effect-diagnostics nodeBuiltinImport:off
/**
 * G9 package loader (WP1 / Task 1).
 *
 * Intended: init-time load + validate of runtime-parameters, G3 bus/node/bindings,
 * G1B inventory, coverage-ledger rows, and governed-classes into one G9Package.
 * Throws plain Error (code in message), never G9InvariantFault — package load is
 * init-time, not a live capture fault.
 *
 * Observed: see loadG9Package / parseRuntimeParameters. Governed maps are runtime
 * only (10 buses, 29 placed nodes); authority parent is authority_bus_id string.
 * Empty initial DIP is documented here; DipMuteStore construction is later tasks.
 * Task 14: findRowPhase / listPackagePhasePairs / ledgerPhasePairKey project
 * fixture_driver_class for coordinator capture validation (RFC-019).
 *
 * Sole numeric source after validation is docs/scm/g9/runtime-parameters.json.
 * Do not invent 64/100/1 TypeScript literals for FIFO/wake/N.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type AuthorityClass, type GovernedClasses } from "./g6DipMute.ts";

const RESERVED_NODE_ID = "node.observer.404";
const AUTHORITY_BUS_ID = "bus.scm.authority";
const AUTHORITY_NODE_ID = "node.scm.authority";
const AUTHORITY_CLASSES = new Set<string>(["A0", "A1", "A2", "observer"]);

/**
 * Validated runtime integers from docs/scm/g9/runtime-parameters.json.
 * schemaVersion must be 1; the three counts are finite positive integers.
 */
export interface G9RuntimeParameters {
  readonly schemaVersion: number;
  readonly fifo_max_occurrences_per_node: number;
  readonly process_interval_wake_ms: number;
  readonly live_process_interval_fundamental_timesteps: number;
}

/** Ledger equality mapping projected into package rows. */
export interface G9EqualityMapping {
  readonly equality_bearing_side: "request" | "state";
  readonly A_field: string;
  readonly finite_domain: "request_label" | "state_label";
  readonly rule: string;
}

/** One phase declaration projected from coverage-ledger.json. */
export interface G9PhaseDeclaration {
  readonly phase_id: string;
  readonly family: string;
  readonly capture_strategy: string;
  readonly semanticKind: "request" | "state";
  readonly equality_projection_A: ReadonlyArray<string>;
  readonly liveToEquality: G9EqualityMapping;
  readonly shadowToEquality: G9EqualityMapping;
  readonly request_label: ReadonlyArray<string>;
  readonly state_label: ReadonlyArray<string>;
  readonly retainCurrentAfterPublish: boolean;
  readonly sensitive_data_exclusions: ReadonlyArray<string>;
  readonly aggregate_member_or_capture_site_id: string;
  readonly fixture_driver_class?: "declaration-absence" | "dormant-prototype";
}

/** One coverage-ledger row projected for coordinator / capture lookup. */
export interface G9RowDeclaration {
  readonly comm_id: string;
  readonly node_id: string;
  readonly origin_bus_id: string;
  readonly home_bus_id: string;
  readonly placementStatus: string;
  readonly origin_relationship: string;
  readonly intended_bus_relationship: string;
  readonly phases: ReadonlyArray<G9PhaseDeclaration>;
}

/**
 * Init-time G9 package used by every later G9 module.
 *
 * runtimeBusIds / placedNodeIds / nodeHomeBus are G3-derived runtime sets.
 * rowsByCommId holds all 74 ledger row projections.
 * governed is G6 GovernedClasses built from G9 runtime maps only (no DIP rows).
 */
export interface G9Package {
  readonly parameters: G9RuntimeParameters;
  readonly runtimeBusIds: ReadonlySet<string>;
  readonly placedNodeIds: ReadonlySet<string>;
  readonly nodeHomeBus: ReadonlyMap<string, string>;
  readonly rowsByCommId: ReadonlyMap<string, G9RowDeclaration>;
  readonly g1bInventorySha256: string;
  readonly g3TopologySha256: string;
  readonly governed: GovernedClasses;
}

interface G3BusRoster {
  readonly buses: ReadonlyArray<{ readonly bus_id: string }>;
  readonly nodeBusBindings: ReadonlyArray<{
    readonly node_id: string;
    readonly bus_id: string;
    readonly relationship: string;
  }>;
}

interface G3NodeRoster {
  readonly nodes: ReadonlyArray<{
    readonly node_id: string;
    readonly baseline_authority: string;
    readonly placementStatus: string;
  }>;
}

interface G3Topology {
  readonly mappings: ReadonlyArray<{
    readonly comm_id: string;
    readonly node_id: string;
    readonly home_bus_id: string | null;
    readonly origin_bus_id: string | null;
    readonly placementStatus: string;
  }>;
}

interface G1bInventory {
  readonly rows: ReadonlyArray<{ readonly comm_id: string }>;
}

interface GovernedClassEntry {
  readonly class: string;
  readonly runtime?: boolean;
  readonly placementStatus?: string;
}

interface GovernedClassesFile {
  readonly buses: Record<string, GovernedClassEntry>;
  readonly nodes: Record<string, GovernedClassEntry>;
  readonly reserved_nodes?: Record<string, GovernedClassEntry>;
  readonly authority_parent: { readonly bus_id: string; readonly node_id: string };
}

interface LedgerPhaseRaw {
  readonly phase_id: string;
  readonly family: string;
  readonly capture_strategy: string;
  readonly semanticKind: string;
  readonly equality_projection_A: ReadonlyArray<string>;
  readonly liveToEquality: G9EqualityMapping;
  readonly shadowToEquality: G9EqualityMapping;
  readonly request_label: ReadonlyArray<string>;
  readonly state_label: ReadonlyArray<string>;
  readonly retainCurrentAfterPublish: boolean;
  readonly sensitive_data_exclusions: ReadonlyArray<string>;
  readonly aggregate_member_or_capture_site_id: string;
  readonly fixture_driver_class?: string;
}

interface LedgerRowRaw {
  readonly comm_id: string;
  readonly node_id: string;
  readonly origin_bus_id: string;
  readonly home_bus_id: string;
  readonly placementStatus: string;
  readonly origin_relationship: string;
  readonly intended_bus_relationship: string;
  readonly phases: ReadonlyArray<LedgerPhaseRaw>;
}

interface CoverageLedger {
  readonly g1b_inventory_sha256: string;
  readonly g3_topology_sha256: string;
  readonly rows: ReadonlyArray<LedgerRowRaw>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAuthorityClass = (value: string): value is AuthorityClass => AUTHORITY_CLASSES.has(value);

/**
 * SHA-256 hex of raw file bytes (same pattern as g3Topology.ts / regen).
 *
 * Parameters
 * ----------
 * path : string
 *     Absolute path to hash.
 *
 * Returns
 * -------
 * string
 *     Lowercase hex digest.
 */
const sha256File = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

/**
 * True when two string sets contain the same members (order ignored).
 *
 * Parameters
 * ----------
 * a, b : ReadonlySet<string>
 *     Sets to compare.
 *
 * Returns
 * -------
 * boolean
 *     True on set equality.
 */
const setEqual = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
};

/**
 * Fail package load with a stable code token in the message.
 *
 * Parameters
 * ----------
 * code : string
 *     Short error code (appears in Error.message).
 * detail : string
 *     Human-readable detail for agents debugging init failures.
 *
 * Returns
 * -------
 * never
 *     Always throws Error (not G9InvariantFault).
 */
const fail = (code: string, detail: string): never => {
  throw new Error(`${code}: ${detail}`);
};

/**
 * Parse and validate docs/scm/g9/runtime-parameters.json shape.
 *
 * Intended: accept schemaVersion === 1 and three finite positive integers only.
 * Does not compare values to TypeScript literals (JSON is the sole source).
 *
 * Parameters
 * ----------
 * value : unknown
 *     Parsed JSON or test literal.
 *
 * Returns
 * -------
 * G9RuntimeParameters
 *     Validated parameters.
 *
 * Throws
 * ------
 * Error
 *     Message includes g9-runtime-parameters:<field> code.
 */
export const parseRuntimeParameters = (value: unknown): G9RuntimeParameters => {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error("g9-runtime-parameters: schemaVersion");
  }
  const n = (k: string): number => {
    const v = value[k];
    if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v) || v <= 0) {
      throw new Error(`g9-runtime-parameters: ${k}`);
    }
    return v;
  };
  return {
    schemaVersion: value.schemaVersion,
    fifo_max_occurrences_per_node: n("fifo_max_occurrences_per_node"),
    process_interval_wake_ms: n("process_interval_wake_ms"),
    live_process_interval_fundamental_timesteps: n("live_process_interval_fundamental_timesteps"),
  };
};

/**
 * Project one ledger phase into G9PhaseDeclaration.
 *
 * Parameters
 * ----------
 * phase : LedgerPhaseRaw
 *     Raw ledger phase object.
 * commId : string
 *     Owning row id (for error context).
 *
 * Returns
 * -------
 * G9PhaseDeclaration
 *     Typed phase for package lookup.
 */
const projectPhase = (phase: LedgerPhaseRaw, commId: string): G9PhaseDeclaration => {
  const semanticKind =
    phase.semanticKind === "request" || phase.semanticKind === "state"
      ? phase.semanticKind
      : fail("g9-package: phase-semanticKind", `${commId}/${phase.phase_id}`);
  const live = phase.liveToEquality;
  const shadow = phase.shadowToEquality;
  if (
    !isRecord(live) ||
    (live.equality_bearing_side !== "request" && live.equality_bearing_side !== "state") ||
    typeof live.A_field !== "string" ||
    (live.finite_domain !== "request_label" && live.finite_domain !== "state_label") ||
    typeof live.rule !== "string"
  ) {
    fail("g9-package: phase-liveToEquality", `${commId}/${phase.phase_id}`);
  }
  if (
    !isRecord(shadow) ||
    (shadow.equality_bearing_side !== "request" && shadow.equality_bearing_side !== "state") ||
    typeof shadow.A_field !== "string" ||
    (shadow.finite_domain !== "request_label" && shadow.finite_domain !== "state_label") ||
    typeof shadow.rule !== "string"
  ) {
    fail("g9-package: phase-shadowToEquality", `${commId}/${phase.phase_id}`);
  }
  const out: G9PhaseDeclaration = {
    phase_id: phase.phase_id,
    family: phase.family,
    capture_strategy: phase.capture_strategy,
    semanticKind,
    equality_projection_A: [...phase.equality_projection_A],
    liveToEquality: {
      equality_bearing_side: live.equality_bearing_side,
      A_field: live.A_field,
      finite_domain: live.finite_domain,
      rule: live.rule,
    },
    shadowToEquality: {
      equality_bearing_side: shadow.equality_bearing_side,
      A_field: shadow.A_field,
      finite_domain: shadow.finite_domain,
      rule: shadow.rule,
    },
    request_label: [...phase.request_label],
    state_label: [...phase.state_label],
    retainCurrentAfterPublish: phase.retainCurrentAfterPublish === true,
    sensitive_data_exclusions: [...phase.sensitive_data_exclusions],
    aggregate_member_or_capture_site_id: phase.aggregate_member_or_capture_site_id,
  };
  if (
    phase.fixture_driver_class === "declaration-absence" ||
    phase.fixture_driver_class === "dormant-prototype"
  ) {
    return { ...out, fixture_driver_class: phase.fixture_driver_class };
  }
  return out;
};

/**
 * Project one ledger row into G9RowDeclaration.
 *
 * Parameters
 * ----------
 * row : LedgerRowRaw
 *     Raw coverage-ledger row.
 *
 * Returns
 * -------
 * G9RowDeclaration
 *     Typed row for rowsByCommId.
 */
const projectRow = (row: LedgerRowRaw): G9RowDeclaration => ({
  comm_id: row.comm_id,
  node_id: row.node_id,
  origin_bus_id: row.origin_bus_id,
  home_bus_id: row.home_bus_id,
  placementStatus: row.placementStatus,
  origin_relationship: row.origin_relationship,
  intended_bus_relationship: row.intended_bus_relationship,
  phases: row.phases.map((phase) => projectPhase(phase, row.comm_id)),
});

/**
 * Build GovernedClasses from G9 governed-classes.json runtime maps only.
 *
 * Intended: ten bus keys + 29 placed node keys; authority_bus_id string only.
 * Observed: reserved 404 stays out of nodes map; parent not a map entry.
 *
 * Parameters
 * ----------
 * raw : GovernedClassesFile
 *     Parsed docs/scm/g9/governed-classes.json.
 *
 * Returns
 * -------
 * GovernedClasses
 *     Runtime-only maps for later DipMuteStore (empty DIP at construct).
 */
const governedFromG9File = (raw: GovernedClassesFile): GovernedClasses => {
  const buses = new Map<string, AuthorityClass>();
  for (const [busId, entry] of Object.entries(raw.buses)) {
    if (entry.runtime !== true) {
      fail("g9-package: governed-bus-runtime", busId);
    }
    buses.set(
      busId,
      isAuthorityClass(entry.class) ? entry.class : fail("g9-package: governed-bus-class", busId),
    );
  }
  const nodes = new Map<string, AuthorityClass>();
  for (const [nodeId, entry] of Object.entries(raw.nodes)) {
    if (entry.placementStatus !== "placed") {
      fail("g9-package: governed-node-placement", nodeId);
    }
    nodes.set(
      nodeId,
      isAuthorityClass(entry.class) ? entry.class : fail("g9-package: governed-node-class", nodeId),
    );
  }
  if (raw.authority_parent.bus_id !== AUTHORITY_BUS_ID) {
    fail("g9-package: authority-parent", raw.authority_parent.bus_id);
  }
  if (buses.has(AUTHORITY_BUS_ID) || nodes.has(AUTHORITY_NODE_ID)) {
    fail("g9-package: authority-runtime", "authority id present in runtime maps");
  }
  // reserved_nodes may list 404; it must never land in the runtime nodes map.
  if (nodes.has(RESERVED_NODE_ID)) {
    fail("g9-package: reserved-404", "node.observer.404 in governed.nodes");
  }
  return {
    buses,
    nodes,
    authority_bus_id: AUTHORITY_BUS_ID,
  };
};

/**
 * Load and validate the full G9 package from repo docs/scm artifacts.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     Absolute T2-SQUARED repository root.
 *
 * Returns
 * -------
 * G9Package
 *     Validated parameters, sets, maps, SHA pins, governed classes, rows.
 *
 * Throws
 * ------
 * Error
 *     Init mismatch (set size, SHA pin, authority/404, row→G3 bind).
 *
 * Example
 * -------
 * const pkg = loadG9Package(repoRoot);
 * // later: new DipMuteStore(pkg.governed) starts with empty DIP rows
 */
export const loadG9Package = (repoRoot: string): G9Package => {
  const parameters = parseRuntimeParameters(
    JSON.parse(readFileSync(join(repoRoot, "docs/scm/g9/runtime-parameters.json"), "utf8")),
  );

  const busRoster = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g3/bus-roster.json"), "utf8"),
  ) as G3BusRoster;
  const nodeRoster = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g3/node-roster.json"), "utf8"),
  ) as G3NodeRoster;
  const topology = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g3/inventory-topology.json"), "utf8"),
  ) as G3Topology;
  const inventory = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g1b/inventory.json"), "utf8"),
  ) as G1bInventory;
  const ledger = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g9/coverage-ledger.json"), "utf8"),
  ) as CoverageLedger;
  const governedRaw = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g9/governed-classes.json"), "utf8"),
  ) as GovernedClassesFile;

  const g1bInventoryPath = join(repoRoot, "docs/scm/g1b/inventory.json");
  const g3TopologyPath = join(repoRoot, "docs/scm/g3/inventory-topology.json");
  const g1bInventorySha256 = sha256File(g1bInventoryPath);
  const g3TopologySha256 = sha256File(g3TopologyPath);

  if (ledger.g1b_inventory_sha256 !== g1bInventorySha256) {
    fail("g9-package: g1b-inventory-sha256", "ledger header does not match file hash");
  }
  if (ledger.g3_topology_sha256 !== g3TopologySha256) {
    fail("g9-package: g3-topology-sha256", "ledger header does not match file hash");
  }

  const governed = governedFromG9File(governedRaw);

  const g3BusIds = new Set(busRoster.buses.map((bus) => bus.bus_id));
  const governedBusIds = new Set(governed.buses.keys());
  if (g3BusIds.size !== 10 || governedBusIds.size !== 10) {
    fail(
      "g9-package: runtime-bus-count",
      `expected 10, got g3=${g3BusIds.size} governed=${governedBusIds.size}`,
    );
  }
  if (!setEqual(g3BusIds, governedBusIds)) {
    fail("g9-package: runtime-bus-set", "G3 buses[] and governed buses keys differ");
  }
  if (g3BusIds.has(AUTHORITY_BUS_ID) || governedBusIds.has(AUTHORITY_BUS_ID)) {
    fail("g9-package: authority-runtime", "bus.scm.authority in runtime bus set");
  }

  const placedNodes = nodeRoster.nodes.filter((node) => node.placementStatus === "placed");
  if (placedNodes.length !== 29) {
    fail("g9-package: placed-node-count", `expected 29, got ${placedNodes.length}`);
  }
  const placedNodeIds = new Set(placedNodes.map((node) => node.node_id));
  if (placedNodeIds.has(RESERVED_NODE_ID)) {
    fail("g9-package: reserved-404", "node.observer.404 in placedNodeIds");
  }
  if (placedNodeIds.has(AUTHORITY_NODE_ID)) {
    fail("g9-package: authority-runtime", "node.scm.authority in placedNodeIds");
  }
  if (!setEqual(placedNodeIds, new Set(governed.nodes.keys()))) {
    fail("g9-package: placed-node-set", "G3 placed nodes and governed nodes keys differ");
  }

  // Class equality: G3 baseline_authority / G9 class as sets of (id, class) pairs.
  const g3ClassPairs = new Set(
    placedNodes.map((node) => `${node.node_id}\0${node.baseline_authority}`),
  );
  const g9ClassPairs = new Set(
    [...governed.nodes.entries()].map(([nodeId, cls]) => `${nodeId}\0${cls}`),
  );
  if (!setEqual(g3ClassPairs, g9ClassPairs)) {
    fail("g9-package: placed-node-class", "G3 baseline_authority / G9 class pairs differ");
  }

  const nodeHomeBus = new Map<string, string>();
  const bindingPairs = new Set<string>();
  for (const binding of busRoster.nodeBusBindings) {
    bindingPairs.add(`${binding.node_id}\0${binding.bus_id}`);
    if (binding.relationship === "home") {
      if (nodeHomeBus.has(binding.node_id)) {
        fail("g9-package: home-bus", `duplicate home for ${binding.node_id}`);
      }
      nodeHomeBus.set(binding.node_id, binding.bus_id);
    }
  }
  for (const nodeId of placedNodeIds) {
    if (!nodeHomeBus.has(nodeId)) {
      fail("g9-package: home-bus", `missing home binding for ${nodeId}`);
    }
  }

  const g1bCommIds = new Set(inventory.rows.map((row) => row.comm_id));
  const g3CommIds = new Set(topology.mappings.map((row) => row.comm_id));
  const g9CommIds = new Set(ledger.rows.map((row) => row.comm_id));
  if (g1bCommIds.size !== 74 || g3CommIds.size !== 74 || g9CommIds.size !== 74) {
    fail(
      "g9-package: comm-id-set",
      `expected size 74, got g1b=${g1bCommIds.size} g3=${g3CommIds.size} g9=${g9CommIds.size}`,
    );
  }
  if (!setEqual(g1bCommIds, g3CommIds) || !setEqual(g3CommIds, g9CommIds)) {
    fail("g9-package: comm-id-set", "G1B / G3 / G9 comm_id sets are not equal");
  }

  const g3ByCommId = new Map(topology.mappings.map((row) => [row.comm_id, row] as const));
  const rowsByCommId = new Map<string, G9RowDeclaration>();
  for (const raw of ledger.rows) {
    const g3 =
      g3ByCommId.get(raw.comm_id) ??
      fail("g9-package: row-g3-mapping", `missing G3 mapping for ${raw.comm_id}`);
    if (raw.node_id !== g3.node_id || raw.origin_bus_id !== g3.origin_bus_id) {
      fail("g9-package: row-g3-mapping", `${raw.comm_id} node/origin differ from G3 mapping`);
    }
    if (!bindingPairs.has(`${raw.node_id}\0${raw.origin_bus_id}`)) {
      fail(
        "g9-package: node-bus-binding",
        `${raw.comm_id} (${raw.node_id},${raw.origin_bus_id}) not in nodeBusBindings`,
      );
    }
    if (rowsByCommId.has(raw.comm_id)) {
      fail("g9-package: duplicate-comm-id", raw.comm_id);
    }
    rowsByCommId.set(raw.comm_id, projectRow(raw));
  }

  return {
    parameters,
    runtimeBusIds: governedBusIds,
    placedNodeIds,
    nodeHomeBus,
    rowsByCommId,
    g1bInventorySha256,
    g3TopologySha256,
    governed,
  };
};

/**
 * Look up one ledger phase by (comm_id, phase_id) on a loaded package.
 *
 * Agent: Task 14 / WP1 helper for coordinator capture validation and
 * fixture_driver_class projection. Init-time package already projected
 * fixture_driver_class onto G9PhaseDeclaration.
 *
 * Parameters
 * ----------
 * pkg : G9Package
 *     Loaded package (rowsByCommId).
 * commId : string
 *     Inventory / ledger row id.
 * phaseId : string
 *     Phase id within that row.
 *
 * Returns
 * -------
 * { row, phase } | undefined
 *     Both declarations when present; undefined when row or phase missing.
 */
export const findRowPhase = (
  pkg: G9Package,
  commId: string,
  phaseId: string,
): { readonly row: G9RowDeclaration; readonly phase: G9PhaseDeclaration } | undefined => {
  const row = pkg.rowsByCommId.get(commId);
  if (row === undefined) return undefined;
  const phase = row.phases.find((candidate) => candidate.phase_id === phaseId);
  if (phase === undefined) return undefined;
  return { row, phase };
};

/**
 * Stable string key for a ledger (comm_id, phase_id) pair.
 *
 * Parameters
 * ----------
 * commId : string
 * phaseId : string
 *
 * Returns
 * -------
 * string
 *     Null-separated key for set comparisons (tests / WP8).
 */
export const ledgerPhasePairKey = (commId: string, phaseId: string): string =>
  `${commId}\0${phaseId}`;

/**
 * Flatten all package phases into (comm_id, phase_id) pairs in row order.
 *
 * Parameters
 * ----------
 * pkg : G9Package
 *     Loaded package.
 *
 * Returns
 * -------
 * ReadonlyArray<{ comm_id, phase_id }>
 *     Exactly the ledger phase set after a valid load (184 when counts hold).
 */
export const listPackagePhasePairs = (
  pkg: G9Package,
): ReadonlyArray<{ readonly comm_id: string; readonly phase_id: string }> => {
  const pairs: { readonly comm_id: string; readonly phase_id: string }[] = [];
  for (const row of pkg.rowsByCommId.values()) {
    for (const phase of row.phases) {
      pairs.push({ comm_id: row.comm_id, phase_id: phase.phase_id });
    }
  }
  return pairs;
};

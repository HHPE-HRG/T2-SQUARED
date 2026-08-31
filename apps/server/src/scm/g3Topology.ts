/**
 * G3 topology overlay checker.
 *
 * Validates exact G1 comm_id coverage, one home bus per placed node,
 * origin-bus identity, halt bans, and later-gate non-authorization.
 * Does not implement runtime buses.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MANIFEST_STATUSES = new Set([
  "planned-not-authorized",
  "authorized",
  "in-progress",
  "completed",
]);
const HALT = new Set(["yes", "no", "open"]);
const RELATIONSHIPS = new Set(["home", "authority", "linked", "permissioned-child", "unknown"]);
const PLACEMENT = new Set(["placed", "unplaced", "reserved"]);
const NODE_PLACEMENT = new Set(["placed", "reserved"]);
const RESERVED_NODE_ID = "node.observer.404";
const OBSERVER_NODES = new Set([
  "node.t2-observer",
  "node.t3-observer",
  "node.analytics",
  "node.resource-telemetry",
  "node.observer.404",
]);
const G3_REVIEW_IDENTITY = "codex-independent-review";

export interface G3Review {
  status: string;
  identity: string;
  independentOfImplementationAuthor: boolean;
  reviewedArtifactHash: string;
  note?: string;
}

export interface G3G1Inputs {
  inventoryPath: string;
  inventorySha256: string;
  g1bManifestPath: string;
  g1bManifestSha256: string;
  g1aDir: string;
  g1aFilesSha256: string;
}

export interface G3Manifest {
  gate: string;
  status: string;
  authorized: boolean;
  completed: boolean;
  doesNotAuthorizeLaterGates: boolean;
  g4toG7Authorized: boolean;
  review?: G3Review;
  g1Inputs?: G3G1Inputs;
}

export interface G3Node {
  node_id: string;
  halt_initiator: string;
  baseline_authority: string;
  placementStatus: string;
  live_g1_comm_ids?: string[];
}

export interface G3Bus {
  bus_id: string;
  steward: string;
  permanent: boolean;
  permanenceApproval?: string;
}

export interface G3Gap {
  gapId: string;
  steward: string;
  reason: string;
  resolutionEvidence: string;
}

export interface G3Binding {
  node_id: string;
  bus_id: string;
  relationship: string;
  gap?: G3Gap;
}

export interface G3Mapping {
  comm_id: string;
  node_id: string;
  home_bus_id: string | null;
  origin_bus_id: string | null;
  relationship?: string;
  origin_relationship?: string;
  intended_bus_relationship?: string;
  placementStatus: string;
  row_authority_class?: string;
  endpoint?: string;
  placement?: G3Gap;
  relationshipGap?: G3Gap;
}

export interface G3Package {
  repoRoot: string;
  manifest: G3Manifest;
  nodes: G3Node[];
  buses: G3Bus[];
  bindings: G3Binding[];
  topology: { mappings: G3Mapping[] };
  g1CommIds: string[];
  g1Rows: Array<{ comm_id: string; authority_class: string }>;
  g1ActualInputs?: G3G1Inputs;
}

export interface G3Failure {
  readonly code: string;
  readonly message: string;
}

export type G3CheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failures: ReadonlyArray<G3Failure> };

const isNonEmpty = (value: string | undefined | null): boolean =>
  typeof value === "string" && value.trim().length > 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isNodeMember = (value: unknown): value is G3Node =>
  isRecord(value) &&
  typeof value.node_id === "string" &&
  typeof value.halt_initiator === "string" &&
  typeof value.baseline_authority === "string" &&
  typeof value.placementStatus === "string" &&
  (value.live_g1_comm_ids === undefined || isStringArray(value.live_g1_comm_ids));

const isBusMember = (value: unknown): value is G3Bus =>
  isRecord(value) &&
  typeof value.bus_id === "string" &&
  typeof value.steward === "string" &&
  typeof value.permanent === "boolean";

const isBindingMember = (value: unknown): value is G3Binding =>
  isRecord(value) &&
  typeof value.node_id === "string" &&
  typeof value.bus_id === "string" &&
  typeof value.relationship === "string";

const isMappingMember = (value: unknown): value is G3Mapping =>
  isRecord(value) &&
  typeof value.comm_id === "string" &&
  typeof value.node_id === "string" &&
  typeof value.placementStatus === "string" &&
  isNullableString(value.home_bus_id) &&
  isNullableString(value.origin_bus_id);

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const manifestForHash = (manifest: G3Manifest): unknown => {
  const cloned = structuredClone(manifest);
  if (cloned.review !== undefined) {
    const review = { ...cloned.review };
    delete (review as { reviewedArtifactHash?: string }).reviewedArtifactHash;
    cloned.review = review;
  }
  return cloned;
};

/**
 * Digest G3 artifacts a completion reviewer must approve.
 *
 * README is explanatory and is not included. `review.reviewedArtifactHash`
 * is omitted so the digest is not self-referential.
 *
 * Parameters
 * ----------
 * pkg : G3Package
 *     Loaded G3 package.
 *
 * Returns
 * -------
 * string
 *     SHA-256 hex of the canonical reviewed package.
 *
 * Example
 * -------
 * const digest = computeG3ReviewedArtifactHash(loadG3Package(repoRoot));
 */
export const computeG3ReviewedArtifactHash = (pkg: G3Package): string =>
  createHash("sha256")
    .update(
      [
        canonicalJson(manifestForHash(pkg.manifest)),
        canonicalJson(pkg.nodes),
        canonicalJson(pkg.buses),
        canonicalJson(pkg.bindings),
        canonicalJson(pkg.topology),
      ].join("\n"),
    )
    .digest("hex");

const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

const completeGap = (gap: unknown): boolean =>
  isRecord(gap) &&
  isNonEmpty(gap.gapId) &&
  isNonEmpty(gap.steward) &&
  isNonEmpty(gap.reason) &&
  isNonEmpty(gap.resolutionEvidence);

const legalManifestTuple = (manifest: G3Manifest): boolean => {
  if (!MANIFEST_STATUSES.has(manifest.status)) {
    return false;
  }
  if (manifest.status === "planned-not-authorized") {
    return manifest.authorized === false && manifest.completed === false;
  }
  if (manifest.status === "authorized" || manifest.status === "in-progress") {
    return manifest.authorized === true && manifest.completed === false;
  }
  return manifest.authorized === true && manifest.completed === true;
};

const requiredIntended = (authority: string, nodeId: string): string => {
  if (nodeId.startsWith("node.provider.") && nodeId !== "node.provider") {
    return "permissioned-child";
  }
  if (authority === "A1" || authority === "human") {
    return "authority";
  }
  if (authority === "observer") {
    return "linked";
  }
  return "home";
};

const checkReview = (pkg: G3Package, push: (code: string, message: string) => void): void => {
  const review = pkg.manifest.review;
  if (!isRecord(review)) {
    push("review", "G3 review must name independent Codex review with withheld or approved status");
    return;
  }
  if (pkg.manifest.completed) {
    const digest = computeG3ReviewedArtifactHash(pkg);
    if (
      review.status !== "approved" ||
      review.identity !== G3_REVIEW_IDENTITY ||
      review.independentOfImplementationAuthor !== true ||
      review.reviewedArtifactHash !== digest
    ) {
      push(
        "review",
        "completed G3 requires approved independent review bound to the reviewed-package digest",
      );
    }
  }
};

/**
 * Hash G1A files in sorted path order.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     T2-SQUARED repository root.
 *
 * Returns
 * -------
 * string
 *     SHA-256 hex of the canonical G1A file-list digest.
 *
 * Example
 * -------
 * const digest = computeG1aFilesSha256(repoRoot);
 */
export const computeG1aFilesSha256 = (repoRoot: string): string => {
  const dir = join(repoRoot, "docs/scm/g1a");
  const names = readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .sort();
  let acc = "";
  for (const name of names) {
    acc += `docs/scm/g1a/${name}\n${sha256(readFileSync(join(dir, name)))}\n`;
  }
  return sha256(acc);
};

/**
 * Load the G3 overlay and frozen G1 comm_id set.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     T2-SQUARED repository root.
 *
 * Returns
 * -------
 * G3Package
 *     Rosters, overlay, and G1 IDs.
 *
 * Example
 * -------
 * const pkg = loadG3Package(repoRoot);
 */
export const loadG3Package = (repoRoot: string): G3Package => {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g3/manifest.json"), "utf8"),
  ) as G3Manifest;
  const nodeRoster = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g3/node-roster.json"), "utf8"),
  ) as { nodes: G3Node[] };
  const busRoster = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g3/bus-roster.json"), "utf8"),
  ) as { buses: G3Bus[]; nodeBusBindings: G3Binding[] };
  const topology = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g3/inventory-topology.json"), "utf8"),
  ) as { mappings: G3Mapping[] };
  const inventory = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g1b/inventory.json"), "utf8"),
  ) as { rows: Array<{ comm_id: string; authority_class: string }> };
  const g1Rows = inventory.rows.map((row) => ({
    comm_id: row.comm_id,
    authority_class: row.authority_class,
  }));
  return {
    repoRoot,
    manifest,
    nodes: nodeRoster.nodes,
    buses: busRoster.buses,
    bindings: busRoster.nodeBusBindings,
    topology,
    g1CommIds: g1Rows.map((row) => row.comm_id),
    g1Rows,
    g1ActualInputs: {
      inventoryPath: "docs/scm/g1b/inventory.json",
      inventorySha256: sha256(readFileSync(join(repoRoot, "docs/scm/g1b/inventory.json"))),
      g1bManifestPath: "docs/scm/g1b/manifest.json",
      g1bManifestSha256: sha256(readFileSync(join(repoRoot, "docs/scm/g1b/manifest.json"))),
      g1aDir: "docs/scm/g1a",
      g1aFilesSha256: computeG1aFilesSha256(repoRoot),
    },
  };
};

/**
 * Check G3 overlay completeness against frozen G1 IDs.
 *
 * Parameters
 * ----------
 * pkg : G3Package
 *     Loaded overlay package.
 *
 * Returns
 * -------
 * G3CheckResult
 *     `ok: true` when coverage and topology invariants hold.
 *
 * Example
 * -------
 * const result = checkG3Topology(loadG3Package(repoRoot));
 */
export const checkG3Topology = (pkg: G3Package): G3CheckResult => {
  const failures: G3Failure[] = [];
  const push = (code: string, message: string) => {
    failures.push({ code, message });
  };

  if (!isRecord(pkg.manifest)) {
    return { ok: false, failures: [{ code: "shape", message: "G3 manifest is missing" }] };
  }
  if (pkg.manifest.gate !== "G3") {
    push("manifest-gate", `expected G3, got ${pkg.manifest.gate}`);
  }
  if (!legalManifestTuple(pkg.manifest)) {
    push("manifest-tuple", "illegal G3 manifest authorization tuple");
  }
  if (!pkg.manifest.doesNotAuthorizeLaterGates || pkg.manifest.g4toG7Authorized) {
    push("later-gates", "G3 must keep doesNotAuthorizeLaterGates true and g4toG7Authorized false");
    if (pkg.manifest.g4toG7Authorized) {
      push("g4-g7-authorized", "this package must not authorize G4-G7");
    }
  }
  checkReview(pkg, push);

  const expected = pkg.manifest.g1Inputs;
  const actual = pkg.g1ActualInputs;
  if (
    expected === undefined ||
    actual === undefined ||
    expected.inventorySha256 !== actual.inventorySha256 ||
    expected.g1bManifestSha256 !== actual.g1bManifestSha256 ||
    expected.g1aFilesSha256 !== actual.g1aFilesSha256
  ) {
    push("g1-input-drift", "G3 pinned G1 input hashes must match the frozen G1 files");
  }

  if (
    !Array.isArray(pkg.nodes) ||
    !Array.isArray(pkg.buses) ||
    !Array.isArray(pkg.bindings) ||
    !isRecord(pkg.topology) ||
    !Array.isArray(pkg.topology.mappings) ||
    !Array.isArray(pkg.g1Rows)
  ) {
    push("shape", "G3 overlay requires nodes, buses, bindings, mappings, and g1Rows arrays");
    return { ok: false, failures };
  }
  if (
    !pkg.nodes.every((row) => isNodeMember(row)) ||
    !pkg.buses.every((row) => isBusMember(row)) ||
    !pkg.bindings.every((row) => isBindingMember(row)) ||
    !pkg.topology.mappings.every((row) => isMappingMember(row)) ||
    !pkg.g1Rows.every(
      (row) =>
        isRecord(row) && typeof row.comm_id === "string" && typeof row.authority_class === "string",
    ) ||
    (pkg.g1CommIds !== undefined &&
      (!Array.isArray(pkg.g1CommIds) || pkg.g1CommIds.some((id) => typeof id !== "string")))
  ) {
    push("shape", "G3 collection members must be objects with required scalar fields");
    return { ok: false, failures };
  }

  const nodeById = new Map<string, G3Node>();
  for (const node of pkg.nodes) {
    if (nodeById.has(node.node_id)) {
      push("duplicate-node", `duplicate node ${node.node_id}`);
    }
    nodeById.set(node.node_id, node);
    if (node.node_id.toLowerCase().includes("manifold")) {
      push("manifold", `${node.node_id} must not be modeled as a runtime-owned manifold node`);
    }
    if (!HALT.has(node.halt_initiator) || node.halt_initiator === "yes") {
      push("halt-initiator", `${node.node_id} must not have halt_initiator yes`);
    }
    if (OBSERVER_NODES.has(node.node_id) && node.halt_initiator !== "no") {
      push("halt-initiator", `${node.node_id} observer/404 halt_initiator must be no`);
    }
    if (!NODE_PLACEMENT.has(node.placementStatus)) {
      push("placement", `${node.node_id} node placementStatus must be placed or reserved`);
    }
    if (node.placementStatus !== "reserved" && node.live_g1_comm_ids !== undefined) {
      push(
        "membership",
        `${node.node_id} placed node must not carry live_g1_comm_ids; membership is derived from topology`,
      );
    }
  }

  const reserved = nodeById.get(RESERVED_NODE_ID);
  if (reserved === undefined) {
    push("reserved-404", "node.observer.404 must exist as a reserved non-live identity");
  } else if (
    reserved.placementStatus !== "reserved" ||
    !Array.isArray(reserved.live_g1_comm_ids) ||
    reserved.live_g1_comm_ids.length !== 0
  ) {
    push("reserved-404", "404 must be reserved with no live G1 comm_ids");
  }

  const busById = new Map<string, G3Bus>();
  for (const bus of pkg.buses) {
    if (!isNonEmpty(bus.bus_id)) {
      push("empty-id", "bus_id must be non-empty");
    }
    if (isNonEmpty(bus.bus_id) && busById.has(bus.bus_id)) {
      push("duplicate-bus", `duplicate bus ${bus.bus_id}`);
    }
    busById.set(bus.bus_id, bus);
    if (!isNonEmpty(bus.steward)) {
      push("bus-steward", `${bus.bus_id} requires a steward`);
    }
    if (bus.permanent && !isNonEmpty(bus.permanenceApproval)) {
      push("permanence", `${bus.bus_id} permanent true requires permanenceApproval`);
    }
  }

  const homes = new Map<string, string[]>();
  const bindingKeys = new Set<string>();
  for (const binding of pkg.bindings) {
    if (!RELATIONSHIPS.has(binding.relationship)) {
      push("relationship", `${binding.node_id} has illegal relationship ${binding.relationship}`);
    }
    if (binding.relationship === "unknown" && !completeGap(binding.gap)) {
      push(
        "unknown-relationship",
        `${binding.node_id} unknown relationship requires gap and steward`,
      );
    }
    if (!nodeById.has(binding.node_id)) {
      push("unknown-node", `binding references missing node ${binding.node_id}`);
    }
    if (!busById.has(binding.bus_id)) {
      push("unknown-bus", `binding references missing bus ${binding.bus_id}`);
    }
    if (binding.relationship === "home") {
      const list = homes.get(binding.node_id) ?? [];
      list.push(binding.bus_id);
      homes.set(binding.node_id, list);
    }
    bindingKeys.add(`${binding.node_id}|${binding.relationship}`);
  }
  for (const node of pkg.nodes) {
    if (node.placementStatus === "reserved") {
      if (node.node_id !== RESERVED_NODE_ID) {
        push("reserved-404", `${node.node_id} is not a governed reserved identity`);
      }
      if ((homes.get(node.node_id) ?? []).length !== 0) {
        push("placement", `${node.node_id} reserved node must have zero home bindings`);
      }
      continue;
    }
    if (node.placementStatus === "placed") {
      const homeList = homes.get(node.node_id) ?? [];
      if (homeList.length !== 1) {
        push("home-bus", `${node.node_id} placed node must have exactly one home bus`);
      }
    }
  }

  const g1 = new Set(pkg.g1CommIds);
  const g1Authority = new Map(pkg.g1Rows.map((row) => [row.comm_id, row.authority_class]));
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const requiredBindings = new Map<string, string>();
  for (const mapping of pkg.topology.mappings) {
    if (seen.has(mapping.comm_id)) {
      duplicates.push(mapping.comm_id);
    }
    seen.add(mapping.comm_id);
    if (!isNonEmpty(mapping.comm_id) || !isNonEmpty(mapping.node_id)) {
      push("empty-id", `${mapping.comm_id} has empty node or comm id`);
    }
    const frozenAuthority = g1Authority.get(mapping.comm_id);
    if (frozenAuthority !== undefined && mapping.row_authority_class !== frozenAuthority) {
      push(
        "row-authority",
        `${mapping.comm_id} row_authority_class must equal frozen G1 authority ${frozenAuthority}`,
      );
    }

    if (!PLACEMENT.has(mapping.placementStatus)) {
      push(
        "placement",
        `${mapping.comm_id} has illegal placementStatus ${mapping.placementStatus}`,
      );
    }

    if (mapping.placementStatus === "reserved" || mapping.node_id === "node.observer.404") {
      push("reserved-404", "reserved 404 must not appear as a G1 mapping");
      continue;
    }

    if (mapping.placementStatus === "unplaced" || mapping.node_id === "unplaced") {
      if (
        mapping.placementStatus !== "unplaced" ||
        mapping.node_id !== "unplaced" ||
        mapping.home_bus_id !== null ||
        mapping.origin_bus_id !== null
      ) {
        push(
          "placement",
          `${mapping.comm_id} unplaced tuple requires node unplaced and null home/origin`,
        );
      }
      if (!completeGap(mapping.placement)) {
        push("unplaced-gap", `${mapping.comm_id} unplaced requires gap and steward`);
      }
      continue;
    }

    if (
      mapping.placementStatus !== "placed" ||
      mapping.node_id === "unplaced" ||
      mapping.home_bus_id === null ||
      mapping.origin_bus_id === null ||
      mapping.placement !== undefined
    ) {
      push(
        "placement",
        `${mapping.comm_id} placed tuple requires a known node, equal non-null buses, and no gap`,
      );
    }

    const node = nodeById.get(mapping.node_id);
    if (node === undefined) {
      push("unknown-node", `${mapping.comm_id} maps to missing node ${mapping.node_id}`);
      continue;
    }
    const home = (homes.get(mapping.node_id) ?? [])[0];
    if (mapping.home_bus_id !== home) {
      push("origin-bus", `${mapping.comm_id} home_bus_id must equal node home`);
    }
    if (mapping.origin_bus_id !== home) {
      push(
        "origin-bus",
        `${mapping.comm_id} origin_bus_id must equal node home ${home ?? "<none>"}`,
      );
    }
    if (mapping.home_bus_id !== null && !busById.has(mapping.home_bus_id)) {
      push("unknown-bus", `${mapping.comm_id} maps to missing bus ${mapping.home_bus_id}`);
    }
    if (mapping.origin_relationship !== "home") {
      push("relationship", `${mapping.comm_id} placed origin_relationship must be home`);
    }
    const intended = mapping.intended_bus_relationship;
    if (intended === "unknown") {
      if (!completeGap(mapping.relationshipGap)) {
        push(
          "unknown-relationship",
          `${mapping.comm_id} unknown relationship requires gap and steward`,
        );
      }
    } else if (
      frozenAuthority !== undefined &&
      intended !== requiredIntended(frozenAuthority, mapping.node_id)
    ) {
      push(
        "relationship",
        `${mapping.comm_id} intended_bus_relationship must be ${requiredIntended(frozenAuthority, mapping.node_id)}`,
      );
    } else if (intended !== undefined && !RELATIONSHIPS.has(intended)) {
      push("relationship", `${mapping.comm_id} has illegal intended_bus_relationship ${intended}`);
    } else if (intended === undefined) {
      push("relationship", `${mapping.comm_id} requires intended_bus_relationship`);
    }
    if (intended !== undefined && intended !== "home" && intended !== "unknown") {
      requiredBindings.set(`${mapping.node_id}|${intended}`, mapping.comm_id);
    }
  }
  for (const [key, commId] of requiredBindings) {
    if (!bindingKeys.has(key)) {
      push(
        "relationship",
        `${commId} intended relationship ${key} is missing from node-bus bindings`,
      );
    }
  }
  const missing = [...g1].filter((id) => !seen.has(id));
  const unexpected = [...seen].filter((id) => !g1.has(id));
  if (duplicates.length > 0 || missing.length > 0 || unexpected.length > 0) {
    push(
      "coverage-id-set",
      `overlay IDs must equal G1 comm_ids; missing ${missing.join(", ") || "none"}; unexpected ${unexpected.join(", ") || "none"}; duplicate ${duplicates.join(", ") || "none"}`,
    );
  }

  if (failures.length > 0) {
    return { ok: false, failures };
  }
  return { ok: true };
};

// @effect-diagnostics nodeBuiltinImport:off
/**
 * G1B D15C completeness checker.
 *
 * Validates inventory rows against the frozen G1A retained-result
 * registry, catalog registry, identity-bound MCP negative control, and
 * closed dispositions. Does not claim an unknowable universe.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { T2_CATALOG_BOUNDARIES, type T2CatalogBoundary } from "../t2Observability/boundaries.ts";

export const NEGATIVE_CONTROL_PATH_ID = "NC-MCP-HTTP";
export const NEGATIVE_CONTROL_COMM_ID = "INV-T2-MCP-HTTP";
export const NEGATIVE_CONTROL_SYMBOL = "apps/server/src/mcp/McpHttpServer.ts";

export const EXPECTED_NEGATIVE_CONTROL = {
  commId: NEGATIVE_CONTROL_COMM_ID,
  pathId: NEGATIVE_CONTROL_PATH_ID,
  symbol: NEGATIVE_CONTROL_SYMBOL,
  sourceSystem: "t2-mcp",
  name: "MCP HTTP server",
  transportBoundary: "HTTP MCP",
  mechanismClass: "external-transport",
} as const;

export const DISPOSITIONS = [
  "no-live-t2-host-communication-discovered",
  "enumerable-registry-not-communication",
  "no-live-production-communication",
] as const;

export type Disposition = (typeof DISPOSITIONS)[number];

const D15C_REQUIRED = [
  "comm_id",
  "source_system",
  "name",
  "owner",
  "sender",
  "receiver",
  "transport_boundary",
  "authority_class",
  "equality_object",
  "home_or_authority",
] as const;

const AUTHORITY_CLASSES = new Set(["A0", "A1", "A2", "observer", "human"]);
const MECHANISM_CLASSES = [
  "rpc-service-interfaces",
  "streams",
  "queues",
  "callbacks",
  "persistence",
  "process-flags",
  "subprocess",
  "external-transport",
] as const;
const A7_REVIEW_STATES = new Set(["pending", "approved", "withheld"]);
const AGGREGATION_RULE_ID = "shared-d15c-identity";

export interface AggregationMember {
  readonly id: string;
  readonly sourceSymbol: string;
  readonly sender: string;
  readonly receiver: string;
  readonly authority_class: string;
  readonly equality_object: string;
  readonly home_or_authority: string;
  readonly transport_family: string;
}

export interface D15cRow {
  readonly comm_id: string;
  readonly source_system: string;
  readonly name: string;
  readonly owner: string;
  readonly sender: string;
  readonly receiver: string;
  readonly transport_boundary: string;
  readonly authority_class: string;
  readonly equality_object: string;
  readonly home_or_authority: string;
  readonly notes?: string;
  readonly mechanism_classes: ReadonlyArray<string>;
  readonly catalog_boundary?: T2CatalogBoundary;
  readonly path_id?: string;
  readonly negative_control?: boolean;
  readonly symbols?: ReadonlyArray<string>;
  readonly aggregated_members?: ReadonlyArray<AggregationMember>;
  readonly aggregation_rule?: string;
}

export interface CoverageResult {
  readonly id: string;
  readonly quote: string;
  readonly comm_ids?: ReadonlyArray<string>;
  readonly exclusion_id?: string;
  readonly disposition?: string;
  readonly discoveryProcedure?: string;
  readonly steward?: string;
  readonly reviewStatus?: string;
  readonly registryIdentity?: string;
  readonly sourceSymbol?: string;
}

export interface RetainedResult {
  readonly id: string;
  readonly mechanismClass: string;
  readonly evidenceRef: string;
  readonly quote: string;
}

export interface G1bManifest {
  readonly gate: string;
  readonly status: string;
  readonly g1Closed: boolean;
  readonly g3Authorized: boolean;
  readonly g4toG7Authorized: boolean;
  readonly doesNotClaim: string;
  readonly inventoryRef: string;
  readonly coverageRef: string;
  readonly negativeControlPathId: string;
  readonly a7: {
    readonly g1ExitReview: string;
    readonly identity?: string;
    readonly g1aApprovalIdentity?: string;
    readonly note?: string;
  };
}

interface G1aClass {
  readonly id: string;
  readonly inventoryRowIds: ReadonlyArray<string>;
  readonly exclusions: ReadonlyArray<string>;
}

interface G1aManifest {
  readonly g1bAuthorized: boolean;
  readonly retainedResultsRef: string;
  readonly negativeControl: { readonly pathId: string; readonly symbol: string };
  readonly enumerableRegistries: { readonly T2_CATALOG_BOUNDARIES: ReadonlyArray<string> };
  readonly mechanismClasses: ReadonlyArray<G1aClass>;
}

export interface G1bPackage {
  readonly manifest: G1bManifest;
  readonly inventory: { readonly rows: ReadonlyArray<D15cRow> };
  readonly coverage: { readonly results: ReadonlyArray<CoverageResult> };
  readonly retainedResults: { readonly results: ReadonlyArray<RetainedResult> };
  readonly g1aManifest: G1aManifest;
  readonly evidenceText: string;
  readonly exclusionsText: string;
}

export interface G1bFailure {
  readonly code: string;
  readonly message: string;
}

export type G1bCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failures: ReadonlyArray<G1bFailure> };

const isNonEmpty = (value: string | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const isDisposition = (value: string): value is Disposition =>
  DISPOSITIONS.includes(value as Disposition);

/**
 * Load the G1B package and frozen G1A retained-result registry.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     T2-SQUARED repository root.
 *
 * Returns
 * -------
 * G1bPackage
 *     Parsed inventory, coverage, retained results, and evidence text.
 *
 * Example
 * -------
 * const pkg = loadG1bPackage("/path/to/T2-SQUARED");
 */
export const loadG1bPackage = (repoRoot: string): G1bPackage => {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g1b/manifest.json"), "utf8"),
  ) as G1bManifest;
  const g1aManifest = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g1a/completeness-manifest.json"), "utf8"),
  ) as G1aManifest;
  const inventory = JSON.parse(readFileSync(join(repoRoot, manifest.inventoryRef), "utf8")) as {
    rows: D15cRow[];
  };
  const coverage = JSON.parse(readFileSync(join(repoRoot, manifest.coverageRef), "utf8")) as {
    results: CoverageResult[];
  };
  const retainedResults = JSON.parse(
    readFileSync(join(repoRoot, g1aManifest.retainedResultsRef), "utf8"),
  ) as { results: RetainedResult[] };
  return {
    manifest,
    inventory,
    coverage,
    retainedResults,
    g1aManifest,
    evidenceText: readFileSync(join(repoRoot, "docs/scm/g1a/evidence.md"), "utf8"),
    exclusionsText: readFileSync(join(repoRoot, "docs/scm/g1a/exclusions.md"), "utf8"),
  };
};

const uniqueIds = (
  ids: ReadonlyArray<string>,
  label: string,
  push: (code: string, message: string) => void,
) => {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      push("coverage-id-set", `duplicate ${label} ${id}`);
    }
    seen.add(id);
  }
  return seen;
};

/**
 * Check G1B completeness against the frozen G1A registry.
 *
 * Parameters
 * ----------
 * pkg : G1bPackage
 *     Inventory plus G1A retained results and coverage.
 *
 * Returns
 * -------
 * G1bCheckResult
 *     `ok: true` when identity, coverage-set, catalog, and disposition checks hold.
 *
 * Example
 * -------
 * const result = checkG1bCompleteness(loadG1bPackage(repoRoot));
 */
export const checkG1bCompleteness = (pkg: G1bPackage): G1bCheckResult => {
  const failures: G1bFailure[] = [];
  const push = (code: string, message: string) => {
    failures.push({ code, message });
  };

  if (pkg.manifest.gate !== "G1B") {
    push("manifest-gate", `expected G1B, got ${pkg.manifest.gate}`);
  }
  if (!A7_REVIEW_STATES.has(pkg.manifest.a7?.g1ExitReview)) {
    push("a7-review-state", "a7.g1ExitReview must be pending, approved, or withheld");
  }
  const review = pkg.manifest.a7?.g1ExitReview;
  const status = pkg.manifest.status;
  const closed = pkg.manifest.g1Closed;
  const allowedTuple =
    (review === "pending" && status === "awaiting-a7-g1-exit" && closed === false) ||
    (review === "withheld" && status === "a7-withheld" && closed === false) ||
    (review === "approved" && status === "g1-closed" && closed === true);
  if (!allowedTuple) {
    push(
      "closure-tuple",
      `illegal tuple review=${review} status=${status} g1Closed=${String(closed)}`,
    );
  }
  if (pkg.manifest.g3Authorized) {
    push("g3-authorized", "this package must not authorize G3");
  }
  if (pkg.manifest.g4toG7Authorized) {
    push("g4-g7-authorized", "this package must not authorize G4-G7");
  }
  if (!pkg.g1aManifest.g1bAuthorized) {
    push("g1a-not-authorized", "G1A has not authorized G1B");
  }

  const rows = pkg.inventory.rows;
  const byId = new Map<string, D15cRow>();
  for (const row of rows) {
    if (byId.has(row.comm_id)) {
      push("duplicate-comm-id", `duplicate comm_id ${row.comm_id}`);
    }
    byId.set(row.comm_id, row);
    for (const column of D15C_REQUIRED) {
      if (!isNonEmpty(row[column])) {
        push("empty-d15c-column", `${row.comm_id} has empty required column ${column}`);
      }
    }
    if (!AUTHORITY_CLASSES.has(row.authority_class)) {
      push("authority-class", `${row.comm_id} has invalid authority_class ${row.authority_class}`);
    }
    if (row.mechanism_classes.length === 0) {
      push("mechanism-class", `${row.comm_id} has no mechanism_classes`);
    }
    for (const cls of row.mechanism_classes) {
      if (!MECHANISM_CLASSES.includes(cls as (typeof MECHANISM_CLASSES)[number])) {
        push("mechanism-class", `${row.comm_id} has unknown mechanism class ${cls}`);
      }
    }
    if (
      row.catalog_boundary !== undefined &&
      !T2_CATALOG_BOUNDARIES.includes(row.catalog_boundary)
    ) {
      push(
        "catalog-boundary",
        `${row.comm_id} has unknown catalog_boundary ${row.catalog_boundary}`,
      );
    }
    if (row.aggregated_members !== undefined) {
      if (row.aggregation_rule !== AGGREGATION_RULE_ID) {
        push(
          "aggregation-rule",
          `${row.comm_id} must declare aggregation_rule ${AGGREGATION_RULE_ID}`,
        );
      }
      if (row.aggregated_members.length < 2) {
        push(
          "aggregation-members",
          `${row.comm_id} aggregated_members must list at least two members`,
        );
      }
      const seenMembers = new Set<string>();
      for (const member of row.aggregated_members) {
        if (typeof member !== "object" || member === null) {
          push("aggregation-shape", `${row.comm_id} aggregated members must be identity tuples`);
          continue;
        }
        if (!isNonEmpty(member.id) || seenMembers.has(member.id)) {
          push(
            "aggregation-members",
            `${row.comm_id} has empty or duplicate member id ${member.id}`,
          );
        }
        seenMembers.add(member.id);
        if (!isNonEmpty(member.sourceSymbol)) {
          push("aggregation-shape", `${row.comm_id} member ${member.id} lacks sourceSymbol`);
        }
        const identityMatch =
          member.sender === row.sender &&
          member.receiver === row.receiver &&
          member.authority_class === row.authority_class &&
          member.equality_object === row.equality_object &&
          member.home_or_authority === row.home_or_authority &&
          member.transport_family === row.transport_boundary;
        if (!identityMatch) {
          push(
            "aggregation-identity",
            `${row.comm_id} member ${member.id} D15C identity diverges from the aggregate row`,
          );
        }
      }
    }
  }

  for (const boundary of T2_CATALOG_BOUNDARIES) {
    if (!rows.some((row) => row.catalog_boundary === boundary)) {
      push("catalog-unreconciled", `no D15C row for catalog boundary ${boundary}`);
    }
  }

  if (
    pkg.manifest.negativeControlPathId !== EXPECTED_NEGATIVE_CONTROL.pathId ||
    pkg.g1aManifest.negativeControl.pathId !== EXPECTED_NEGATIVE_CONTROL.pathId ||
    pkg.g1aManifest.negativeControl.symbol !== EXPECTED_NEGATIVE_CONTROL.symbol
  ) {
    push(
      "negative-control-id",
      "negative control identity must remain NC-MCP-HTTP / McpHttpServer.ts",
    );
  }

  const negative = byId.get(EXPECTED_NEGATIVE_CONTROL.commId);
  const impostors = rows.filter(
    (row) =>
      row.comm_id !== EXPECTED_NEGATIVE_CONTROL.commId &&
      (row.path_id === EXPECTED_NEGATIVE_CONTROL.pathId || row.negative_control === true),
  );
  if (impostors.length > 0) {
    push(
      "negative-control-identity",
      `NC-MCP-HTTP metadata is bound to ${EXPECTED_NEGATIVE_CONTROL.commId}, not ${impostors.map((row) => row.comm_id).join(", ")}`,
    );
  }
  if (negative === undefined) {
    push(
      "negative-control-missing",
      `removing or omitting ${EXPECTED_NEGATIVE_CONTROL.commId} / ${EXPECTED_NEGATIVE_CONTROL.pathId} fails G1B completeness`,
    );
  } else {
    const identityOk =
      negative.path_id === EXPECTED_NEGATIVE_CONTROL.pathId &&
      negative.negative_control === true &&
      negative.source_system === EXPECTED_NEGATIVE_CONTROL.sourceSystem &&
      negative.name === EXPECTED_NEGATIVE_CONTROL.name &&
      negative.transport_boundary === EXPECTED_NEGATIVE_CONTROL.transportBoundary &&
      negative.mechanism_classes.includes(EXPECTED_NEGATIVE_CONTROL.mechanismClass) &&
      negative.catalog_boundary === undefined &&
      (negative.symbols ?? []).includes(EXPECTED_NEGATIVE_CONTROL.symbol);
    if (!identityOk) {
      push(
        "negative-control-identity",
        `${EXPECTED_NEGATIVE_CONTROL.commId} must keep MCP HTTP identity, ${EXPECTED_NEGATIVE_CONTROL.symbol}, and unwrapped external-transport`,
      );
    }
  }

  const frozenIds = uniqueIds(
    pkg.retainedResults.results.map((row) => row.id),
    "retained-result id",
    push,
  );
  const coverageIds = uniqueIds(
    pkg.coverage.results.map((row) => row.id),
    "coverage id",
    push,
  );
  const missingCoverage = [...frozenIds].filter((id) => !coverageIds.has(id));
  const unexpectedCoverage = [...coverageIds].filter((id) => !frozenIds.has(id));
  if (missingCoverage.length > 0 || unexpectedCoverage.length > 0) {
    push(
      "coverage-id-set",
      `coverage IDs must equal frozen G1A retained-result IDs; missing ${missingCoverage.join(", ") || "none"}; unexpected ${unexpectedCoverage.join(", ") || "none"}`,
    );
  }

  const retainedById = new Map(pkg.retainedResults.results.map((row) => [row.id, row]));
  const referenced = new Set<string>();
  for (const result of pkg.coverage.results) {
    if (!isNonEmpty(result.id) || !isNonEmpty(result.quote)) {
      push("coverage-shape", `coverage result ${result.id ?? "<missing>"} is incomplete`);
      continue;
    }
    const frozen = retainedById.get(result.id);
    if (frozen !== undefined) {
      if (frozen.quote !== result.quote) {
        push("coverage-quote", `${result.id} quote must match frozen G1A retained-result quote`);
      }
      const evidencePath = frozen.evidenceRef.split("#")[0] ?? "";
      if (!existsSync(evidencePath) && !frozen.evidenceRef.startsWith("docs/scm/g1a/")) {
        push("retained-evidence-ref", `${result.id} evidenceRef is not a G1A path`);
      }
    }
    const inEvidence = pkg.evidenceText.includes(result.quote);
    const inExclusions = pkg.exclusionsText.includes(result.quote);
    if (!inEvidence && !inExclusions) {
      push("coverage-quote", `${result.id} quote was not found in G1A evidence or exclusions`);
    }
    const hasRows = (result.comm_ids?.length ?? 0) > 0;
    const hasExclusion = isNonEmpty(result.exclusion_id);
    const hasDisposition = isNonEmpty(result.disposition);
    if ([hasRows, hasExclusion, hasDisposition].filter(Boolean).length !== 1) {
      push(
        "coverage-mapping",
        `${result.id} must map to exactly one of comm_ids, exclusion_id, or disposition`,
      );
    }
    if (hasRows) {
      for (const commId of result.comm_ids ?? []) {
        referenced.add(commId);
        if (!byId.has(commId)) {
          push("coverage-missing-row", `${result.id} maps to missing comm_id ${commId}`);
        }
      }
    }
    if (hasExclusion && !pkg.exclusionsText.includes(result.exclusion_id ?? "")) {
      push("coverage-exclusion", `${result.id} maps to unknown exclusion ${result.exclusion_id}`);
    }
    if (hasDisposition) {
      if (!isDisposition(result.disposition ?? "")) {
        push("disposition-unknown", `${result.id} has unknown disposition ${result.disposition}`);
      } else if (result.disposition === "no-live-t2-host-communication-discovered") {
        if (
          !isNonEmpty(result.discoveryProcedure) ||
          !isNonEmpty(result.steward) ||
          !isNonEmpty(result.reviewStatus)
        ) {
          push(
            "disposition-no-live",
            `${result.id} no-live disposition requires discoveryProcedure, steward, and reviewStatus`,
          );
        }
      } else if (result.disposition === "enumerable-registry-not-communication") {
        if (result.registryIdentity !== "T2_CATALOG_BOUNDARIES") {
          push(
            "disposition-registry",
            `${result.id} enumerable-registry disposition requires registryIdentity T2_CATALOG_BOUNDARIES`,
          );
        }
        for (const boundary of pkg.g1aManifest.enumerableRegistries.T2_CATALOG_BOUNDARIES) {
          if (!rows.some((row) => row.catalog_boundary === boundary)) {
            push(
              "disposition-registry",
              `${result.id} registry ${boundary} is not reconciled to a D15C row`,
            );
          }
        }
      } else if (result.disposition === "no-live-production-communication") {
        if (
          !isNonEmpty(result.sourceSymbol) ||
          !isNonEmpty(result.steward) ||
          !isNonEmpty(result.reviewStatus)
        ) {
          push(
            "disposition-no-live-production",
            `${result.id} no-live-production disposition requires sourceSymbol, steward, and reviewStatus`,
          );
        }
      }
    }
  }

  for (const frozen of pkg.retainedResults.results) {
    if (
      !isNonEmpty(frozen.id) ||
      !isNonEmpty(frozen.mechanismClass) ||
      !isNonEmpty(frozen.evidenceRef) ||
      !isNonEmpty(frozen.quote)
    ) {
      push("retained-shape", `retained result ${frozen.id ?? "<missing>"} is incomplete`);
    }
  }

  for (const row of rows) {
    if (!referenced.has(row.comm_id)) {
      push("unmapped-row", `${row.comm_id} is not mapped from G1A coverage`);
    }
  }

  for (const cls of pkg.g1aManifest.mechanismClasses) {
    const expected = [
      ...new Set(
        rows.filter((row) => row.mechanism_classes.includes(cls.id)).map((row) => row.comm_id),
      ),
    ].sort();
    const actual = [...cls.inventoryRowIds].sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      push("manifest-row-ids", `${cls.id} inventoryRowIds must list every D15C row in that class`);
    }
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
};

// @effect-diagnostics nodeBuiltinImport:off
/**
 * G9 WP8 exact-set fixture runner (W8-PROOF / WP8-Fixture-Owner).
 *
 * Intended: load generated `fixture-vectors.json` + `coverage-validation.json`,
 * map every counted vector to a machine driver class, execute without silent
 * skip, and emit a manifest (executed | failed | unmapped). Close gate requires
 * zero unmapped counted vectors and zero failures at the validation count (763).
 *
 * Driver classes (RFC-019 machine fields — never request-label prose alone):
 * - declaration-absence: assert ledger predicate only; never call captureOccurrence
 * - dormant-prototype: B6 `g9FamilyHomeBusLinkFixtures` test wiring only
 * - live-success: coordinator.captureOccurrence with bounded_live_projection
 *
 * Observed: `runG9FixtureMarathon` below. No wall sleep. No production
 * home-bus-link fabric. Does not flip g9toG10Authorized. Does not authorize G10.
 * Does not hand-edit generated JSON. Prefer this harness over server.ts CI wiring.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { DipMuteStore } from "./g6DipMute.ts";
import { loadG8FramingParameters } from "./g8SharedClock.ts";
import { G9RosterCoordinator } from "./g9Coordinator.ts";
import { G9FaultController } from "./g9Fault.ts";
import {
  captureHomeBusForwardSucceeded,
  HOME_BUS_FORWARD_FIXTURE_ID,
  HOME_BUS_LINK_COMM_ID,
} from "./g9FamilyHomeBusLinkFixtures.ts";
import { makeG9Observation } from "./g9Observation.ts";
import type { G9CaptureOccurrenceInput, G9FaultSink } from "./g9Occurrence.ts";
import {
  findRowPhase,
  loadG9Package,
  type G9Package,
  type G9PhaseDeclaration,
} from "./g9Package.ts";

/** Machine driver class selected for one counted fixture vector. */
export type G9FixtureDriverClass = "declaration-absence" | "dormant-prototype" | "live-success";

/** One generated fixture vector (schemaVersion 1 shape). */
export type G9FixtureVector = {
  readonly fixture_id: string;
  readonly phase: string;
  readonly bounded_live_projection: Readonly<Record<string, string>>;
  readonly expected_equality_A: Readonly<Record<string, string>>;
  readonly expected_semanticKind: "request" | "state";
  readonly expected_request_label: string;
  readonly expected_state_label: string;
  readonly expected_retention: boolean;
  readonly expected_live_failure_no_capture_disposition: string;
  readonly finite_branch_provenance: string;
};

/** validation JSON fields WP8 consumes for count + absence/dormant sets. */
export type G9CoverageValidationSlice = {
  readonly counted_fixture_vector_count: number;
  readonly g1b_unique_count: number;
  readonly g3_unique_count: number;
  readonly g9_unique_count: number;
  readonly top_level_set_equality: boolean;
  readonly declaration_absence_phases: ReadonlyArray<{
    readonly comm_id: string;
    readonly phase_id: string;
  }>;
  readonly dormant_prototype_phases: ReadonlyArray<{
    readonly comm_id: string;
    readonly phase_id: string;
  }>;
  readonly "dormant-prototype": ReadonlyArray<string>;
};

/** Per-vector outcome recorded in the marathon manifest. */
export type G9FixtureVectorOutcome =
  | { readonly status: "executed"; readonly fixture_id: string; readonly comm_id: string }
  | {
      readonly status: "failed";
      readonly fixture_id: string;
      readonly comm_id: string | undefined;
      readonly reason: string;
    }
  | { readonly status: "unmapped"; readonly fixture_id: string; readonly reason: string };

/** Close-gate manifest for the counted fixture set. */
export type G9FixtureMarathonManifest = {
  readonly counted_fixture_vector_count: number;
  readonly executed: ReadonlyArray<{ readonly fixture_id: string; readonly comm_id: string }>;
  readonly failed: ReadonlyArray<{
    readonly fixture_id: string;
    readonly comm_id: string | undefined;
    readonly reason: string;
  }>;
  readonly unmapped: ReadonlyArray<{ readonly fixture_id: string; readonly reason: string }>;
  readonly covered_comm_ids: ReadonlyArray<string>;
};

type FixtureVectorsFile = {
  readonly schemaVersion: number;
  readonly vectors: Record<string, G9FixtureVector>;
};

/**
 * Load generated fixture corpus from monorepo root.
 *
 * Agent: never hand-edit the JSON; regen via docs/scm/g9/regen_coverage_ledger.py.
 */
export const loadG9FixtureVectors = (repoRoot: string): FixtureVectorsFile => {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g9/fixture-vectors.json"), "utf8"),
  ) as FixtureVectorsFile;
  if (raw.schemaVersion !== 1 || typeof raw.vectors !== "object" || raw.vectors === null) {
    throw new Error("g9FixtureRunner: fixture-vectors.json schemaVersion/vectors invalid");
  }
  return raw;
};

/**
 * Load coverage-validation.json slice needed for WP8 close gates.
 */
export const loadG9CoverageValidationSlice = (repoRoot: string): G9CoverageValidationSlice => {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g9/coverage-validation.json"), "utf8"),
  ) as G9CoverageValidationSlice;
  if (
    typeof raw.counted_fixture_vector_count !== "number" ||
    !Array.isArray(raw.declaration_absence_phases) ||
    !Array.isArray(raw.dormant_prototype_phases)
  ) {
    throw new Error("g9FixtureRunner: coverage-validation.json missing WP8 fields");
  }
  return raw;
};

/**
 * Parse `comm_id` from `fx.{comm_id}.{phase}.{branch}` using the vector phase.
 *
 * Agent: phase may contain hyphens; fixture_id always embeds `.{phase}.` after comm_id.
 */
export const parseCommIdFromFixtureId = (fixtureId: string, phase: string): string | undefined => {
  if (!fixtureId.startsWith("fx.")) return undefined;
  const rest = fixtureId.slice(3);
  const marker = `.${phase}.`;
  const idx = rest.indexOf(marker);
  if (idx >= 0) return rest.slice(0, idx);
  if (rest.endsWith(`.${phase}`)) return rest.slice(0, -(phase.length + 1));
  return undefined;
};

/**
 * Resolve driver class from package phase + validation membership (RFC-019).
 *
 * Forbidden: keying solely on CANONICAL_ABSENCE / prose status.
 */
export const resolveG9FixtureDriverClass = (
  phase: G9PhaseDeclaration | undefined,
  commId: string,
  phaseId: string,
  validation: G9CoverageValidationSlice,
): G9FixtureDriverClass | undefined => {
  if (phase?.fixture_driver_class === "declaration-absence") {
    return "declaration-absence";
  }
  if (phase?.fixture_driver_class === "dormant-prototype") {
    return "dormant-prototype";
  }
  const absenceHit = validation.declaration_absence_phases.some(
    (p) => p.comm_id === commId && p.phase_id === phaseId,
  );
  if (absenceHit) return "declaration-absence";
  const dormantHit = validation.dormant_prototype_phases.some(
    (p) => p.comm_id === commId && p.phase_id === phaseId,
  );
  if (dormantHit) return "dormant-prototype";
  if (phase !== undefined) return "live-success";
  return undefined;
};

/**
 * Build capture `input` from bounded projection + complementary labels when multi.
 *
 * Agent: mirrors g9Coordinator.projectCaptureLabels complementary-label law.
 */
export const buildCaptureInputFromVector = (
  commId: string,
  phase: G9PhaseDeclaration,
  vector: G9FixtureVector,
): G9CaptureOccurrenceInput => {
  const fields: Record<string, string> = { ...vector.bounded_live_projection };
  if (phase.semanticKind === "request" && phase.state_label.length > 1) {
    fields.state_label = vector.expected_state_label;
  }
  if (phase.semanticKind === "state" && phase.request_label.length > 1) {
    fields.request_label = vector.expected_request_label;
  }
  return {
    comm_id: commId,
    phase: vector.phase,
    input: fields,
  } as G9CaptureOccurrenceInput;
};

/**
 * Test-only roster coordinator for fixture marathon (not production bootstrap).
 *
 * Agent: same construction order as WP7 assemble, without armed waker timer.
 */
export const makeG9FixtureTestCoordinator = (
  repoRoot: string,
): { readonly pkg: G9Package; readonly coordinator: G9RosterCoordinator } => {
  const pkg = loadG9Package(repoRoot);
  const store = new DipMuteStore(pkg.governed);
  const observation = makeG9Observation();
  const sink: G9FaultSink = { deliver: () => Effect.void };
  const faults = new G9FaultController(
    observation,
    sink,
    () => undefined,
    () => undefined,
  );
  const framing = loadG8FramingParameters(repoRoot);
  const coordinator = new G9RosterCoordinator(pkg, store, observation, faults, framing);
  return { pkg, coordinator };
};

/**
 * Drain one FIFO head after a successful enqueue so node depth never hits 64
 * across the 763-vector marathon (capacity stress is a dedicated property suite).
 */
const drainAfterEnqueue = (coordinator: G9RosterCoordinator, nodeId: string): void => {
  coordinator.fifo.dequeueHead(nodeId);
};

const deepEqualRecords = (
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, unknown>>,
): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
};

/**
 * Execute one counted vector. Returns executed | failed | unmapped.
 *
 * Parameters
 * ----------
 * ctx : marathon context (pkg, coordinator, validation)
 * vector : generated fixture vector
 *
 * Returns
 * -------
 * G9FixtureVectorOutcome
 *     Explicit status — never a silent skip.
 */
export const executeG9FixtureVector = (
  ctx: {
    readonly pkg: G9Package;
    readonly coordinator: G9RosterCoordinator;
    readonly validation: G9CoverageValidationSlice;
  },
  vector: G9FixtureVector,
): G9FixtureVectorOutcome => {
  const fixture_id = vector.fixture_id;
  const commId = parseCommIdFromFixtureId(fixture_id, vector.phase);
  if (commId === undefined) {
    return {
      status: "unmapped",
      fixture_id,
      reason: "could not parse comm_id from fixture_id",
    };
  }

  const looked = findRowPhase(ctx.pkg, commId, vector.phase);
  const driver = resolveG9FixtureDriverClass(looked?.phase, commId, vector.phase, ctx.validation);
  if (driver === undefined || looked === undefined) {
    return {
      status: "unmapped",
      fixture_id,
      reason: `no driver for ${commId}/${vector.phase}`,
    };
  }

  try {
    switch (driver) {
      case "declaration-absence": {
        // RFC-019: assert declaration only — do not call captureOccurrence.
        if (looked.phase.fixture_driver_class !== "declaration-absence") {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "expected fixture_driver_class declaration-absence",
          };
        }
        if (vector.expected_live_failure_no_capture_disposition === "success-path") {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "absence disposition must not be success-path",
          };
        }
        if (vector.expected_retention !== looked.phase.retainCurrentAfterPublish) {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "retention mismatch on absence phase",
          };
        }
        return { status: "executed", fixture_id, comm_id: commId };
      }
      case "dormant-prototype": {
        // B6 fixture-only path; production bootstrap must never invoke this.
        if (looked.phase.fixture_driver_class !== "dormant-prototype") {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "expected fixture_driver_class dormant-prototype",
          };
        }
        if (commId !== HOME_BUS_LINK_COMM_ID || fixture_id !== HOME_BUS_FORWARD_FIXTURE_ID) {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "dormant vector must be B6 home-bus-forward fixture id",
          };
        }
        if (vector.expected_live_failure_no_capture_disposition === "success-path") {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "dormant disposition must not be success-path",
          };
        }
        if (!ctx.validation["dormant-prototype"].includes(HOME_BUS_LINK_COMM_ID)) {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "INV-T2-SCM-HOME-BUS-LINK not listed dormant-prototype in validation",
          };
        }
        const capture = (input: G9CaptureOccurrenceInput) =>
          ctx.coordinator.captureOccurrence(input);
        const result = Effect.runSync(captureHomeBusForwardSucceeded(capture));
        if (result === undefined || result.status !== "enqueued") {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: `dormant capture status ${result?.status ?? "undefined"}`,
          };
        }
        if (!deepEqualRecords(vector.expected_equality_A, result.occurrence.equality_A)) {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "dormant equality_A mismatch",
          };
        }
        if (result.occurrence.request_label !== vector.expected_request_label) {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "dormant request_label mismatch",
          };
        }
        if (result.occurrence.state_label !== vector.expected_state_label) {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "dormant state_label mismatch",
          };
        }
        if (result.occurrence.retainCurrentAfterPublish !== vector.expected_retention) {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "dormant retention mismatch",
          };
        }
        drainAfterEnqueue(ctx.coordinator, looked.row.node_id);
        return { status: "executed", fixture_id, comm_id: commId };
      }
      case "live-success": {
        if (vector.expected_live_failure_no_capture_disposition !== "success-path") {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: `live-success expects success-path disposition, got ${vector.expected_live_failure_no_capture_disposition}`,
          };
        }
        const input = buildCaptureInputFromVector(commId, looked.phase, vector);
        const exit = Effect.runSync(Effect.exit(ctx.coordinator.captureOccurrence(input)));
        if (Exit.isFailure(exit)) {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: `capture failed: ${String(exit.cause)}`,
          };
        }
        const result = exit.value;
        if (result.status !== "enqueued") {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: `expected enqueued, got ${result.status}`,
          };
        }
        if (!deepEqualRecords(vector.expected_equality_A, result.occurrence.equality_A)) {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "equality_A mismatch",
          };
        }
        if (result.occurrence.request_label !== vector.expected_request_label) {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "request_label mismatch",
          };
        }
        if (result.occurrence.state_label !== vector.expected_state_label) {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "state_label mismatch",
          };
        }
        if (result.occurrence.retainCurrentAfterPublish !== vector.expected_retention) {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "retention mismatch",
          };
        }
        if (result.occurrence.semanticKind !== vector.expected_semanticKind) {
          return {
            status: "failed",
            fixture_id,
            comm_id: commId,
            reason: "semanticKind mismatch",
          };
        }
        drainAfterEnqueue(ctx.coordinator, looked.row.node_id);
        return { status: "executed", fixture_id, comm_id: commId };
      }
      default: {
        const _exhaustive: never = driver;
        return {
          status: "unmapped",
          fixture_id,
          reason: `unknown driver ${String(_exhaustive)}`,
        };
      }
    }
  } catch (error) {
    return {
      status: "failed",
      fixture_id,
      comm_id: commId,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Run every counted fixture vector and build the WP8 close-gate manifest.
 *
 * Agent: zero silent skip — every vector is executed, failed, or unmapped.
 * Provenance (independently-extracted vs ledger-declaration) is not skip permission.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     Monorepo root containing docs/scm/g9/.
 *
 * Returns
 * -------
 * G9FixtureMarathonManifest
 *     Counts + per-id lists for CI / test assertions.
 */
export const runG9FixtureMarathon = (repoRoot: string): G9FixtureMarathonManifest => {
  const validation = loadG9CoverageValidationSlice(repoRoot);
  const fixtures = loadG9FixtureVectors(repoRoot);
  const vectorIds = Object.keys(fixtures.vectors).sort();
  const { pkg, coordinator } = makeG9FixtureTestCoordinator(repoRoot);
  const ctx = { pkg, coordinator, validation };

  const executed: { readonly fixture_id: string; readonly comm_id: string }[] = [];
  const failed: {
    readonly fixture_id: string;
    readonly comm_id: string | undefined;
    readonly reason: string;
  }[] = [];
  const unmapped: { readonly fixture_id: string; readonly reason: string }[] = [];
  const covered = new Set<string>();

  for (const fixtureId of vectorIds) {
    const vector = fixtures.vectors[fixtureId];
    if (vector === undefined) {
      unmapped.push({ fixture_id: fixtureId, reason: "missing vector body" });
      continue;
    }
    // Prefer vector.fixture_id when present; key must match for generator contract.
    if (vector.fixture_id !== fixtureId) {
      failed.push({
        fixture_id: fixtureId,
        comm_id: undefined,
        reason: `vector.fixture_id ${vector.fixture_id} !== map key`,
      });
      continue;
    }
    const outcome = executeG9FixtureVector(ctx, vector);
    switch (outcome.status) {
      case "executed":
        executed.push({ fixture_id: outcome.fixture_id, comm_id: outcome.comm_id });
        covered.add(outcome.comm_id);
        break;
      case "failed":
        failed.push({
          fixture_id: outcome.fixture_id,
          comm_id: outcome.comm_id,
          reason: outcome.reason,
        });
        break;
      case "unmapped":
        unmapped.push({ fixture_id: outcome.fixture_id, reason: outcome.reason });
        break;
      default: {
        const _exhaustive: never = outcome;
        unmapped.push({
          fixture_id: fixtureId,
          reason: `unknown outcome ${String(_exhaustive)}`,
        });
      }
    }
  }

  return {
    counted_fixture_vector_count: validation.counted_fixture_vector_count,
    executed,
    failed,
    unmapped,
    covered_comm_ids: [...covered].sort(),
  };
};

/**
 * G10 substitution model API (S0 foundation contracts).
 *
 * Intended: per-slice cutover installs a manifold Layer that becomes the
 * authority path for assigned `comm_id`s via explicit admit → route → replace.
 * Default remains today’s live until Ordered proof dual-run exit. G9
 * `T2CODE_SCM_G9_SHADOW` observe-beside is available for non-cut-over rows but
 * is **not** the cutover switch (see G9_SHADOW_IS_NOT_CUTOVER_SWITCH).
 *
 * Observed at S0: in-memory install bookkeeping only — does not wire
 * OrchestrationEngine / ws / provider fabric seams. captureOccurrence is not
 * cutover. Does not unset or depend on T2CODE_SCM_G9_SHADOW.
 */
import { G9_SHADOW_PARITY_ENV } from "./g9Bootstrap.ts";
import {
  activatableCommIdsForSlice,
  isDormantExempt,
  type G10CutoverRegistry,
} from "./g10CutoverRegistry.ts";
import {
  makeDefaultSliceState,
  type CutoverPhase,
  type G10FabricSliceId,
  type G10SliceCutoverState,
  type G10SliceId,
} from "./g10Types.ts";

/**
 * Explicit law: G9 shadow env is observe-beside, not Increment 6 cutover.
 * Agents must not treat env-on/off as admit/route/replace.
 */
export const G9_SHADOW_IS_NOT_CUTOVER_SWITCH = true as const;

/** Substitution install stages for a slice’s activatable `comm_id`s. */
export type SubstitutionStage = "admit" | "route" | "replace";

/**
 * Per-slice substitution install record (contract shape).
 *
 * Intended: after replace, manifold is wired for dual-run observe while live
 * remains authoritative until exit. authority stays "live" until markExited.
 */
export type G10SubstitutionInstall = {
  readonly slice: G10FabricSliceId;
  readonly commIds: readonly string[];
  readonly stagesCompleted: readonly SubstitutionStage[];
  /** Authority path: live until dual-run exit; then manifold. */
  readonly authority: "live" | "manifold";
  /** True when admit+route+replace completed for this slice’s radius rows. */
  readonly replaceInstalled: boolean;
};

/** Coordinator holding substitution installs + slice states (S0 in-memory). */
export type G10SubstitutionModel = {
  readonly registry: G10CutoverRegistry;
  readonly installs: Map<G10FabricSliceId, G10SubstitutionInstall>;
  readonly sliceStates: Map<G10SliceId, G10SliceCutoverState>;
};

/**
 * Create an empty substitution model (all slices default live).
 *
 * Parameters
 * ----------
 * registry : G10CutoverRegistry
 *     Inventory-backed activatable sets.
 *
 * Returns
 * -------
 * G10SubstitutionModel
 *     No installs; every slice state phase "live".
 */
export const createSubstitutionModel = (registry: G10CutoverRegistry): G10SubstitutionModel => {
  const sliceStates = new Map<G10SliceId, G10SliceCutoverState>();
  for (const slice of ["S0", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"] as const) {
    sliceStates.set(slice, makeDefaultSliceState(slice));
  }
  return { registry, installs: new Map(), sliceStates };
};

/**
 * Current authority for a slice (default live until exit recorded on install).
 */
export const authorityForSlice = (
  model: G10SubstitutionModel,
  slice: G10SliceId,
): "live" | "manifold" => {
  if (slice === "S0" || slice === "S8") return "live";
  const install = model.installs.get(slice);
  return install?.authority ?? "live";
};

/**
 * Current cutover phase for a slice (defaults to live).
 */
export const phaseForSlice = (model: G10SubstitutionModel, slice: G10SliceId): CutoverPhase =>
  model.sliceStates.get(slice)?.phase ?? "live";

const STAGE_ORDER: readonly SubstitutionStage[] = ["admit", "route", "replace"] as const;

/**
 * Advance one substitution stage for a fabric slice’s activatable `comm_id`s.
 *
 * Intended: admit → route → replace in order; refuses dormant ids; does not
 * consult G9 shadow env. After replace, authority remains "live" (dual-run)
 * until `recordOrderedProofStep(..., "dual-run-exit")`.
 *
 * Parameters
 * ----------
 * model : G10SubstitutionModel
 *     Mutable coordinator.
 * slice : G10FabricSliceId
 *     Fabric slice being installed.
 * stage : SubstitutionStage
 *     Next stage to record (must be sequential).
 *
 * Returns
 * -------
 * G10SubstitutionInstall
 *     Updated install record.
 *
 * Throws
 * ------
 * Error
 *     Out-of-order stage, dormant id in set, or empty activatable set misuse.
 */
export const advanceSubstitutionStage = (
  model: G10SubstitutionModel,
  slice: G10FabricSliceId,
  stage: SubstitutionStage,
): G10SubstitutionInstall => {
  const commIds = activatableCommIdsForSlice(model.registry, slice);
  for (const id of commIds) {
    if (isDormantExempt(model.registry, id)) {
      throw new Error(`G10 substitution refuses dormant-exempt ${id} on ${slice}`);
    }
  }

  const existing = model.installs.get(slice);
  const completed = existing?.stagesCompleted ?? [];
  const expected = STAGE_ORDER[completed.length];
  if (expected !== stage) {
    throw new Error(
      `G10 substitution stage out of order on ${slice}: expected ${expected ?? "done"}, got ${stage}`,
    );
  }

  const nextStages = [...completed, stage] as SubstitutionStage[];
  const replaceInstalled = nextStages.includes("replace");
  const install: G10SubstitutionInstall = {
    slice,
    commIds,
    stagesCompleted: nextStages,
    // Live remains authority until Ordered proof dual-run exit (not at replace).
    authority: existing?.authority === "manifold" ? "manifold" : "live",
    replaceInstalled,
  };
  model.installs.set(slice, install);

  // Runtime land bookkeeping only — Ordered proof "land" is recorded by
  // g10ProofHarness.recordOrderedProofStep (sole owner of completedProofSteps).
  if (replaceInstalled) {
    const state = model.sliceStates.get(slice) ?? makeDefaultSliceState(slice);
    if (state.phase === "live") {
      state.phase = "landed";
    }
    model.sliceStates.set(slice, state);
  }

  return install;
};

/**
 * Convenience: run admit → route → replace for a slice (still live authority).
 */
export const installAdmitRouteReplace = (
  model: G10SubstitutionModel,
  slice: G10FabricSliceId,
): G10SubstitutionInstall => {
  advanceSubstitutionStage(model, slice, "admit");
  advanceSubstitutionStage(model, slice, "route");
  return advanceSubstitutionStage(model, slice, "replace");
};

/**
 * Former public authority-flip helper — **refuses**.
 *
 * Intended (binding after S0 escalation KEEP_A): `recordOrderedProofStep`
 * (`g10ProofHarness.ts`) is the **sole** writer of dual-run-exit → manifold
 * authority. Callers must not flip authority/phase here.
 *
 * Observed: always throws; keeps the name so accidental landers fail loud.
 */
export const markDualRunExited = (_model: G10SubstitutionModel, slice: G10FabricSliceId): never => {
  throw new Error(
    `G10 markDualRunExited refused on ${slice}: use recordOrderedProofStep(model, slice, "dual-run-exit") as sole authority flip (S0 escalation proof-step-sole-owner)`,
  );
};

/**
 * Documented non-switch: reading G9 shadow env must not drive cutover.
 *
 * Returns whether the shadow env key is set truthy — for tests asserting
 * independence from cutover APIs only.
 */
export const readG9ShadowEnvIsNotCutover = (
  env: NodeJS.ProcessEnv = process.env,
): {
  readonly shadowEnvKey: typeof G9_SHADOW_PARITY_ENV;
  readonly shadowEnabled: boolean;
  readonly isCutoverSwitch: false;
} => {
  const raw = env[G9_SHADOW_PARITY_ENV];
  const normalized = raw?.trim().toLowerCase();
  const shadowEnabled = normalized === "1" || normalized === "true" || normalized === "yes";
  return {
    shadowEnvKey: G9_SHADOW_PARITY_ENV,
    shadowEnabled,
    isCutoverSwitch: false,
  };
};

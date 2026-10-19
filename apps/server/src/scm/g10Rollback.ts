/**
 * G10 rollback switch contract (S0 foundation).
 *
 * Intended: each S1–S7 exposes a per-slice restore to pre-cutover live path;
 * S8 exposes campaign-wide restore. Rollback restores live authority for
 * cut-over rows. Explicitly **not** unset of `T2CODE_SCM_G9_SHADOW`. Does
 * **not** add a new halt controller (G7 DIP freeze/halt unchanged).
 *
 * Observed at S0: contract + in-memory restore hooks only — no fabric seam
 * edits, no halt controller construction, no shadow-env mutation.
 */
import { G9_SHADOW_PARITY_ENV } from "./g9Bootstrap.ts";
import type { G10CutoverRegistry } from "./g10CutoverRegistry.ts";
import {
  authorityForSlice,
  type G10SubstitutionInstall,
  type G10SubstitutionModel,
} from "./g10Substitution.ts";
import { makeDefaultSliceState, type G10FabricSliceId, type G10SliceId } from "./g10Types.ts";

/** Explicit law: Increment 6 rollback ≠ shadow env-off. */
export const ROLLBACK_IS_NOT_SHADOW_ENV_OFF = true as const;

/** Explicit law: G10 rollback does not introduce a campaign halt controller. */
export const ROLLBACK_ADDS_NO_HALT_CONTROLLER = true as const;

/**
 * Per-slice rollback switch result.
 *
 * Intended: live path restored; install authority back to live; phase returns
 * toward live-authoritative (post-drill "restored" when recording proof, or
 * full restore to "live" on abort). S0 uses restorePreCutoverLive for drills.
 */
export type G10SliceRollbackResult = {
  readonly slice: G10FabricSliceId;
  readonly restoredAuthority: "live";
  readonly clearedShadowEnv: false;
  readonly usedHaltController: false;
  readonly install: G10SubstitutionInstall | undefined;
};

/**
 * Campaign (S8) rollback hook shape — restore all cut-over slices to live.
 */
export type G10CampaignRollbackHook = {
  readonly kind: "campaign-rollback";
  readonly slicesRestored: readonly G10FabricSliceId[];
  readonly restoredAuthority: "live";
  readonly clearedShadowEnv: false;
  readonly usedHaltController: false;
};

/**
 * Options for rollback execution (S0 contract).
 *
 * Agent: never pass unsetShadowEnv:true — API rejects it.
 */
export type G10RollbackOptions = {
  /**
   * Forbidden path: treating shadow env-off as rollback.
   * Must remain false / omitted; true throws.
   */
  readonly unsetShadowEnv?: boolean;
  /** Forbidden: inventing a halt controller for cutover rollback. */
  readonly useHaltController?: boolean;
};

/**
 * Restore pre-cutover live authority for one fabric slice.
 *
 * Parameters
 * ----------
 * model : G10SubstitutionModel
 *     Substitution coordinator (mutated).
 * slice : G10FabricSliceId
 *     Slice to restore.
 * options : G10RollbackOptions
 *     Must not request shadow-off or halt controller.
 *
 * Returns
 * -------
 * G10SliceRollbackResult
 *     Live restored; clearedShadowEnv and usedHaltController always false.
 *
 * Throws
 * ------
 * Error
 *     If options request shadow-off or halt controller.
 */
export const restorePreCutoverLive = (
  model: G10SubstitutionModel,
  slice: G10FabricSliceId,
  options: G10RollbackOptions = {},
): G10SliceRollbackResult => {
  assertRollbackOptions(options);

  const existing = model.installs.get(slice);
  if (existing !== undefined) {
    // Keep replaceInstalled wiring for dual-run re-entry; authority → live.
    const restored: G10SubstitutionInstall = {
      ...existing,
      authority: "live",
    };
    model.installs.set(slice, restored);
  }

  // Authority restore only — Ordered proof "rollback-drill" is recorded by
  // g10ProofHarness.recordOrderedProofStep. Post-exit abort clears proof bookkeeping.
  const state = model.sliceStates.get(slice) ?? makeDefaultSliceState(slice);
  if (state.phase === "exited" || state.phase === "inverted") {
    state.phase = "live";
    state.inversionArmed = false;
    state.completedProofSteps = [];
  }
  model.sliceStates.set(slice, state);

  return {
    slice,
    restoredAuthority: "live",
    clearedShadowEnv: false,
    usedHaltController: false,
    install: model.installs.get(slice),
  };
};

/**
 * Campaign rollback hook: restore every fabric slice that has an install.
 *
 * Intended S8 procedure shape. Does not touch T2CODE_SCM_G9_SHADOW.
 */
export const runCampaignRollback = (
  model: G10SubstitutionModel,
  options: G10RollbackOptions = {},
): G10CampaignRollbackHook => {
  assertRollbackOptions(options);
  const slices: G10FabricSliceId[] = ["S1", "S2", "S3", "S4", "S5", "S6", "S7"];
  const restored: G10FabricSliceId[] = [];
  for (const slice of slices) {
    if (model.installs.has(slice) || authorityForSlice(model, slice) === "manifold") {
      restorePreCutoverLive(model, slice, options);
      restored.push(slice);
    }
  }
  return {
    kind: "campaign-rollback",
    slicesRestored: restored,
    restoredAuthority: "live",
    clearedShadowEnv: false,
    usedHaltController: false,
  };
};

/**
 * Prove rollback does not mutate the G9 shadow env key.
 *
 * Parameters
 * ----------
 * env : NodeJS.ProcessEnv
 *     Env object (tests may pass a plain record).
 * mutate : (env) => void
 *     Rollback-shaped operation under test.
 *
 * Returns
 * -------
 * { before, after, unchanged }
 *     Shadow env value before/after; unchanged must be true for valid rollback.
 */
export const assertRollbackLeavesShadowEnv = (
  env: NodeJS.ProcessEnv,
  mutate: (env: NodeJS.ProcessEnv) => void,
): {
  readonly before: string | undefined;
  readonly after: string | undefined;
  readonly unchanged: boolean;
} => {
  const before = env[G9_SHADOW_PARITY_ENV];
  mutate(env);
  const after = env[G9_SHADOW_PARITY_ENV];
  return { before, after, unchanged: before === after };
};

/**
 * Contract predicate: a rollback result is valid only when it did not clear
 * shadow env and did not use a halt controller.
 */
export const isValidRollbackResult = (
  result: G10SliceRollbackResult | G10CampaignRollbackHook,
): boolean =>
  result.restoredAuthority === "live" &&
  result.clearedShadowEnv === false &&
  result.usedHaltController === false &&
  ROLLBACK_IS_NOT_SHADOW_ENV_OFF &&
  ROLLBACK_ADDS_NO_HALT_CONTROLLER;

/** @internal Refuse forbidden rollback option combinations. */
const assertRollbackOptions = (options: G10RollbackOptions): void => {
  if (options.unsetShadowEnv === true) {
    throw new Error(
      `G10 rollback refused: unsetting ${G9_SHADOW_PARITY_ENV} is not Increment 6 rollback`,
    );
  }
  if (options.useHaltController === true) {
    throw new Error("G10 rollback refused: must not add a halt controller (G7 DIP unchanged)");
  }
};

/**
 * Type-level / docs hook: campaign rollback does not depend on registry resize.
 * Registry is passed so callers keep inventory context without shrink/expand.
 */
export type G10RollbackContext = {
  readonly registry: G10CutoverRegistry;
  readonly model: G10SubstitutionModel;
  readonly campaignSlice: Extract<G10SliceId, "S8">;
};

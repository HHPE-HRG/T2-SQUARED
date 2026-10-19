/**
 * G10 S0 foundation types (Increment 6 cutover/rollback contracts).
 *
 * Intended: freeze slice ids S0–S8, Ordered proof step names, per-slice
 * CutoverPhase machine, and the inversion-armed flag shape. S0 proves
 * contracts only — no fabric admit/route/replace land here.
 *
 * Observed: default CutoverPhase is "live" (today’s live authority).
 * InversionArmed defaults false; arming is gated by Ordered proof exit
 * (see g10Inversion.ts). Does not wire OrchestrationEngine / ws / provider.
 * Does not activate home-bus-link. Does not flip auth flags.
 */

/** Campaign slices: S0 foundation, S1–S7 fabric, S8 campaign close. */
export type G10SliceId = "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8";

/** Fabric cutover slices only (admit/route/replace targets). */
export type G10FabricSliceId = Exclude<G10SliceId, "S0" | "S8">;

/**
 * Ordered proof step names (normative sequence from proof-bar.md).
 *
 * Agent: land → live-rehearsal → ≡ → restore → exit → arm inversion.
 * Do not reorder; do not treat rehearsal as exit or inversion.
 */
export type OrderedProofStep =
  | "land"
  | "live-rehearsal"
  | "cutover-equivalence"
  | "rollback-drill"
  | "dual-run-exit"
  | "arm-inversion";

/** Frozen Ordered proof sequence (index order is mandatory). */
export const ORDERED_PROOF_STEPS: readonly OrderedProofStep[] = [
  "land",
  "live-rehearsal",
  "cutover-equivalence",
  "rollback-drill",
  "dual-run-exit",
  "arm-inversion",
] as const;

/**
 * Per-slice cutover phase machine.
 *
 * Intended mapping to Ordered proof:
 * - live: pre-land (default authority)
 * - landed: admit/route/replace installed; live still authoritative
 * - rehearsed: live-authoritative rehearsal green
 * - equiv: cutover ≡ under G9DeferredEquality green
 * - restored: rollback drill green (pre-cutover live re-proven)
 * - exited: dual-run exit (live path retired; manifold authority)
 * - inverted: noninterference inversion armed (post-exit only)
 */
export type CutoverPhase =
  | "live"
  | "landed"
  | "rehearsed"
  | "equiv"
  | "restored"
  | "exited"
  | "inverted";

/** Phase progression aligned to Ordered proof (no skips). */
export const CUTOVER_PHASE_ORDER: readonly CutoverPhase[] = [
  "live",
  "landed",
  "rehearsed",
  "equiv",
  "restored",
  "exited",
  "inverted",
] as const;

/**
 * Whether noninterference inversion is armed for a slice.
 *
 * Intended: false until Ordered proof records dual-run-exit, then arm.
 * Observed at S0: always false in contract defaults; armInversion refuses.
 */
export type InversionArmed = boolean;

/**
 * Mutable (coordinator-owned) per-slice cutover state record.
 *
 * Agent: S0 ships the shape; S1–S7 landers advance phase via substitution /
 * proof harness / inversion APIs. inversionArmed mirrors phase === "inverted".
 */
export type G10SliceCutoverState = {
  readonly slice: G10SliceId;
  phase: CutoverPhase;
  inversionArmed: InversionArmed;
  /** Ordered proof steps recorded green for this slice (prefix of ORDERED_PROOF_STEPS). */
  completedProofSteps: OrderedProofStep[];
};

/**
 * Create default live-authority state for a slice (S0 contract default).
 *
 * Parameters
 * ----------
 * slice : G10SliceId
 *     Slice to initialize.
 *
 * Returns
 * -------
 * G10SliceCutoverState
 *     phase "live", inversionArmed false, no proof steps completed.
 */
export const makeDefaultSliceState = (slice: G10SliceId): G10SliceCutoverState => ({
  slice,
  phase: "live",
  inversionArmed: false,
  completedProofSteps: [],
});

/**
 * Map an Ordered proof step to the CutoverPhase it unlocks when recorded.
 *
 * Intended: one step advances one phase; arm-inversion ⇒ inverted.
 */
export const phaseAfterProofStep = (step: OrderedProofStep): CutoverPhase => {
  switch (step) {
    case "land":
      return "landed";
    case "live-rehearsal":
      return "rehearsed";
    case "cutover-equivalence":
      return "equiv";
    case "rollback-drill":
      return "restored";
    case "dual-run-exit":
      return "exited";
    case "arm-inversion":
      return "inverted";
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
};

/**
 * Next required Ordered proof step given completed prefix, or undefined if done.
 */
export const nextRequiredProofStep = (
  completed: readonly OrderedProofStep[],
): OrderedProofStep | undefined => ORDERED_PROOF_STEPS[completed.length];

/**
 * True when dual-run-exit has been recorded (inversion gate prerequisite).
 */
export const hasRecordedDualRunExit = (completed: readonly OrderedProofStep[]): boolean =>
  completed.includes("dual-run-exit");

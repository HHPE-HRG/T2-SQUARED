/**
 * G10 noninterference inversion POLICY (S0 foundation — not armed).
 *
 * Intended: on cut-over surfaces, after that slice’s Ordered proof dual-run
 * exit, manifold failure may fail the user-visible operation. Non-cut-over
 * surfaces keep G9 observe-beside noninterference (SCM fail must not fail
 * live). S0 records **policy text only**; inversion is **not** armed.
 *
 * Observed: `armInversion(slice)` delegates solely to
 * `recordOrderedProofStep(..., "arm-inversion")` (S0 escalation KEEP_A —
 * no second writer of completedProofSteps / inversionArmed).
 * Dormant home-bus-link is never armable via this path.
 * Does not wire fabric failure coupling yet.
 */
import { G10_DORMANT_HOME_BUS_COMM_ID, type G10CutoverRegistry } from "./g10CutoverRegistry.ts";
import { recordOrderedProofStep } from "./g10ProofHarness.ts";
import type { G10SubstitutionModel } from "./g10Substitution.ts";
import { type G10FabricSliceId, type G10SliceId, type InversionArmed } from "./g10Types.ts";

/**
 * Frozen policy statement for evidence / agents (S0 gate).
 *
 * Agent: policy ≠ armed. Do not treat this constant as runtime inversion.
 */
export const G10_INVERSION_POLICY = {
  schemaVersion: 1 as const,
  armedAtS0: false as const,
  summary:
    "After a slice’s Ordered proof dual-run exit, manifold failure may fail the user-visible operation for that slice’s cut-over rows. Before exit (incl. live rehearsal), live remains authoritative and G9 observe-beside noninterference holds for non-cut-over / pre-exit surfaces. Dormant INV-T2-SCM-HOME-BUS-LINK is exempt.",
  requiresOrderedProofExit: true as const,
  dormantExemptCommId: G10_DORMANT_HOME_BUS_COMM_ID,
} as const;

export type G10InversionPolicy = typeof G10_INVERSION_POLICY;

/**
 * Read whether inversion is armed for a slice (defaults false).
 */
export const isInversionArmed = (model: G10SubstitutionModel, slice: G10SliceId): InversionArmed =>
  model.sliceStates.get(slice)?.inversionArmed === true;

/**
 * Arm noninterference inversion for a fabric slice.
 *
 * Intended: sole path is Ordered proof step `arm-inversion` via
 * `recordOrderedProofStep`. This wrapper does not mutate proof ledger itself.
 *
 * Throws
 * ------
 * Error
 *     When Ordered proof gate refuses (e.g. dual-run-exit not recorded).
 */
export const armInversion = (
  model: G10SubstitutionModel,
  slice: G10FabricSliceId,
  _registry?: G10CutoverRegistry,
): { readonly slice: G10FabricSliceId; readonly inversionArmed: true } => {
  recordOrderedProofStep(model, slice, "arm-inversion");
  return { slice, inversionArmed: true };
};

/**
 * S0 helper: assert inversion policy exists and is not armed campaign-wide.
 */
export const assertInversionPolicyNotArmedAtS0 = (model: G10SubstitutionModel): void => {
  if (G10_INVERSION_POLICY.armedAtS0 !== false) {
    throw new Error("G10 S0 invariant broken: inversion policy marked armedAtS0");
  }
  for (const slice of ["S0", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"] as const) {
    if (isInversionArmed(model, slice)) {
      throw new Error(`G10 S0 invariant broken: inversion armed on ${slice}`);
    }
  }
};

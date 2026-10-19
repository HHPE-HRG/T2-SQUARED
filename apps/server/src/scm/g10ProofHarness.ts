/**
 * G10 proof harness shape (S0 foundation).
 *
 * Intended: normative Ordered proof step recording for cutover ≡, rollback
 * drill, and live-authoritative rehearsal. Cutover equivalence reuses
 * `G9DeferredEquality` labels from G9 (type-only / design-name reuse via
 * G9EqualityA projections). Explicitly forbids WP8 763-fixture-as-G10-proof.
 *
 * Observed at S0: step gate + forbid helpers only — no fabric proof bodies,
 * no 763 runner import. WORK-000035 losslessness stays deferred.
 */
import type { G9EqualityA } from "./g9Occurrence.ts";
import type { G10SubstitutionModel } from "./g10Substitution.ts";
import {
  ORDERED_PROOF_STEPS,
  hasRecordedDualRunExit,
  nextRequiredProofStep,
  phaseAfterProofStep,
  type G10FabricSliceId,
  type G10SliceId,
  type OrderedProofStep,
} from "./g10Types.ts";

/**
 * Design-name alias: G10 cutover ≡ reuses G9 deferred equality projections.
 *
 * Agent: there is no separate runtime `G9DeferredEquality` class in-tree;
 * ledger A projections (`G9EqualityA`) are the concrete equality carrier.
 * Type-name substitution alone is not cutover proof (proof-bar.md).
 */
export type G9DeferredEquality<A = G9EqualityA> = {
  readonly schemaVersion: 1;
  readonly kind: "G9DeferredEquality";
  readonly projection: A;
};

/** Forbidden: closing G10 via WP8 763 shadow marathon alone. */
export const FORBIDDEN_763_AS_G10_PROOF = "wp8-763-shadow-fixtures-alone" as const;

/** Evidence artifact name stems frozen in proof-bar.md (definition). */
export const G10_PROOF_EVIDENCE_NAMES = {
  liveRehearsal: (n: number) => `S${n}-live-rehearsal.md`,
  cutoverEquivalence: (n: number) => `S${n}-cutover-equivalence.md`,
  rollbackDrill: (n: number) => `S${n}-rollback-drill.md`,
  dualRunExit: (n: number) => `S${n}-dual-run-exit.md`,
  noninterferenceInversion: (n: number) => `S${n}-noninterference-inversion.md`,
  s0Contracts: "S0-contracts.md",
} as const;

/**
 * Proof harness for one slice: Ordered step gate + ≡ carrier reference.
 */
export type G10ProofHarness = {
  readonly slice: G10SliceId;
  readonly orderedSteps: readonly OrderedProofStep[];
  readonly equalityReuse: "G9DeferredEquality";
  readonly forbids763AsProof: true;
};

/**
 * Create the normative harness shape for a slice (S0 contracts).
 */
export const createProofHarness = (slice: G10SliceId): G10ProofHarness => ({
  slice,
  orderedSteps: ORDERED_PROOF_STEPS,
  equalityReuse: "G9DeferredEquality",
  forbids763AsProof: true,
});

/**
 * Refuse treating WP8 763 fixtures as G10 slice/campaign proof.
 *
 * Parameters
 * ----------
 * claim : string
 *     Proof claim identifier under evaluation.
 *
 * Throws
 * ------
 * Error
 *     When claim is the forbidden 763-alone token (or contains it).
 */
export const refuse763AsProof = (claim: string): void => {
  if (
    claim === FORBIDDEN_763_AS_G10_PROOF ||
    (claim.includes("763") && claim.toLowerCase().includes("proof"))
  ) {
    throw new Error(
      `G10 proof refused: ${FORBIDDEN_763_AS_G10_PROOF} never closes a G10 slice or campaign`,
    );
  }
};

/**
 * Wrap a G9 equality A projection as G9DeferredEquality (type-level reuse).
 *
 * Intended: cutover ≡ packages cite this carrier; not type-name-only close.
 */
export const asG9DeferredEquality = <A extends G9EqualityA>(
  projection: A,
): G9DeferredEquality<A> => ({
  schemaVersion: 1,
  kind: "G9DeferredEquality",
  projection,
});

/**
 * Record the next Ordered proof step for a fabric slice (strict prefix gate).
 *
 * Parameters
 * ----------
 * model : G10SubstitutionModel
 *     Slice state owner.
 * slice : G10FabricSliceId
 *     Fabric slice under proof.
 * step : OrderedProofStep
 *     Must equal nextRequiredProofStep(completed).
 *
 * Returns
 * -------
 * OrderedProofStep[]
 *     Updated completed steps.
 *
 * Throws
 * ------
 * Error
 *     Out-of-order step, or 763 claim smuggled as step name.
 */
export const recordOrderedProofStep = (
  model: G10SubstitutionModel,
  slice: G10FabricSliceId,
  step: OrderedProofStep,
): OrderedProofStep[] => {
  refuse763AsProof(step);
  const state = model.sliceStates.get(slice);
  if (state === undefined) {
    throw new Error(`G10 proof harness: missing slice state for ${slice}`);
  }
  const expected = nextRequiredProofStep(state.completedProofSteps);
  if (expected !== step) {
    throw new Error(
      `G10 Ordered proof gate: ${slice} expected next step ${expected ?? "<done>"}, got ${step} (completed=[${state.completedProofSteps.join(",")}])`,
    );
  }
  // land / dual-run-exit require replace install (substitution gate).
  if (step === "land" || step === "dual-run-exit") {
    const install = model.installs.get(slice);
    if (!install?.replaceInstalled) {
      throw new Error(`G10 Ordered proof: ${slice} ${step} requires replace install`);
    }
  }
  // Prefix gate already requires dual-run-exit before arm-inversion.
  if (step === "arm-inversion" && !hasRecordedDualRunExit(state.completedProofSteps)) {
    throw new Error(`G10 Ordered proof: ${slice} arm-inversion requires dual-run-exit first`);
  }

  state.completedProofSteps = [...state.completedProofSteps, step];
  state.phase = phaseAfterProofStep(step);
  if (step === "arm-inversion") {
    state.inversionArmed = true;
  }
  if (step === "dual-run-exit") {
    const install = model.installs.get(slice);
    if (install !== undefined) {
      model.installs.set(slice, { ...install, authority: "manifold" });
    }
  }
  return state.completedProofSteps;
};

/**
 * Predicate: Ordered proof gate is satisfied through `throughStep` inclusive.
 */
export const orderedProofSatisfiedThrough = (
  model: G10SubstitutionModel,
  slice: G10SliceId,
  throughStep: OrderedProofStep,
): boolean => {
  const completed = model.sliceStates.get(slice)?.completedProofSteps ?? [];
  const idx = ORDERED_PROOF_STEPS.indexOf(throughStep);
  if (idx < 0) return false;
  for (let i = 0; i <= idx; i++) {
    if (completed[i] !== ORDERED_PROOF_STEPS[i]) return false;
  }
  return true;
};

/**
 * S0 gate evidence checklist names (proof-bar.md S0 gate).
 */
export const S0_CONTRACT_EVIDENCE_SECTIONS = [
  "substitution-model",
  "rollback-switch-contract",
  "proof-harness-shape",
  "inversion-policy-not-armed",
] as const;

export type S0ContractEvidenceSection = (typeof S0_CONTRACT_EVIDENCE_SECTIONS)[number];

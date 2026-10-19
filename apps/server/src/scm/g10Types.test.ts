/**
 * G10 S0 type contract tests.
 *
 * Intended: default live; Ordered proof step order frozen.
 * Observed: assertions below. No fabric wiring.
 */
import { assert, describe, it } from "@effect/vitest";

import {
  CUTOVER_PHASE_ORDER,
  ORDERED_PROOF_STEPS,
  hasRecordedDualRunExit,
  makeDefaultSliceState,
  nextRequiredProofStep,
  phaseAfterProofStep,
} from "./g10Types.ts";

describe("G10 S0 types", () => {
  it("default slice state is live with inversion disarmed", () => {
    const state = makeDefaultSliceState("S1");
    assert.equal(state.phase, "live");
    assert.equal(state.inversionArmed, false);
    assert.deepEqual(state.completedProofSteps, []);
  });

  it("Ordered proof steps are land → rehearsal → ≡ → restore → exit → arm", () => {
    assert.deepEqual(
      [...ORDERED_PROOF_STEPS],
      [
        "land",
        "live-rehearsal",
        "cutover-equivalence",
        "rollback-drill",
        "dual-run-exit",
        "arm-inversion",
      ],
    );
    assert.equal(nextRequiredProofStep([]), "land");
    assert.equal(nextRequiredProofStep(["land", "live-rehearsal"]), "cutover-equivalence");
    assert.equal(phaseAfterProofStep("dual-run-exit"), "exited");
    assert.equal(hasRecordedDualRunExit(["dual-run-exit"]), true);
    assert.equal(CUTOVER_PHASE_ORDER[0], "live");
  });
});

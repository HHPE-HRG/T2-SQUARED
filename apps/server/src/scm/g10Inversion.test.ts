/**
 * G10 inversion policy tests (S0).
 *
 * Intended: inversion policy not armed at S0; armInversion refuses pre-exit.
 * Observed: assertions below.
 */
import { assert, describe, it } from "@effect/vitest";

import { loadG10CutoverRegistry, resolveG10RepoRoot } from "./g10CutoverRegistry.ts";
import {
  G10_INVERSION_POLICY,
  armInversion,
  assertInversionPolicyNotArmedAtS0,
  isInversionArmed,
} from "./g10Inversion.ts";
import { recordOrderedProofStep } from "./g10ProofHarness.ts";
import { restorePreCutoverLive } from "./g10Rollback.ts";
import { createSubstitutionModel, installAdmitRouteReplace } from "./g10Substitution.ts";

const repoRoot = resolveG10RepoRoot();

describe("G10 inversion policy", () => {
  it("policy exists and is not armed at S0", () => {
    assert.equal(G10_INVERSION_POLICY.armedAtS0, false);
    assert.equal(G10_INVERSION_POLICY.requiresOrderedProofExit, true);
    const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
    assertInversionPolicyNotArmedAtS0(model);
    assert.equal(isInversionArmed(model, "S1"), false);
  });

  it("armInversion refuses until Ordered proof dual-run-exit", () => {
    const registry = loadG10CutoverRegistry(repoRoot);
    const model = createSubstitutionModel(registry);
    // Sole path is recordOrderedProofStep("arm-inversion"); gate message names expected next step.
    assert.throws(() => armInversion(model, "S5", registry), /expected next step land/);

    installAdmitRouteReplace(model, "S5");
    recordOrderedProofStep(model, "S5", "land");
    recordOrderedProofStep(model, "S5", "live-rehearsal");
    recordOrderedProofStep(model, "S5", "cutover-equivalence");
    restorePreCutoverLive(model, "S5");
    recordOrderedProofStep(model, "S5", "rollback-drill");
    // Still pre-exit — gate expects dual-run-exit before arm-inversion.
    assert.throws(() => armInversion(model, "S5", registry), /expected next step dual-run-exit/);

    recordOrderedProofStep(model, "S5", "dual-run-exit");
    const armed = armInversion(model, "S5", registry);
    assert.equal(armed.inversionArmed, true);
    assert.equal(isInversionArmed(model, "S5"), true);
  });

  it("armInversion is sole-delegate of recordOrderedProofStep arm-inversion", () => {
    const registry = loadG10CutoverRegistry(repoRoot);
    const model = createSubstitutionModel(registry);
    installAdmitRouteReplace(model, "S4");
    for (const step of [
      "land",
      "live-rehearsal",
      "cutover-equivalence",
      "rollback-drill",
      "dual-run-exit",
    ] as const) {
      if (step === "rollback-drill") restorePreCutoverLive(model, "S4");
      recordOrderedProofStep(model, "S4", step);
    }
    armInversion(model, "S4", registry);
    const steps = model.sliceStates.get("S4")?.completedProofSteps ?? [];
    assert.deepEqual(
      steps.filter((s) => s === "arm-inversion"),
      ["arm-inversion"],
    );
    assert.throws(() => armInversion(model, "S4", registry), /expected next step/);
  });
});

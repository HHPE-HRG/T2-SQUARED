/**
 * G10 proof harness tests (S0).
 *
 * Intended: Ordered proof step gate; forbids 763-as-proof; G9DeferredEquality reuse.
 * Observed: assertions below.
 */
import { assert, describe, it } from "@effect/vitest";

import { loadG10CutoverRegistry, resolveG10RepoRoot } from "./g10CutoverRegistry.ts";
import {
  FORBIDDEN_763_AS_G10_PROOF,
  S0_CONTRACT_EVIDENCE_SECTIONS,
  asG9DeferredEquality,
  createProofHarness,
  orderedProofSatisfiedThrough,
  recordOrderedProofStep,
  refuse763AsProof,
} from "./g10ProofHarness.ts";
import { restorePreCutoverLive } from "./g10Rollback.ts";
import { createSubstitutionModel, installAdmitRouteReplace } from "./g10Substitution.ts";

const repoRoot = resolveG10RepoRoot();

describe("G10 proof harness", () => {
  it("forbids 763-as-proof and names G9DeferredEquality reuse", () => {
    const harness = createProofHarness("S1");
    assert.equal(harness.equalityReuse, "G9DeferredEquality");
    assert.equal(harness.forbids763AsProof, true);
    assert.throws(() => refuse763AsProof(FORBIDDEN_763_AS_G10_PROOF), /763/);
    assert.throws(() => refuse763AsProof("close-via-763-proof"), /763/);
    refuse763AsProof("cutover-equivalence-under-G9DeferredEquality");

    const deferred = asG9DeferredEquality({ command_type: "client" });
    assert.equal(deferred.kind, "G9DeferredEquality");
    assert.equal(deferred.schemaVersion, 1);
    assert.deepEqual(
      [...S0_CONTRACT_EVIDENCE_SECTIONS],
      [
        "substitution-model",
        "rollback-switch-contract",
        "proof-harness-shape",
        "inversion-policy-not-armed",
      ],
    );
  });

  it("Ordered proof step gate refuses out-of-order and requires land install", () => {
    const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
    assert.throws(() => recordOrderedProofStep(model, "S1", "land"), /requires replace install/);
    installAdmitRouteReplace(model, "S1");
    assert.throws(
      () => recordOrderedProofStep(model, "S1", "live-rehearsal"),
      /expected next step land/,
    );

    recordOrderedProofStep(model, "S1", "land");
    recordOrderedProofStep(model, "S1", "live-rehearsal");
    recordOrderedProofStep(model, "S1", "cutover-equivalence");
    // Rollback drill: restore live then record step.
    restorePreCutoverLive(model, "S1");
    recordOrderedProofStep(model, "S1", "rollback-drill");
    recordOrderedProofStep(model, "S1", "dual-run-exit");
    assert.equal(model.installs.get("S1")?.authority, "manifold");
    assert.equal(orderedProofSatisfiedThrough(model, "S1", "dual-run-exit"), true);
    recordOrderedProofStep(model, "S1", "arm-inversion");
    assert.equal(model.sliceStates.get("S1")?.inversionArmed, true);
    assert.equal(model.sliceStates.get("S1")?.phase, "inverted");
  });
});

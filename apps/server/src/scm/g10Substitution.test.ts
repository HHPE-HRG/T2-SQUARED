/**
 * G10 substitution model tests (S0).
 *
 * Intended: default remains live; G9 shadow env is not the cutover switch;
 * admit/route/replace installs without flipping authority until exit.
 * Observed: assertions below. No fabric seam edits.
 */
import { assert, describe, it } from "@effect/vitest";

import { G9_SHADOW_PARITY_ENV } from "./g9Bootstrap.ts";
import { loadG10CutoverRegistry, resolveG10RepoRoot } from "./g10CutoverRegistry.ts";
import {
  G9_SHADOW_IS_NOT_CUTOVER_SWITCH,
  advanceSubstitutionStage,
  authorityForSlice,
  createSubstitutionModel,
  installAdmitRouteReplace,
  markDualRunExited,
  phaseForSlice,
  readG9ShadowEnvIsNotCutover,
} from "./g10Substitution.ts";
import { recordOrderedProofStep } from "./g10ProofHarness.ts";
import { restorePreCutoverLive } from "./g10Rollback.ts";

const repoRoot = resolveG10RepoRoot();

describe("G10 substitution model", () => {
  it("default remains today’s live until exit", () => {
    const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
    assert.equal(authorityForSlice(model, "S1"), "live");
    assert.equal(phaseForSlice(model, "S1"), "live");
    assert.equal(authorityForSlice(model, "S0"), "live");

    const install = installAdmitRouteReplace(model, "S1");
    assert.equal(install.replaceInstalled, true);
    assert.equal(install.authority, "live");
    assert.equal(authorityForSlice(model, "S1"), "live");
    assert.equal(phaseForSlice(model, "S1"), "landed");
    assert.ok(install.commIds.length === 7);
  });

  it("G9 shadow env is not the cutover switch", () => {
    assert.equal(G9_SHADOW_IS_NOT_CUTOVER_SWITCH, true);
    const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
    const withShadow = readG9ShadowEnvIsNotCutover({ [G9_SHADOW_PARITY_ENV]: "1" });
    assert.equal(withShadow.shadowEnabled, true);
    assert.equal(withShadow.isCutoverSwitch, false);
    // Shadow on does not install cutover.
    assert.equal(model.installs.size, 0);
    assert.equal(authorityForSlice(model, "S4"), "live");
  });

  it("admit/route/replace must proceed in order", () => {
    const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
    assert.throws(() => advanceSubstitutionStage(model, "S2", "route"), /out of order/);
    advanceSubstitutionStage(model, "S2", "admit");
    advanceSubstitutionStage(model, "S2", "route");
    const replaced = advanceSubstitutionStage(model, "S2", "replace");
    assert.equal(replaced.stagesCompleted.length, 3);
    assert.throws(() => advanceSubstitutionStage(model, "S2", "admit"), /out of order/);
  });

  it("markDualRunExited refuses; sole flip is recordOrderedProofStep dual-run-exit", () => {
    const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
    installAdmitRouteReplace(model, "S3");
    assert.throws(() => markDualRunExited(model, "S3"), /recordOrderedProofStep/);
    for (const step of [
      "land",
      "live-rehearsal",
      "cutover-equivalence",
      "rollback-drill",
    ] as const) {
      if (step === "rollback-drill") restorePreCutoverLive(model, "S3");
      recordOrderedProofStep(model, "S3", step);
    }
    assert.throws(() => markDualRunExited(model, "S3"), /recordOrderedProofStep/);
    recordOrderedProofStep(model, "S3", "dual-run-exit");
    assert.equal(authorityForSlice(model, "S3"), "manifold");
    assert.equal(phaseForSlice(model, "S3"), "exited");
  });
});

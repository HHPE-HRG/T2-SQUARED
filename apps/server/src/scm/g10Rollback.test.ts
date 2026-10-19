/**
 * G10 rollback switch contract tests (S0).
 *
 * Intended: rollback restores live; rollback ≠ unset T2CODE_SCM_G9_SHADOW;
 * no halt controller option.
 * Observed: assertions below.
 */
import { assert, describe, it } from "@effect/vitest";

import { G9_SHADOW_PARITY_ENV } from "./g9Bootstrap.ts";
import { loadG10CutoverRegistry, resolveG10RepoRoot } from "./g10CutoverRegistry.ts";
import {
  ROLLBACK_ADDS_NO_HALT_CONTROLLER,
  ROLLBACK_IS_NOT_SHADOW_ENV_OFF,
  assertRollbackLeavesShadowEnv,
  isValidRollbackResult,
  restorePreCutoverLive,
  runCampaignRollback,
} from "./g10Rollback.ts";
import { createSubstitutionModel, installAdmitRouteReplace } from "./g10Substitution.ts";

const repoRoot = resolveG10RepoRoot();

describe("G10 rollback switch", () => {
  it("rollback restores live and is not shadow-off", () => {
    assert.equal(ROLLBACK_IS_NOT_SHADOW_ENV_OFF, true);
    assert.equal(ROLLBACK_ADDS_NO_HALT_CONTROLLER, true);

    const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
    installAdmitRouteReplace(model, "S3");
    // Simulate post-exit manifold authority then restore.
    const install = model.installs.get("S3")!;
    model.installs.set("S3", { ...install, authority: "manifold" });
    const state = model.sliceStates.get("S3")!;
    state.phase = "exited";
    state.completedProofSteps = [
      "land",
      "live-rehearsal",
      "cutover-equivalence",
      "rollback-drill",
      "dual-run-exit",
    ];

    const env: NodeJS.ProcessEnv = { [G9_SHADOW_PARITY_ENV]: "1" };
    const shadowCheck = assertRollbackLeavesShadowEnv(env, () => {
      const result = restorePreCutoverLive(model, "S3");
      assert.equal(isValidRollbackResult(result), true);
      assert.equal(result.restoredAuthority, "live");
      assert.equal(result.clearedShadowEnv, false);
      assert.equal(result.usedHaltController, false);
      assert.equal(model.installs.get("S3")?.authority, "live");
    });
    assert.equal(shadowCheck.unchanged, true);
    assert.equal(shadowCheck.after, "1");
  });

  it("refuses unsetShadowEnv and useHaltController options", () => {
    const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
    installAdmitRouteReplace(model, "S1");
    assert.throws(
      () => restorePreCutoverLive(model, "S1", { unsetShadowEnv: true }),
      /not Increment 6 rollback/,
    );
    assert.throws(
      () => restorePreCutoverLive(model, "S1", { useHaltController: true }),
      /halt controller/,
    );
  });

  it("campaign rollback hook restores fabric installs without clearing shadow", () => {
    const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
    installAdmitRouteReplace(model, "S1");
    installAdmitRouteReplace(model, "S2");
    const env: NodeJS.ProcessEnv = { [G9_SHADOW_PARITY_ENV]: "true" };
    const check = assertRollbackLeavesShadowEnv(env, () => {
      const campaign = runCampaignRollback(model);
      assert.equal(campaign.kind, "campaign-rollback");
      assert.equal(campaign.clearedShadowEnv, false);
      assert.equal(isValidRollbackResult(campaign), true);
      assert.ok(campaign.slicesRestored.includes("S1"));
      assert.ok(campaign.slicesRestored.includes("S2"));
    });
    assert.equal(check.unchanged, true);
  });
});

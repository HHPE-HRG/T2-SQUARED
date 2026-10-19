/**
 * G10 seam bridge tests (S1).
 *
 * Intended: not-replaced → live only; dual-run → live + observe isolate;
 * post-exit manifold authority; inversion fails user op; pre-inversion soft
 * live fallback; illegal inversion-while-live dies.
 * Observed: assertions below. No Engine suite edits.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { loadG10CutoverRegistry, resolveG10RepoRoot } from "./g10CutoverRegistry.ts";
import { armInversion } from "./g10Inversion.ts";
import { recordOrderedProofStep } from "./g10ProofHarness.ts";
import { restorePreCutoverLive } from "./g10Rollback.ts";
import { bridgeUsesLiveAuthority, runG10SeamBridge } from "./g10SeamBridge.ts";
import {
  createSubstitutionModel,
  installAdmitRouteReplace,
  markDualRunExited,
} from "./g10Substitution.ts";

const repoRoot = resolveG10RepoRoot();

const advanceToExit = () => {
  const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
  installAdmitRouteReplace(model, "S1");
  recordOrderedProofStep(model, "S1", "land");
  recordOrderedProofStep(model, "S1", "live-rehearsal");
  recordOrderedProofStep(model, "S1", "cutover-equivalence");
  restorePreCutoverLive(model, "S1");
  recordOrderedProofStep(model, "S1", "rollback-drill");
  recordOrderedProofStep(model, "S1", "dual-run-exit");
  return model;
};

describe("G10 seam bridge", () => {
  it("not replaced: liveEffect only (manifold never runs)", () => {
    const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
    let liveRuns = 0;
    let manifoldRuns = 0;
    const result = Effect.runSync(
      runG10SeamBridge({
        model,
        slice: "S1",
        commId: "INV-T2-ORCH-EVENTS",
        liveEffect: Effect.sync(() => {
          liveRuns += 1;
          return "live";
        }),
        manifoldEffect: Effect.sync(() => {
          manifoldRuns += 1;
          return "manifold";
        }),
      }),
    );
    assert.equal(result, "live");
    assert.equal(liveRuns, 1);
    assert.equal(manifoldRuns, 0);
    assert.equal(bridgeUsesLiveAuthority(model, "S1"), true);
  });

  it("replaced + live authority: live wins; observe Die does not fail live", () => {
    const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
    installAdmitRouteReplace(model, "S1");
    const result = Effect.runSync(
      runG10SeamBridge({
        model,
        slice: "S1",
        commId: "INV-T2-ORCH-QUEUE",
        liveEffect: Effect.succeed("live-ok"),
        manifoldEffect: Effect.succeed("manifold-authority"),
        // Bridge isolates via Effect.exit — Die must not surface to caller.
        manifoldObserveEffect: Effect.die("observe-die"),
      }),
    );
    assert.equal(result, "live-ok");
    assert.equal(bridgeUsesLiveAuthority(model, "S1"), true);
  });

  it("observe-beside runs when dual-run (isolated by bridge)", () => {
    const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
    installAdmitRouteReplace(model, "S1");
    let observeCount = 0;
    const result = Effect.runSync(
      runG10SeamBridge({
        model,
        slice: "S1",
        commId: "INV-T2-ORCH-EVENTS",
        liveEffect: Effect.succeed(1),
        manifoldEffect: Effect.succeed(99),
        manifoldObserveEffect: Effect.sync(() => {
          observeCount += 1;
        }),
      }),
    );
    assert.equal(result, 1);
    assert.equal(observeCount, 1);
  });

  it("post dual-run-exit: manifold authority; markDualRunExited still refuses", () => {
    const model = advanceToExit();
    assert.throws(() => markDualRunExited(model, "S1"), /recordOrderedProofStep/);
    assert.equal(bridgeUsesLiveAuthority(model, "S1"), false);
    const result = Effect.runSync(
      runG10SeamBridge({
        model,
        slice: "S1",
        commId: "INV-T2-ORCH-EVENTS",
        liveEffect: Effect.succeed("live"),
        manifoldEffect: Effect.succeed("manifold"),
      }),
    );
    assert.equal(result, "manifold");
  });

  it("post-exit !inverted: manifold fail soft-falls back to live", () => {
    const model = advanceToExit();
    const result = Effect.runSync(
      runG10SeamBridge({
        model,
        slice: "S1",
        commId: "INV-T2-ORCH-QUEUE",
        liveEffect: Effect.succeed("soft-live"),
        manifoldEffect: Effect.fail("manifold-fail"),
      }),
    );
    assert.equal(result, "soft-live");
  });

  it("post-exit inverted: manifold fail fails the user op", () => {
    const model = advanceToExit();
    armInversion(model, "S1");
    const exit = Effect.runSync(
      Effect.exit(
        runG10SeamBridge({
          model,
          slice: "S1",
          commId: "INV-T2-ORCH-QUEUE",
          liveEffect: Effect.succeed("live"),
          manifoldEffect: Effect.fail("manifold-fail"),
        }),
      ),
    );
    assert.equal(Exit.isFailure(exit), true);
  });

  it("inversion armed while live authority dies (N/A pre-exit)", () => {
    const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
    installAdmitRouteReplace(model, "S1");
    // Force illegal state: arm flag without exit (bypass Ordered gate).
    const state = model.sliceStates.get("S1");
    if (state) {
      state.inversionArmed = true;
    }
    const exit = Effect.runSync(
      Effect.exit(
        runG10SeamBridge({
          model,
          slice: "S1",
          commId: "INV-T2-ORCH-EVENTS",
          liveEffect: Effect.succeed("live"),
          manifoldEffect: Effect.succeed("manifold"),
        }),
      ),
    );
    assert.equal(Exit.isFailure(exit), true);
  });
});

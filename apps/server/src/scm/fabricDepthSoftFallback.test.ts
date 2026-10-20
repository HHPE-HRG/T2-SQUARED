/**
 * Fabric-depth FD0 soft-fallback signal / retire / rollback re-emit tests.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { join } from "node:path";

import { FABRIC_DEPTH_ENV } from "./fabricDepthBootstrap.ts";
import {
  formatSoftFallbackSignal,
  recordSoftFallbackRetire,
  setSoftFallbackSignalSink,
  softFallbackForSlice,
} from "./fabricDepthSoftFallback.ts";
import { loadG10CutoverRegistry, resolveG10RepoRoot } from "./g10CutoverRegistry.ts";
import { armInversion } from "./g10Inversion.ts";
import { recordOrderedProofStep } from "./g10ProofHarness.ts";
import { restorePreCutoverLive } from "./g10Rollback.ts";
import { runG10SeamBridge } from "./g10SeamBridge.ts";
import { createSubstitutionModel, installAdmitRouteReplace } from "./g10Substitution.ts";

const repoRoot = resolveG10RepoRoot();
const censusPath = join(repoRoot, "docs/scm/fabric-depth/evidence/manifold-io-census.json");

const withFdEnv = <A>(fn: () => A): A => {
  const prev = process.env[FABRIC_DEPTH_ENV];
  process.env[FABRIC_DEPTH_ENV] = "1";
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[FABRIC_DEPTH_ENV];
    else process.env[FABRIC_DEPTH_ENV] = prev;
  }
};

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

describe("Fabric-depth FD0 soft-fallback", () => {
  it("formats operator signal line", () => {
    assert.equal(formatSoftFallbackSignal("S3", "active"), "g10.softFallback=active slice=S3");
    assert.equal(formatSoftFallbackSignal("S3", "retired"), "g10.softFallback=retired slice=S3");
  });

  it("dual-run-exit under FD emits active whether or not inverted later", () => {
    withFdEnv(() => {
      const lines: string[] = [];
      setSoftFallbackSignalSink((line) => lines.push(line));
      try {
        const model = advanceToExit();
        assert.equal(softFallbackForSlice(model, "S1"), "active");
        assert.ok(lines.some((l) => l.includes("active") && l.includes("S1")));
        armInversion(model, "S1");
        assert.equal(softFallbackForSlice(model, "S1"), "active");
      } finally {
        setSoftFallbackSignalSink(undefined);
      }
    });
  });

  it("retired soft-fallback: manifold fail does not soft-fall to live", () => {
    withFdEnv(() => {
      const model = advanceToExit();
      armInversion(model, "S1");
      // S1 sole-lander debt is handoff-only SETTINGS — census gate allows.
      recordSoftFallbackRetire(model, "S1", censusPath);
      assert.equal(softFallbackForSlice(model, "S1"), "retired");
      const exit = Effect.runSync(
        Effect.exit(
          runG10SeamBridge({
            model,
            slice: "S1",
            commId: "INV-T2-ORCH-QUEUE",
            liveEffect: Effect.succeed("soft-live"),
            manifoldEffect: Effect.fail("manifold-fail"),
          }),
        ),
      );
      assert.equal(Exit.isFailure(exit), true);
    });
  });

  it("rollback re-emits active after retire", () => {
    withFdEnv(() => {
      const lines: string[] = [];
      setSoftFallbackSignalSink((line) => lines.push(line));
      try {
        const model = advanceToExit();
        armInversion(model, "S1");
        recordSoftFallbackRetire(model, "S1", censusPath);
        lines.length = 0;
        restorePreCutoverLive(model, "S1");
        assert.equal(softFallbackForSlice(model, "S1"), "active");
        assert.ok(lines.some((l) => l === "g10.softFallback=active slice=S1"));
      } finally {
        setSoftFallbackSignalSink(undefined);
      }
    });
  });

  it("retire refuses without arm-inversion", () => {
    withFdEnv(() => {
      const model = advanceToExit();
      assert.throws(() => recordSoftFallbackRetire(model, "S1", censusPath), /arm-inversion/);
    });
  });

  it("retire refuses when FD env off", () => {
    const model = advanceToExit();
    armInversion(model, "S1");
    assert.throws(
      () => recordSoftFallbackRetire(model, "S1", censusPath, {}),
      /T2CODE_SCM_FABRIC_DEPTH/,
    );
  });
});

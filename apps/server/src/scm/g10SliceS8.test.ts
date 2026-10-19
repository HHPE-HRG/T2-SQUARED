/**
 * G10 S8 campaign-close tests (dual-run exit audit + campaign rollback +
 * aggregate ≡ under G9DeferredEquality).
 *
 * Intended: frozen 73 activatable + 1 dormant; lander-reopen wires counted;
 * phase residuals operator-accepted; campaign rollback restores all fabric
 * installs without clearing shadow env; refuse763AsProof; radius unchanged.
 * Does not start a new fabric Ordered proof. No commit.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { G9_SHADOW_PARITY_ENV } from "./g9Bootstrap.ts";
import { G10_DORMANT_HOME_BUS_COMM_ID, resolveG10RepoRoot } from "./g10CutoverRegistry.ts";
import { refuse763AsProof } from "./g10ProofHarness.ts";
import { assertRollbackLeavesShadowEnv } from "./g10Rollback.ts";
import { authorityForSlice } from "./g10Substitution.ts";
import {
  G10_S2_FLAG_T3_OTEL_HANDOFF_LANDED_FROM_S6,
  createG10S2Controller,
  installProcessGlobalG10S2,
  resolveFlagT3OtelViaG10Bridge,
} from "./g10SliceS2.ts";
import {
  G10_S3_FILE_CHECKPOINTS_HANDOFF_FROM_S7,
  G10_S3_FLAG_CLOUDFLARED_HANDOFF_FROM_S7,
} from "./g10SliceS3.ts";
import { G10_S4_FLAG_CODEX_LAUNCH_HANDOFF_FROM_S7 } from "./g10SliceS4.ts";
import { G10_S5_FLAG_TERM_ENV_HANDOFF_FROM_S7 } from "./g10SliceS5.ts";
import {
  G10_S8_ACTIVATABLE_RADIUS_COUNT,
  G10_S8_AGGREGATE_EQUIV_SEED_PAIRS,
  G10_S8_DORMANT_EXEMPT_COUNT,
  G10_S8_LANDER_REOPEN_WIRED,
  G10_S8_PHASE_RESIDUALS_OPERATOR_ACCEPT,
  G10_S8_PRIOR_LANDER_EXITED,
  aggregateCutoverEquivalence,
  buildDualRunExitAudit,
  createG10S8SubstitutionModel,
  formatCampaignCutoverEquivalenceMarkdown,
  formatCampaignRollbackDrillMarkdown,
  formatDualRunExitAuditMarkdown,
  installAllFabricSlices,
  runCampaignRollbackDrill,
  runS8CampaignCloseProof,
} from "./g10SliceS8.ts";

const repoRoot = resolveG10RepoRoot();

describe("G10 S8 campaign close", () => {
  it("audit lists 73 activatable + 1 dormant with partition covering radius", () => {
    const audit = buildDualRunExitAudit();
    assert.equal(audit.activatableCount, G10_S8_ACTIVATABLE_RADIUS_COUNT);
    assert.equal(audit.dormantExemptCount, G10_S8_DORMANT_EXEMPT_COUNT);
    assert.equal(audit.rows.length, 74);
    assert.equal(audit.radiusUnchanged, true);
    assert.equal(audit.homeBusDormant, true);
    assert.equal(audit.landerReopenWiredCount, G10_S8_LANDER_REOPEN_WIRED.length);
    assert.equal(audit.priorLanderExitedCount, G10_S8_PRIOR_LANDER_EXITED.length);
    assert.equal(
      audit.exitedOwningSliceCount + audit.priorLanderExitedCount + audit.landerReopenWiredCount,
      73,
    );
    const dormant = audit.rows.find((r) => r.commId === G10_DORMANT_HOME_BUS_COMM_ID);
    assert.equal(dormant?.disposition, "dormant-exempt");
    for (const wired of G10_S8_LANDER_REOPEN_WIRED) {
      const row = audit.rows.find((r) => r.commId === wired.commId);
      assert.equal(row?.disposition, "lander-reopen-wired");
      assert.equal(row?.landerSlice, wired.landerSlice);
    }
    assert.equal(audit.phaseResiduals.length, G10_S8_PHASE_RESIDUALS_OPERATOR_ACCEPT.length);
    assert.ok(audit.phaseResiduals.every((r) => r.operatorAccept === true));
  });

  it("S8 lander-reopen handoff constants are landed", () => {
    assert.equal(G10_S2_FLAG_T3_OTEL_HANDOFF_LANDED_FROM_S6.status, "landed");
    assert.equal(G10_S3_FILE_CHECKPOINTS_HANDOFF_FROM_S7.status, "landed");
    assert.equal(G10_S3_FLAG_CLOUDFLARED_HANDOFF_FROM_S7.status, "landed");
    assert.equal(G10_S4_FLAG_CODEX_LAUNCH_HANDOFF_FROM_S7.status, "landed");
    assert.equal(G10_S5_FLAG_TERM_ENV_HANDOFF_FROM_S7.status, "landed");
  });

  it("campaign rollback drill restores all fabric installs without clearing shadow", () => {
    const model = createG10S8SubstitutionModel(repoRoot);
    installAllFabricSlices(model);
    for (const slice of ["S2", "S4", "S6"] as const) {
      const install = model.installs.get(slice)!;
      model.installs.set(slice, { ...install, authority: "manifold" });
    }
    const env: NodeJS.ProcessEnv = { [G9_SHADOW_PARITY_ENV]: "1" };
    const shadow = assertRollbackLeavesShadowEnv(env, () => {
      const drill = runCampaignRollbackDrill(model);
      assert.equal(drill.valid, true);
      assert.equal(drill.allLive, true);
      assert.equal(drill.hook.kind, "campaign-rollback");
      assert.equal(drill.hook.clearedShadowEnv, false);
      assert.equal(drill.slicesRestored.length, 7);
      for (const slice of drill.slicesRestored) {
        assert.equal(authorityForSlice(model, slice), "live");
      }
    });
    assert.equal(shadow.unchanged, true);
    assert.equal(shadow.after, "1");
  });

  it("aggregate ≡ under G9DeferredEquality and refuses 763-as-proof", () => {
    const agg = aggregateCutoverEquivalence(G10_S8_AGGREGATE_EQUIV_SEED_PAIRS);
    assert.equal(agg.carrier, "G9DeferredEquality");
    assert.equal(agg.forbids763, true);
    assert.equal(agg.sampleCount, G10_S8_AGGREGATE_EQUIV_SEED_PAIRS.length);
    assert.throws(() => refuse763AsProof("wp8-763-shadow-fixtures-alone"), /763/);
    assert.throws(
      () => aggregateCutoverEquivalence(G10_S8_AGGREGATE_EQUIV_SEED_PAIRS, "763-proof-campaign"),
      /763/,
    );
    assert.throws(
      () =>
        aggregateCutoverEquivalence([
          {
            commId: "INV-T2-GIT",
            live: { method: "execute" },
            manifold: { method: "listRemotes" },
          },
        ]),
      /aggregate ≡ failed/,
    );
  });

  it("runS8CampaignCloseProof produces audit + rollback + ≡", () => {
    const { audit, rollback, equivalence } = runS8CampaignCloseProof(repoRoot);
    assert.equal(audit.rows.length, 74);
    assert.equal(rollback.valid, true);
    assert.equal(rollback.allLive, true);
    assert.ok(equivalence.sampleCount >= 12);
    const auditMd = formatDualRunExitAuditMarkdown(audit);
    assert.ok(auditMd.includes("S8 dual-run-exit audit"));
    assert.ok(auditMd.includes("INV-T2-FLAG-T3-OTEL"));
    assert.ok(auditMd.includes("INV-T2-SCM-HOME-BUS-LINK"));
    assert.ok(auditMd.includes("operator accept"));
    const rbMd = formatCampaignRollbackDrillMarkdown(rollback);
    assert.ok(rbMd.includes("runCampaignRollback"));
    const eqMd = formatCampaignCutoverEquivalenceMarkdown(equivalence);
    assert.ok(eqMd.includes("G9DeferredEquality"));
    assert.ok(eqMd.includes("not WP8 763") || eqMd.includes("763"));
  });

  it("FLAG-T3-OTEL bridge records traffic when S2 replace installed", () => {
    const ctrl = createG10S2Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S2(ctrl);
    try {
      Effect.runSync(resolveFlagT3OtelViaG10Bridge(Effect.succeed({ ok: true as const })));
      const samples = ctrl.traffic.samples.filter((s) => s.commId === "INV-T2-FLAG-T3-OTEL");
      assert.ok(samples.length >= 1);
      assert.ok(samples.some((s) => s.path === "live" || s.path === "manifold"));
    } finally {
      installProcessGlobalG10S2(undefined);
    }
  });
});

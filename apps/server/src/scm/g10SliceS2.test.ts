/**
 * G10 S2 campaign controller tests (full Ordered proof).
 *
 * Intended: land → live-rehearsal → ≡ → rollback-drill → dual-run-exit →
 * arm-inversion; three wired lander seams + ORCH-LIVE handoff-pending;
 * markDualRunExited refuses; bridge helpers absent ⇒ live passthrough.
 * Observed: assertions below. Does not start S3. Does not edit ws.ts.
 * S8 lander-reopen lands FLAG-T3-OTEL on cli/config (not historical S2 exit (a)).
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { resolveG10RepoRoot } from "./g10CutoverRegistry.ts";
import { orderedProofSatisfiedThrough } from "./g10ProofHarness.ts";
import { markDualRunExited } from "./g10Substitution.ts";
import {
  G10_S2_COMM_IDS,
  G10_S2_FLAG_T3_OTEL_HANDOFF_LANDED_FROM_S6,
  G10_S2_HANDOFF_LANDED_FROM_S1_COMM_IDS,
  G10_S2_HANDOFF_PENDING_COMM_IDS,
  G10_S2_ORCH_LIVE_HANDOFF,
  G10_S2_SETTINGS_EVENTS_HANDOFF_LANDED,
  G10_S2_WIRED_COMM_IDS,
  G10S2CutoverLayer,
  G10S2CutoverService,
  createG10S2Controller,
  fileSettingsExistsViaG10Bridge,
  fileSettingsReadViaG10Bridge,
  fileSettingsWriteViaG10Bridge,
  getProcessGlobalG10S2,
  installProcessGlobalG10S2,
  publishSettingsEventsViaG10Bridge,
  resolveFlagServerConfigViaG10Bridge,
  resolveOptionalG10S2,
  subscribeSettingsEventsViaG10Bridge,
} from "./g10SliceS2.ts";

const repoRoot = resolveG10RepoRoot();

describe("G10 S2 controller", () => {
  it("owns frozen 3 S2 comm_ids, three wired, ORCH-LIVE handoff-pending", () => {
    assert.equal(G10_S2_COMM_IDS.length, 3);
    assert.equal(G10_S2_WIRED_COMM_IDS.length, 3);
    assert.deepEqual([...G10_S2_HANDOFF_PENDING_COMM_IDS], ["INV-T2-ORCH-LIVE"]);
    assert.deepEqual([...G10_S2_HANDOFF_LANDED_FROM_S1_COMM_IDS], ["INV-T2-SETTINGS-EVENTS"]);
    assert.equal(G10_S2_ORCH_LIVE_HANDOFF.status, "handoff-pending");
    assert.equal(G10_S2_ORCH_LIVE_HANDOFF.landerSlice, "S6");
    assert.equal(G10_S2_SETTINGS_EVENTS_HANDOFF_LANDED.status, "landed");
    assert.equal(G10_S2_SETTINGS_EVENTS_HANDOFF_LANDED.fromSlice, "S1");
    assert.equal(G10_S2_FLAG_T3_OTEL_HANDOFF_LANDED_FROM_S6.status, "landed");
    assert.equal(G10_S2_FLAG_T3_OTEL_HANDOFF_LANDED_FROM_S6.landedAt, "S8-lander-reopen");
    assert.equal(G10_S2_FLAG_T3_OTEL_HANDOFF_LANDED_FROM_S6.fromSlice, "S6");
    const ctrl = createG10S2Controller(repoRoot);
    assert.equal(ctrl.slice, "S2");
    assert.equal(ctrl.authority(), "live");
    assert.equal(ctrl.isReplaceInstalled(), false);
  });

  it("full Ordered proof sequence ends inverted with manifold authority", () => {
    const ctrl = createG10S2Controller(repoRoot);
    const bodies = ctrl.runFullOrderedProof();
    assert.equal(bodies.length, 6);
    assert.deepEqual(
      bodies.map((b) => b.step),
      [
        "land",
        "live-rehearsal",
        "cutover-equivalence",
        "rollback-drill",
        "dual-run-exit",
        "arm-inversion",
      ],
    );
    assert.equal(ctrl.authority(), "manifold");
    assert.equal(ctrl.inversionArmed(), true);
    assert.equal(ctrl.phase(), "inverted");
    assert.equal(orderedProofSatisfiedThrough(ctrl.model, "S2", "arm-inversion"), true);
    // 3 inventory + SETTINGS handoff land
    assert.equal(bodies[2]?.equalitySamples?.length, 4);
    // Dual-run-exit notes must not claim ORCH-LIVE under exit (a).
    const exitBody = bodies[4];
    assert.ok(exitBody?.notes.some((n) => n.includes("ORCH-LIVE handoff-deferred")));
    assert.ok(exitBody?.notes.some((n) => n.includes("three wired")));
    assert.throws(() => markDualRunExited(ctrl.model, "S2"), /recordOrderedProofStep/);
  });

  it("live-rehearsal records bridge traffic for three wired; ORCH-LIVE stub only", () => {
    const ctrl = createG10S2Controller(repoRoot);
    ctrl.land();
    ctrl.liveRehearsal();
    for (const id of G10_S2_WIRED_COMM_IDS) {
      const samples = ctrl.traffic.samples.filter((s) => s.commId === id);
      assert.ok(
        samples.some((s) => s.path === "live"),
        `missing live for ${id}`,
      );
      assert.ok(
        samples.some((s) => s.path === "manifold"),
        `missing manifold for ${id}`,
      );
    }
    const orchLive = ctrl.traffic.samples.filter((s) => s.commId === "INV-T2-ORCH-LIVE");
    assert.ok(orchLive.length >= 2);
    assert.ok(orchLive.every((s) => s.phase === "live-buffer-offered"));
  });

  it("evidence markdown writers emit required sections", () => {
    const ctrl = createG10S2Controller(repoRoot);
    const bodies = ctrl.runFullOrderedProof();
    for (const body of bodies) {
      const md = ctrl.formatEvidenceMarkdown(body);
      assert.ok(md.includes(`# S2 ${body.step} evidence`));
      assert.ok(md.includes("**GREEN**"));
      assert.ok(md.includes("INV-T2-FILE-SETTINGS"));
      assert.ok(md.includes("INV-T2-FLAG-SERVER-CONFIG"));
    }
  });

  it("absent controller: bridge helpers pass through live unchanged", () => {
    installProcessGlobalG10S2(undefined);
    let liveRuns = 0;
    assert.equal(
      Effect.runSync(
        fileSettingsExistsViaG10Bridge(
          Effect.sync(() => {
            liveRuns += 1;
            return false;
          }),
        ),
      ),
      false,
    );
    assert.equal(liveRuns, 1);

    assert.equal(Effect.runSync(fileSettingsReadViaG10Bridge(Effect.succeed("ok"))), "ok");
    assert.equal(Effect.runSync(fileSettingsWriteViaG10Bridge(Effect.succeed(true))), true);
    assert.equal(Effect.runSync(publishSettingsEventsViaG10Bridge(Effect.succeed(true))), true);
    assert.equal(Effect.runSync(subscribeSettingsEventsViaG10Bridge(Effect.succeed("sub"))), "sub");
    assert.deepEqual(
      Effect.runSync(resolveFlagServerConfigViaG10Bridge(Effect.succeed({ ok: true }))),
      { ok: true },
    );
  });

  it("present Layer service resolves via serviceOption; process-global fallback works", () => {
    const ctrl = createG10S2Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S2(undefined);

    const fromLayer = Effect.runSync(
      resolveOptionalG10S2().pipe(Effect.provide(G10S2CutoverLayer(ctrl))),
    );
    assert.equal(Option.isSome(fromLayer), true);
    if (Option.isSome(fromLayer)) {
      assert.equal(fromLayer.value.isReplaceInstalled(), true);
    }

    // Absent Layer: process-global fallback.
    installProcessGlobalG10S2(ctrl);
    assert.equal(getProcessGlobalG10S2(), ctrl);
    const fromGlobal = Effect.runSync(resolveOptionalG10S2());
    assert.equal(Option.isSome(fromGlobal), true);
    installProcessGlobalG10S2(undefined);
  });

  it("present + landed: lander bridges record live+manifold observe", () => {
    const ctrl = createG10S2Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S2(ctrl);

    Effect.runSync(fileSettingsExistsViaG10Bridge(Effect.succeed(true)));
    Effect.runSync(fileSettingsReadViaG10Bridge(Effect.void));
    Effect.runSync(fileSettingsWriteViaG10Bridge(Effect.void));
    Effect.runSync(publishSettingsEventsViaG10Bridge(Effect.succeed(true)));
    Effect.runSync(subscribeSettingsEventsViaG10Bridge(Effect.succeed("sub")));
    Effect.runSync(resolveFlagServerConfigViaG10Bridge(Effect.succeed({})));

    for (const id of G10_S2_WIRED_COMM_IDS) {
      const samples = ctrl.traffic.samples.filter((s) => s.commId === id);
      assert.ok(
        samples.some((s) => s.path === "live"),
        `missing live for ${id}`,
      );
      assert.ok(
        samples.some((s) => s.path === "manifold"),
        `missing manifold for ${id}`,
      );
    }
    installProcessGlobalG10S2(undefined);
  });

  it("G10S2CutoverService Tag is Context.Service (Layer.succeed)", () => {
    const ctrl = createG10S2Controller(repoRoot);
    const got = Effect.runSync(
      Effect.gen(function* () {
        return yield* G10S2CutoverService;
      }).pipe(Effect.provide(Layer.succeed(G10S2CutoverService, ctrl))),
    );
    assert.equal(got.slice, "S2");
  });
});

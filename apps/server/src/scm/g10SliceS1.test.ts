/**
 * G10 S1 campaign controller tests (full Ordered proof + FD1 retire).
 *
 * Intended: land → live-rehearsal → ≡ → rollback-drill → dual-run-exit →
 * arm-inversion → soft-fallback-retire (under T2CODE_SCM_FABRIC_DEPTH); six
 * wired seams + SETTINGS handoff-pending; markDualRunExited refuses; bridge
 * helpers absent ⇒ live passthrough.
 * Observed: assertions below. Does not start S2. Does not edit serverSettings.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { FABRIC_DEPTH_ENV } from "./fabricDepthBootstrap.ts";
import { softFallbackForSlice } from "./fabricDepthSoftFallback.ts";
import { resolveG10RepoRoot } from "./g10CutoverRegistry.ts";
import { orderedProofSatisfiedThrough } from "./g10ProofHarness.ts";
import { markDualRunExited } from "./g10Substitution.ts";
import {
  G10_S1_COMM_IDS,
  G10_S1_ENGINE_COMM_IDS,
  G10_S1_HANDOFF_PENDING_COMM_IDS,
  G10_S1_SETTINGS_EVENTS_HANDOFF,
  G10_S1_WIRED_COMM_IDS,
  G10S1CutoverLayer,
  G10S1CutoverService,
  createG10S1Controller,
  getProcessGlobalG10S1,
  installProcessGlobalG10S1,
  offerOrchQueueViaG10Bridge,
  offerPreviewAutoViaG10Bridge,
  projectQueueViaG10Bridge,
  publishLifecycleEventsViaG10Bridge,
  publishOrchEventsViaG10Bridge,
  publishVcsEventsViaG10Bridge,
  resolveOptionalG10S1,
} from "./g10SliceS1.ts";

const repoRoot = resolveG10RepoRoot();

/** Enable Fabric-depth env for Ordered depth through soft-fallback-retire. */
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

describe("G10 S1 controller", () => {
  it("owns frozen 7 S1 comm_ids, six wired, SETTINGS handoff-pending", () => {
    assert.equal(G10_S1_COMM_IDS.length, 7);
    assert.equal(G10_S1_WIRED_COMM_IDS.length, 6);
    assert.deepEqual([...G10_S1_ENGINE_COMM_IDS], ["INV-T2-ORCH-EVENTS", "INV-T2-ORCH-QUEUE"]);
    assert.deepEqual([...G10_S1_HANDOFF_PENDING_COMM_IDS], ["INV-T2-SETTINGS-EVENTS"]);
    assert.equal(G10_S1_SETTINGS_EVENTS_HANDOFF.status, "handoff-pending");
    assert.equal(G10_S1_SETTINGS_EVENTS_HANDOFF.landerSlice, "S2");
    const ctrl = createG10S1Controller(repoRoot);
    assert.equal(ctrl.slice, "S1");
    assert.equal(ctrl.authority(), "live");
    assert.equal(ctrl.isReplaceInstalled(), false);
  });

  it("full Ordered proof through soft-fallback-retire GREEN under FD env", () => {
    withFdEnv(() => {
      const ctrl = createG10S1Controller(repoRoot);
      const bodies = ctrl.runFullOrderedProof();
      assert.equal(bodies.length, 7);
      assert.deepEqual(
        bodies.map((b) => b.step),
        [
          "land",
          "live-rehearsal",
          "cutover-equivalence",
          "rollback-drill",
          "dual-run-exit",
          "arm-inversion",
          "soft-fallback-retire",
        ],
      );
      assert.equal(ctrl.authority(), "manifold");
      assert.equal(ctrl.inversionArmed(), true);
      assert.equal(ctrl.phase(), "inverted");
      assert.equal(orderedProofSatisfiedThrough(ctrl.model, "S1", "arm-inversion"), true);
      assert.equal(softFallbackForSlice(ctrl.model, "S1"), "retired");
      assert.equal(bodies[6]?.softFallback, "retired");
      assert.equal(bodies[2]?.equalitySamples?.length, 7);
      // Dual-run-exit notes must not claim SETTINGS under exit (a).
      const exitBody = bodies[4];
      assert.ok(exitBody?.notes.some((n) => n.includes("SETTINGS-EVENTS handoff-deferred")));
      assert.ok(exitBody?.notes.some((n) => n.includes("six wired")));
      // Evidence bodies emit softFallback field throughout the sequence.
      for (const body of bodies) {
        assert.ok("softFallback" in body);
      }
      assert.throws(() => markDualRunExited(ctrl.model, "S1"), /recordOrderedProofStep/);
    });
  });

  it("softFallbackRetire refuses when FD env off", () => {
    const ctrl = createG10S1Controller(repoRoot);
    ctrl.land();
    ctrl.liveRehearsal();
    ctrl.recordEquiv();
    ctrl.rollbackDrill();
    ctrl.dualRunExit();
    ctrl.armInversion();
    assert.throws(() => ctrl.softFallbackRetire(), /T2CODE_SCM_FABRIC_DEPTH/);
  });

  it("live-rehearsal records bridge traffic for six wired; SETTINGS stub only", () => {
    const ctrl = createG10S1Controller(repoRoot);
    ctrl.land();
    ctrl.liveRehearsal();
    for (const id of G10_S1_WIRED_COMM_IDS) {
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
    const settings = ctrl.traffic.samples.filter((s) => s.commId === "INV-T2-SETTINGS-EVENTS");
    assert.ok(settings.length >= 2);
    assert.ok(settings.every((s) => s.phase === "settings-subscription-established"));
  });

  it("evidence markdown writers emit required sections", () => {
    withFdEnv(() => {
      const ctrl = createG10S1Controller(repoRoot);
      const bodies = ctrl.runFullOrderedProof();
      for (const body of bodies) {
        const md = ctrl.formatEvidenceMarkdown(body);
        assert.ok(md.includes(`# S1 ${body.step} evidence`));
        assert.ok(md.includes("**GREEN**"));
        assert.ok(md.includes("INV-T2-ORCH-EVENTS"));
        assert.ok(md.includes("INV-T2-ORCH-QUEUE"));
        assert.ok(md.includes("softFallback:"));
      }
      const retireMd = ctrl.formatEvidenceMarkdown(bodies[6]!);
      assert.ok(retireMd.includes("softFallback: `retired`"));
    });
  });

  it("absent controller: bridge helpers pass through live unchanged", () => {
    installProcessGlobalG10S1(undefined);
    let liveRuns = 0;
    const published = Effect.runSync(
      publishOrchEventsViaG10Bridge(
        Effect.sync(() => {
          liveRuns += 1;
          return true;
        }),
        { type: "thread.activity-appended" } as never,
      ),
    );
    assert.equal(published, true);
    assert.equal(liveRuns, 1);

    const offered = Effect.runSync(
      offerOrchQueueViaG10Bridge(Effect.succeed(true), { type: "thread.message.send" } as never),
    );
    assert.equal(offered, true);

    assert.equal(Effect.runSync(publishLifecycleEventsViaG10Bridge(Effect.succeed(true))), true);
    assert.equal(Effect.runSync(offerPreviewAutoViaG10Bridge(Effect.succeed(true))), true);
    assert.equal(Effect.runSync(publishVcsEventsViaG10Bridge(Effect.succeed(true))), true);
    Effect.runSync(projectQueueViaG10Bridge(Effect.void));
  });

  it("present Layer service resolves via serviceOption; process-global fallback works", () => {
    const ctrl = createG10S1Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S1(undefined);

    const fromLayer = Effect.runSync(
      resolveOptionalG10S1().pipe(Effect.provide(G10S1CutoverLayer(ctrl))),
    );
    assert.equal(Option.isSome(fromLayer), true);
    if (Option.isSome(fromLayer)) {
      assert.equal(fromLayer.value.isReplaceInstalled(), true);
    }

    // Absent Layer: process-global fallback.
    installProcessGlobalG10S1(ctrl);
    assert.equal(getProcessGlobalG10S1(), ctrl);
    const fromGlobal = Effect.runSync(resolveOptionalG10S1());
    assert.equal(Option.isSome(fromGlobal), true);
    installProcessGlobalG10S1(undefined);
  });

  it("present + landed: capture-module bridges record live+manifold observe", () => {
    const ctrl = createG10S1Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S1(ctrl);

    Effect.runSync(publishLifecycleEventsViaG10Bridge(Effect.succeed(true)));
    Effect.runSync(offerPreviewAutoViaG10Bridge(Effect.succeed(true)));
    Effect.runSync(publishVcsEventsViaG10Bridge(Effect.succeed(true)));
    Effect.runSync(projectQueueViaG10Bridge(Effect.void));

    for (const id of [
      "INV-T2-LIFECYCLE-EVENTS",
      "INV-T2-PREVIEW-AUTO",
      "INV-T2-VCS-EVENTS",
      "INV-T2-PROJECT-QUEUE",
    ] as const) {
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
    installProcessGlobalG10S1(undefined);
  });

  it("present + landed: bridge records live+manifold observe on publish helper", () => {
    const ctrl = createG10S1Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S1(ctrl);
    const before = ctrl.traffic.samples.length;
    Effect.runSync(
      publishOrchEventsViaG10Bridge(Effect.succeed(true), {
        type: "thread.activity-appended",
      } as never),
    );
    const orchEvents = ctrl.traffic.samples.filter((s) => s.commId === "INV-T2-ORCH-EVENTS");
    assert.ok(orchEvents.length >= before + 2 || orchEvents.length >= 2);
    assert.ok(orchEvents.some((s) => s.path === "live"));
    assert.ok(orchEvents.some((s) => s.path === "manifold"));
    installProcessGlobalG10S1(undefined);
  });

  it("G10S1CutoverService Tag is Context.Service (Layer.succeed)", () => {
    const ctrl = createG10S1Controller(repoRoot);
    const got = Effect.runSync(
      Effect.gen(function* () {
        return yield* G10S1CutoverService;
      }).pipe(Effect.provide(Layer.succeed(G10S1CutoverService, ctrl))),
    );
    assert.equal(got.slice, "S1");
  });
});

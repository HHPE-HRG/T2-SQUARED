/**
 * G10 S3 campaign controller tests (full Ordered proof + Fabric-depth FD3).
 *
 * Intended: land → live-rehearsal → ≡ → rollback-drill → dual-run-exit →
 * arm-inversion; under T2CODE_SCM_FABRIC_DEPTH also soft-fallback-retire;
 * fifteen wired seams + TEL-DESKTOP-CONTROL handoff-pending;
 * markDualRunExited refuses; bridge helpers absent ⇒ live passthrough.
 * Observed: assertions below. Does not start S4. Does not edit
 * DesktopTelemetryReceiver.ts. S8 lander-reopen lands FILE-CHECKPOINTS /
 * FLAG-CLOUDFLARED (not historical S3 exit (a)). Not G11.
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
  G10_S3_COMM_IDS,
  G10_S3_FILE_CHECKPOINTS_HANDOFF_FROM_S7,
  G10_S3_FLAG_CLOUDFLARED_HANDOFF_FROM_S7,
  G10_S3_HANDOFF_PENDING_COMM_IDS,
  G10_S3_TEL_DESKTOP_CONTROL_HANDOFF,
  G10_S3_WIRED_COMM_IDS,
  G10S3CutoverLayer,
  G10S3CutoverService,
  createG10S3Controller,
  editorLaunchViaG10Bridge,
  getProcessGlobalG10S3,
  gitExecuteViaG10Bridge,
  httpServeListeningViaG10Bridge,
  installProcessGlobalG10S3,
  resolveOptionalG10S3,
  scCliExecuteViaG10Bridge,
  telAnalyticsViaG10Bridge,
} from "./g10SliceS3.ts";

const repoRoot = resolveG10RepoRoot();

/** Run fn with T2CODE_SCM_FABRIC_DEPTH=1; restore previous env after. */
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

describe("G10 S3 controller", () => {
  it("owns frozen 16 S3 comm_ids, fifteen wired, TEL-DESKTOP-CONTROL handoff-pending", () => {
    assert.equal(G10_S3_COMM_IDS.length, 16);
    assert.equal(G10_S3_WIRED_COMM_IDS.length, 15);
    assert.deepEqual([...G10_S3_HANDOFF_PENDING_COMM_IDS], ["INV-T2-TEL-DESKTOP-CONTROL"]);
    assert.equal(G10_S3_TEL_DESKTOP_CONTROL_HANDOFF.status, "handoff-pending");
    assert.equal(G10_S3_TEL_DESKTOP_CONTROL_HANDOFF.landerSlice, "S5");
    assert.equal(G10_S3_FILE_CHECKPOINTS_HANDOFF_FROM_S7.status, "landed");
    assert.equal(G10_S3_FILE_CHECKPOINTS_HANDOFF_FROM_S7.landedAt, "S8-lander-reopen");
    assert.equal(G10_S3_FLAG_CLOUDFLARED_HANDOFF_FROM_S7.status, "landed");
    assert.equal(G10_S3_FLAG_CLOUDFLARED_HANDOFF_FROM_S7.landedAt, "S8-lander-reopen");
    const ctrl = createG10S3Controller(repoRoot);
    assert.equal(ctrl.slice, "S3");
    assert.equal(ctrl.authority(), "live");
    assert.equal(ctrl.isReplaceInstalled(), false);
  });

  it("full Ordered proof sequence ends inverted with manifold authority", () => {
    const ctrl = createG10S3Controller(repoRoot);
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
    assert.equal(orderedProofSatisfiedThrough(ctrl.model, "S3", "arm-inversion"), true);
    // FD off: softFallback omit (null) — retire not auto-run
    assert.equal(bodies[5]?.softFallback, null);
    assert.equal(softFallbackForSlice(ctrl.model, "S3"), null);
    // 16 inventory (15 wired + 1 handoff stub)
    assert.equal(bodies[2]?.equalitySamples?.length, 16);
    const exitBody = bodies[4];
    assert.ok(exitBody?.notes.some((n) => n.includes("TEL-DESKTOP-CONTROL handoff-deferred")));
    assert.ok(exitBody?.notes.some((n) => n.includes("fifteen wired")));
    assert.throws(() => markDualRunExited(ctrl.model, "S3"), /recordOrderedProofStep/);
  });

  it("Fabric-depth FD3: Ordered depth through soft-fallback-retire under FD env", () => {
    withFdEnv(() => {
      const ctrl = createG10S3Controller(repoRoot);
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
      assert.equal(softFallbackForSlice(ctrl.model, "S3"), "retired");
      assert.equal(bodies[4]?.softFallback, "active");
      assert.equal(bodies[5]?.softFallback, "active");
      assert.equal(bodies[6]?.softFallback, "retired");
      assert.ok(
        bodies[6]?.notes.some((n) => n.includes("sole-lander debt empty")),
        "retire notes cite empty S3 sole-lander debt",
      );
      assert.ok(
        bodies[6]?.notes.some((n) => n.includes("TEL-DESKTOP-CONTROL handoff")),
        "retire notes cite TEL-DESKTOP-CONTROL handoff",
      );
      const md = ctrl.formatEvidenceMarkdown(bodies[6]!);
      assert.ok(md.includes("softFallback: `retired`"));
      assert.ok(md.includes("**GREEN**"));
    });
  });

  it("Fabric-depth FD3: softFallbackRetire refuses when FD env off", () => {
    const ctrl = createG10S3Controller(repoRoot);
    ctrl.land();
    ctrl.liveRehearsal();
    ctrl.recordEquiv();
    ctrl.rollbackDrill();
    ctrl.dualRunExit();
    ctrl.armInversion();
    assert.throws(() => ctrl.softFallbackRetire(), /T2CODE_SCM_FABRIC_DEPTH/);
  });

  it("live-rehearsal records bridge traffic for fifteen wired; TEL-DESKTOP stub only", () => {
    const ctrl = createG10S3Controller(repoRoot);
    ctrl.land();
    ctrl.liveRehearsal();
    for (const id of G10_S3_WIRED_COMM_IDS) {
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
    const telDesktop = ctrl.traffic.samples.filter(
      (s) => s.commId === "INV-T2-TEL-DESKTOP-CONTROL",
    );
    assert.ok(telDesktop.length >= 2);
    assert.ok(telDesktop.every((s) => s.phase === "desktop-control-send-succeeded"));
  });

  it("evidence markdown writers emit required sections", () => {
    const ctrl = createG10S3Controller(repoRoot);
    const bodies = ctrl.runFullOrderedProof();
    for (const body of bodies) {
      const md = ctrl.formatEvidenceMarkdown(body);
      assert.ok(md.includes(`# S3 ${body.step} evidence`));
      assert.ok(md.includes("**GREEN**"));
      assert.ok(md.includes("INV-T2-GIT"));
      assert.ok(md.includes("INV-T2-RELAY-CLIENT"));
    }
  });

  it("absent controller: bridge helpers pass through live unchanged", () => {
    installProcessGlobalG10S3(undefined);
    let liveRuns = 0;
    assert.equal(
      Effect.runSync(
        gitExecuteViaG10Bridge(
          "execute",
          Effect.sync(() => {
            liveRuns += 1;
            return "ok";
          }),
        ),
      ),
      "ok",
    );
    assert.equal(liveRuns, 1);

    assert.equal(Effect.runSync(editorLaunchViaG10Bridge(Effect.void)), undefined);
    assert.equal(Effect.runSync(httpServeListeningViaG10Bridge(Effect.void)), undefined);
    assert.deepEqual(
      Effect.runSync(scCliExecuteViaG10Bridge("INV-T2-SC-GITHUB", Effect.succeed({ ok: true }))),
      { ok: true },
    );
    assert.equal(Effect.runSync(telAnalyticsViaG10Bridge(Effect.void)), undefined);
  });

  it("present Layer service resolves via serviceOption; process-global fallback works", () => {
    const ctrl = createG10S3Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S3(undefined);

    const fromLayer = Effect.runSync(
      resolveOptionalG10S3().pipe(Effect.provide(G10S3CutoverLayer(ctrl))),
    );
    assert.equal(Option.isSome(fromLayer), true);
    if (Option.isSome(fromLayer)) {
      assert.equal(fromLayer.value.isReplaceInstalled(), true);
    }

    installProcessGlobalG10S3(ctrl);
    assert.equal(getProcessGlobalG10S3(), ctrl);
    const fromGlobal = Effect.runSync(resolveOptionalG10S3());
    assert.equal(Option.isSome(fromGlobal), true);
    installProcessGlobalG10S3(undefined);
  });

  it("present + landed: lander bridges record live+manifold observe", () => {
    const ctrl = createG10S3Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S3(ctrl);

    Effect.runSync(gitExecuteViaG10Bridge("execute", Effect.succeed("git-ok")));
    Effect.runSync(editorLaunchViaG10Bridge(Effect.void));
    Effect.runSync(httpServeListeningViaG10Bridge(Effect.void));
    Effect.runSync(scCliExecuteViaG10Bridge("INV-T2-SC-GITHUB", Effect.succeed({})));
    Effect.runSync(telAnalyticsViaG10Bridge(Effect.void));

    for (const id of [
      "INV-T2-GIT",
      "INV-T2-EDITOR-LAUNCH",
      "INV-T2-HTTP-SERVE",
      "INV-T2-SC-GITHUB",
      "INV-T2-TEL-ANALYTICS",
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
    installProcessGlobalG10S3(undefined);
  });

  it("G10S3CutoverService Tag is Context.Service (Layer.succeed)", () => {
    const ctrl = createG10S3Controller(repoRoot);
    const got = Effect.runSync(
      Effect.gen(function* () {
        return yield* G10S3CutoverService;
      }).pipe(Effect.provide(Layer.succeed(G10S3CutoverService, ctrl))),
    );
    assert.equal(got.slice, "S3");
  });
});

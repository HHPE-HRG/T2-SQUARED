/**
 * G10 S5 campaign controller tests (full Ordered proof + Fabric-depth FD5).
 *
 * Intended: land → live-rehearsal → ≡ → rollback-drill → dual-run-exit →
 * arm-inversion; under T2CODE_SCM_FABRIC_DEPTH also soft-fallback-retire.
 * Four wired seams + NDJSON/T3-TRACE stubs; markDualRunExited refuses;
 * bridge helpers absent ⇒ live passthrough. Does not start S6.
 * Does not steal FILE-LOGS terminalLogs / edit Observability.
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
  G10_S5_COMM_IDS,
  G10_S5_FILE_LOGS_TERMINAL_LOGS_HANDOFF_FROM_S7,
  G10_S5_FLAG_TERM_ENV_HANDOFF_FROM_S7,
  G10_S5_HANDOFF_PENDING_COMM_IDS,
  G10_S5_TEL_DESKTOP_CONTROL_HANDOFF_LANDED,
  G10_S5_TEL_NDJSON_HANDOFF,
  G10_S5_TEL_T3_TRACE_HANDOFF,
  G10_S5_WIRED_COMM_IDS,
  G10S5CutoverLayer,
  G10S5CutoverService,
  createG10S5Controller,
  desktopControlViaG10Bridge,
  desktopInViaG10Bridge,
  getProcessGlobalG10S5,
  installProcessGlobalG10S5,
  resMonitorSpawnViaG10Bridge,
  resolveOptionalG10S5,
  termPhaseViaG10Bridge,
} from "./g10SliceS5.ts";

const repoRoot = resolveG10RepoRoot();

/** Run body with T2CODE_SCM_FABRIC_DEPTH=1, restore prior env. */
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

describe("G10 S5 controller", () => {
  it("owns frozen 5 S5 comm_ids, four wired, S6 handoffs pending, FLAG-TERM S8 landed", () => {
    assert.equal(G10_S5_COMM_IDS.length, 5);
    assert.equal(G10_S5_WIRED_COMM_IDS.length, 4);
    assert.equal(G10_S5_HANDOFF_PENDING_COMM_IDS.length, 2);
    assert.equal(G10_S5_TEL_NDJSON_HANDOFF.status, "handoff-pending");
    assert.equal(G10_S5_TEL_T3_TRACE_HANDOFF.status, "handoff-pending");
    assert.equal(G10_S5_TEL_DESKTOP_CONTROL_HANDOFF_LANDED.status, "landed");
    assert.equal(G10_S5_FILE_LOGS_TERMINAL_LOGS_HANDOFF_FROM_S7.status, "landed");
    assert.equal(G10_S5_FLAG_TERM_ENV_HANDOFF_FROM_S7.status, "landed");
    assert.equal(G10_S5_FLAG_TERM_ENV_HANDOFF_FROM_S7.landedAt, "S8-lander-reopen");
    const ctrl = createG10S5Controller(repoRoot);
    assert.equal(ctrl.slice, "S5");
    assert.equal(ctrl.authority(), "live");
    assert.equal(ctrl.isReplaceInstalled(), false);
  });

  it("full Ordered proof sequence ends inverted with manifold authority", () => {
    const ctrl = createG10S5Controller(repoRoot);
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
    assert.equal(orderedProofSatisfiedThrough(ctrl.model, "S5", "arm-inversion"), true);
    // Inventory 5 + TEL-DESKTOP-CONTROL handoff land.
    assert.equal(bodies[2]?.equalitySamples?.length, 6);
    const exitBody = bodies[4];
    assert.ok(exitBody?.notes.some((n) => n.includes("four wired")));
    assert.ok(exitBody?.notes.some((n) => n.includes("TEL-NDJSON")));
    assert.ok(exitBody?.notes.some((n) => n.includes("FILE-LOGS")));
    assert.throws(() => markDualRunExited(ctrl.model, "S5"), /recordOrderedProofStep/);
  });

  it("live-rehearsal records bridge traffic for wired four + stub pairs for S6 handoffs", () => {
    const ctrl = createG10S5Controller(repoRoot);
    ctrl.land();
    ctrl.liveRehearsal();
    for (const id of G10_S5_WIRED_COMM_IDS) {
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
    for (const id of G10_S5_HANDOFF_PENDING_COMM_IDS) {
      const samples = ctrl.traffic.samples.filter((s) => s.commId === id);
      assert.ok(
        samples.some((s) => s.path === "live"),
        `missing live stub for ${id}`,
      );
      assert.ok(
        samples.some((s) => s.path === "manifold"),
        `missing manifold stub for ${id}`,
      );
    }
  });

  it("evidence markdown writers emit required sections", () => {
    const ctrl = createG10S5Controller(repoRoot);
    const bodies = ctrl.runFullOrderedProof();
    for (const body of bodies) {
      const md = ctrl.formatEvidenceMarkdown(body);
      assert.ok(md.includes(`# S5 ${body.step} evidence`));
      assert.ok(md.includes("**GREEN**"));
      assert.ok(md.includes("INV-T2-TERM"));
      assert.ok(md.includes("INV-T2-RES-MONITOR"));
      assert.ok(md.includes("softFallback:"));
    }
  });

  it("absent controller: bridge helpers pass through live unchanged", () => {
    installProcessGlobalG10S5(undefined);
    let liveRuns = 0;
    assert.equal(
      Effect.runSync(
        termPhaseViaG10Bridge(
          "pty-spawn-succeeded",
          Effect.sync(() => {
            liveRuns += 1;
            return "ok";
          }),
        ),
      ),
      "ok",
    );
    assert.equal(liveRuns, 1);

    assert.equal(Effect.runSync(resMonitorSpawnViaG10Bridge(Effect.succeed("spawned"))), "spawned");
    assert.deepEqual(
      Effect.runSync(desktopInViaG10Bridge(Effect.succeed({ type: "desktopTelemetryHello" }))),
      { type: "desktopTelemetryHello" },
    );
    assert.equal(
      Effect.runSync(desktopControlViaG10Bridge("setDiagnosticsDemand", Effect.succeed("sent"))),
      "sent",
    );
  });

  it("present Layer service resolves via serviceOption; process-global fallback works", () => {
    const ctrl = createG10S5Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S5(undefined);

    const fromLayer = Effect.runSync(
      resolveOptionalG10S5().pipe(Effect.provide(G10S5CutoverLayer(ctrl))),
    );
    assert.equal(Option.isSome(fromLayer), true);
    if (Option.isSome(fromLayer)) {
      assert.equal(fromLayer.value.isReplaceInstalled(), true);
    }

    installProcessGlobalG10S5(ctrl);
    assert.equal(getProcessGlobalG10S5(), ctrl);
    const fromGlobal = Effect.runSync(resolveOptionalG10S5());
    assert.equal(Option.isSome(fromGlobal), true);
    installProcessGlobalG10S5(undefined);
  });

  it("present + landed: lander bridges record live+manifold observe", () => {
    const ctrl = createG10S5Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S5(ctrl);

    Effect.runSync(termPhaseViaG10Bridge("pty-spawn-succeeded", Effect.succeed("term-ok")));
    Effect.runSync(resMonitorSpawnViaG10Bridge(Effect.succeed("mon-ok")));
    Effect.runSync(desktopInViaG10Bridge(Effect.void));
    Effect.runSync(desktopControlViaG10Bridge("setHostPowerIntervals", Effect.void));

    for (const id of [
      "INV-T2-TERM",
      "INV-T2-RES-MONITOR",
      "INV-T2-TEL-DESKTOP-IN",
      "INV-T2-TEL-DESKTOP-CONTROL",
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
    installProcessGlobalG10S5(undefined);
  });

  it("G10S5CutoverService Tag is Context.Service (Layer.succeed)", () => {
    const ctrl = createG10S5Controller(repoRoot);
    const got = Effect.runSync(
      Effect.gen(function* () {
        return yield* G10S5CutoverService;
      }).pipe(Effect.provide(Layer.succeed(G10S5CutoverService, ctrl))),
    );
    assert.equal(got.slice, "S5");
  });

  it("FD env: softFallbackRetire after arm-inversion retires S5 (census real)", () => {
    withFdEnv(() => {
      const ctrl = createG10S5Controller(repoRoot);
      const bodies = ctrl.runFullOrderedProof();
      assert.equal(bodies.length, 7);
      assert.equal(bodies[6]?.step, "soft-fallback-retire");
      assert.equal(bodies[6]?.softFallback, "retired");
      assert.equal(softFallbackForSlice(ctrl.model, "S5"), "retired");
      const md = ctrl.formatEvidenceMarkdown(bodies[6]!);
      assert.ok(md.includes("softFallback: `retired`"));
      assert.ok(md.includes("manifold-io-census"));
    });
  });

  it("FD env off: softFallbackRetire refuses; runFullOrderedProof stays at 6", () => {
    const ctrl = createG10S5Controller(repoRoot);
    const bodies = ctrl.runFullOrderedProof();
    assert.equal(bodies.length, 6);
    assert.throws(() => ctrl.softFallbackRetire(), /T2CODE_SCM_FABRIC_DEPTH/);
  });

  it("FD env: softFallbackRetire refuses before arm-inversion", () => {
    withFdEnv(() => {
      const ctrl = createG10S5Controller(repoRoot);
      ctrl.land();
      ctrl.liveRehearsal();
      ctrl.recordEquiv();
      ctrl.rollbackDrill();
      ctrl.dualRunExit();
      assert.throws(() => ctrl.softFallbackRetire(), /arm-inversion/);
    });
  });
});

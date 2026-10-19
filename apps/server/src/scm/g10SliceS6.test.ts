/**
 * G10 S6 campaign controller tests (full Ordered proof).
 *
 * Intended: land → live-rehearsal → ≡ → rollback-drill → dual-run-exit →
 * arm-inversion; fourteen wired seams + FLAG-T3 stub; home-bus dormant;
 * markDualRunExited refuses; bridge helpers absent ⇒ live passthrough.
 * Does not start S7. Does not steal FLAG-T3-OTEL on cli/config.ts.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";

import { G10_DORMANT_HOME_BUS_COMM_ID, resolveG10RepoRoot } from "./g10CutoverRegistry.ts";
import { orderedProofSatisfiedThrough } from "./g10ProofHarness.ts";
import { markDualRunExited } from "./g10Substitution.ts";
import {
  G10_S6_COMM_IDS,
  G10_S6_DORMANT_COMM_IDS,
  G10_S6_FLAG_T3_OTEL_HANDOFF,
  G10_S6_HANDOFF_LANDED_COMM_IDS,
  G10_S6_HANDOFF_PENDING_COMM_IDS,
  G10_S6_HOME_BUS_DORMANT,
  G10_S6_ORCH_LIVE_HANDOFF_LANDED,
  G10_S6_TEL_NDJSON_HANDOFF_LANDED,
  G10_S6_TEL_T3_TRACE_HANDOFF_LANDED,
  G10_S6_WIRED_COMM_IDS,
  G10S6CutoverLayer,
  G10S6CutoverService,
  createG10S6Controller,
  flagT2OtelViaG10Bridge,
  getProcessGlobalG10S6,
  installProcessGlobalG10S6,
  ndjsonExportViaG10Bridge,
  offerOrchLiveViaG10Bridge,
  resolveOptionalG10S6,
  rpcRequestAdmittedViaG10Bridge,
  t2OtlpExportViaG10Bridge,
  t3TraceBatchViaG10Bridge,
} from "./g10SliceS6.ts";

const repoRoot = resolveG10RepoRoot();

describe("G10 S6 controller", () => {
  it("owns frozen 12 activatable, fourteen wired, S2 handoff + dormant slots", () => {
    assert.equal(G10_S6_COMM_IDS.length, 12);
    assert.equal(G10_S6_WIRED_COMM_IDS.length, 14);
    assert.equal(G10_S6_HANDOFF_PENDING_COMM_IDS.length, 1);
    assert.equal(G10_S6_HANDOFF_LANDED_COMM_IDS.length, 3);
    assert.equal(G10_S6_DORMANT_COMM_IDS.length, 1);
    assert.equal(G10_S6_DORMANT_COMM_IDS[0], G10_DORMANT_HOME_BUS_COMM_ID);
    assert.equal(G10_S6_FLAG_T3_OTEL_HANDOFF.status, "handoff-pending");
    assert.equal(G10_S6_ORCH_LIVE_HANDOFF_LANDED.status, "landed");
    assert.equal(G10_S6_TEL_NDJSON_HANDOFF_LANDED.status, "landed");
    assert.equal(G10_S6_TEL_T3_TRACE_HANDOFF_LANDED.status, "landed");
    assert.equal(G10_S6_HOME_BUS_DORMANT.status, "dormant-preserved");
    assert.ok(!G10_S6_COMM_IDS.includes(G10_DORMANT_HOME_BUS_COMM_ID as never));
    assert.ok(!G10_S6_WIRED_COMM_IDS.includes("INV-T2-FLAG-T3-OTEL" as never));
    const ctrl = createG10S6Controller(repoRoot);
    assert.equal(ctrl.slice, "S6");
    assert.equal(ctrl.authority(), "live");
    assert.equal(ctrl.isReplaceInstalled(), false);
  });

  it("full Ordered proof sequence ends inverted with manifold authority", () => {
    const ctrl = createG10S6Controller(repoRoot);
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
    assert.equal(orderedProofSatisfiedThrough(ctrl.model, "S6", "arm-inversion"), true);
    // Activatable 12 + three handoff lands.
    assert.equal(bodies[2]?.equalitySamples?.length, 15);
    const exitBody = bodies[4];
    assert.ok(exitBody?.notes.some((n) => n.includes("fourteen wired")));
    assert.ok(exitBody?.notes.some((n) => n.includes("FLAG-T3-OTEL")));
    assert.ok(exitBody?.notes.some((n) => n.includes("HOME-BUS") || n.includes("dormant")));
    assert.throws(() => markDualRunExited(ctrl.model, "S6"), /recordOrderedProofStep/);
  });

  it("live-rehearsal records bridge traffic for wired fourteen + stub for FLAG-T3", () => {
    const ctrl = createG10S6Controller(repoRoot);
    ctrl.land();
    ctrl.liveRehearsal();
    for (const id of G10_S6_WIRED_COMM_IDS) {
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
    for (const id of G10_S6_HANDOFF_PENDING_COMM_IDS) {
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
    assert.equal(
      ctrl.traffic.samples.filter((s) => s.commId === G10_DORMANT_HOME_BUS_COMM_ID).length,
      0,
    );
  });

  it("evidence markdown writers emit required sections", () => {
    const ctrl = createG10S6Controller(repoRoot);
    const bodies = ctrl.runFullOrderedProof();
    for (const body of bodies) {
      const md = ctrl.formatEvidenceMarkdown(body);
      assert.ok(md.includes(`# S6 ${body.step} evidence`));
      assert.ok(md.includes("**GREEN**"));
      assert.ok(md.includes("INV-T2-RPC-WS"));
      assert.ok(md.includes("INV-T2-FLAG-T2-OTEL"));
    }
  });

  it("absent controller: bridge helpers pass through live unchanged", () => {
    installProcessGlobalG10S6(undefined);
    let liveRuns = 0;
    assert.equal(
      Effect.runSync(
        flagT2OtelViaG10Bridge(
          "T2CODE_TRACE_FILE",
          Effect.sync(() => {
            liveRuns += 1;
            return "ok";
          }),
        ),
      ),
      "ok",
    );
    assert.equal(liveRuns, 1);

    assert.equal(Effect.runSync(ndjsonExportViaG10Bridge(Effect.succeed("ndjson"))), "ndjson");
    assert.equal(Effect.runSync(t2OtlpExportViaG10Bridge(Effect.succeed("otlp"))), "otlp");
    assert.equal(Effect.runSync(t3TraceBatchViaG10Bridge(Effect.succeed("trace"))), "trace");
    assert.equal(Effect.runSync(rpcRequestAdmittedViaG10Bridge("server.probe")), undefined);
  });

  it("absent controller: ORCH-LIVE offer still returns Queue.offer result", () => {
    installProcessGlobalG10S6(undefined);
    const accepted = Effect.runSync(
      Effect.gen(function* () {
        const q = yield* Queue.unbounded<{ readonly kind: "event" | "synchronized" }>();
        return yield* offerOrchLiveViaG10Bridge(q, { kind: "event" });
      }),
    );
    assert.equal(accepted, true);
  });

  it("present Layer service resolves via serviceOption; process-global fallback works", () => {
    const ctrl = createG10S6Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S6(undefined);

    const fromLayer = Effect.runSync(
      resolveOptionalG10S6().pipe(Effect.provide(G10S6CutoverLayer(ctrl))),
    );
    assert.equal(Option.isSome(fromLayer), true);
    if (Option.isSome(fromLayer)) {
      assert.equal(fromLayer.value.isReplaceInstalled(), true);
    }

    installProcessGlobalG10S6(ctrl);
    assert.equal(getProcessGlobalG10S6(), ctrl);
    const fromGlobal = Effect.runSync(resolveOptionalG10S6());
    assert.equal(Option.isSome(fromGlobal), true);
    installProcessGlobalG10S6(undefined);
  });

  it("present + landed: lander bridges record live+manifold observe", () => {
    const ctrl = createG10S6Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S6(ctrl);

    Effect.runSync(flagT2OtelViaG10Bridge("T2CODE_OTLP_TRACES_URL", Effect.succeed("flag-ok")));
    Effect.runSync(ndjsonExportViaG10Bridge(Effect.succeed("ndjson-ok")));
    Effect.runSync(t2OtlpExportViaG10Bridge(Effect.succeed("t2-otlp-ok")));
    Effect.runSync(t3TraceBatchViaG10Bridge(Effect.succeed("t3-trace-ok")));
    Effect.runSync(rpcRequestAdmittedViaG10Bridge("server.probe"));

    for (const id of [
      "INV-T2-FLAG-T2-OTEL",
      "INV-T2-TEL-NDJSON",
      "INV-T2-TEL-T2-OTLP",
      "INV-T2-TEL-T3-TRACE",
      "INV-T2-RPC-WS",
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
    installProcessGlobalG10S6(undefined);
  });

  it("G10S6CutoverService Tag is Context.Service (Layer.succeed)", () => {
    const ctrl = createG10S6Controller(repoRoot);
    const got = Effect.runSync(
      Effect.gen(function* () {
        return yield* G10S6CutoverService;
      }).pipe(Effect.provide(Layer.succeed(G10S6CutoverService, ctrl))),
    );
    assert.equal(got.slice, "S6");
  });
});

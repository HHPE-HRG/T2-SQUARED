/**
 * G10 S4 campaign controller tests (full Ordered proof).
 *
 * Intended: land → live-rehearsal → ≡ → rollback-drill → dual-run-exit →
 * arm-inversion; all sixteen S4 seams wired; markDualRunExited refuses;
 * bridge helpers absent ⇒ live passthrough. Does not start S5. Does not
 * steal FILE-PROVIDER-SESSION / FILE-LOGS provider-event-log. S8 lander-reopen
 * lands FLAG-CODEX-LAUNCH (not historical S4 exit (a)).
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { resolveG10RepoRoot } from "./g10CutoverRegistry.ts";
import { orderedProofSatisfiedThrough } from "./g10ProofHarness.ts";
import { markDualRunExited } from "./g10Substitution.ts";
import {
  G10_S4_COMM_IDS,
  G10_S4_FILE_LOGS_PROVIDER_EVENT_LOG_HANDOFF_FROM_S7,
  G10_S4_FILE_PROVIDER_SESSION_HANDOFF_FROM_S7,
  G10_S4_FLAG_CODEX_LAUNCH_HANDOFF_FROM_S7,
  G10_S4_WIRED_COMM_IDS,
  G10S4CutoverLayer,
  G10S4CutoverService,
  createG10S4Controller,
  getProcessGlobalG10S4,
  httpAuthViaG10Bridge,
  httpStaticViaG10Bridge,
  installProcessGlobalG10S4,
  mcpHttpViaG10Bridge,
  providerTurnViaG10Bridge,
  resolveOptionalG10S4,
} from "./g10SliceS4.ts";

const repoRoot = resolveG10RepoRoot();

describe("G10 S4 controller", () => {
  it("owns frozen 16 S4 comm_ids, all sixteen wired, FLAG-CODEX S8 landed", () => {
    assert.equal(G10_S4_COMM_IDS.length, 16);
    assert.equal(G10_S4_WIRED_COMM_IDS.length, 16);
    assert.equal(G10_S4_FILE_PROVIDER_SESSION_HANDOFF_FROM_S7.status, "landed");
    assert.equal(G10_S4_FILE_LOGS_PROVIDER_EVENT_LOG_HANDOFF_FROM_S7.status, "landed");
    assert.equal(G10_S4_FLAG_CODEX_LAUNCH_HANDOFF_FROM_S7.status, "landed");
    assert.equal(G10_S4_FLAG_CODEX_LAUNCH_HANDOFF_FROM_S7.landedAt, "S8-lander-reopen");
    const ctrl = createG10S4Controller(repoRoot);
    assert.equal(ctrl.slice, "S4");
    assert.equal(ctrl.authority(), "live");
    assert.equal(ctrl.isReplaceInstalled(), false);
  });

  it("full Ordered proof sequence ends inverted with manifold authority", () => {
    const ctrl = createG10S4Controller(repoRoot);
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
    assert.equal(orderedProofSatisfiedThrough(ctrl.model, "S4", "arm-inversion"), true);
    assert.equal(bodies[2]?.equalitySamples?.length, 16);
    const exitBody = bodies[4];
    assert.ok(exitBody?.notes.some((n) => n.includes("sixteen wired")));
    assert.ok(exitBody?.notes.some((n) => n.includes("FILE-PROVIDER-SESSION")));
    assert.throws(() => markDualRunExited(ctrl.model, "S4"), /recordOrderedProofStep/);
  });

  it("live-rehearsal records bridge traffic for all sixteen wired seams", () => {
    const ctrl = createG10S4Controller(repoRoot);
    ctrl.land();
    ctrl.liveRehearsal();
    for (const id of G10_S4_WIRED_COMM_IDS) {
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
  });

  it("evidence markdown writers emit required sections", () => {
    const ctrl = createG10S4Controller(repoRoot);
    const bodies = ctrl.runFullOrderedProof();
    for (const body of bodies) {
      const md = ctrl.formatEvidenceMarkdown(body);
      assert.ok(md.includes(`# S4 ${body.step} evidence`));
      assert.ok(md.includes("**GREEN**"));
      assert.ok(md.includes("INV-T2-PROVIDER-TURN"));
      assert.ok(md.includes("INV-T2-MCP-HTTP"));
    }
  });

  it("absent controller: bridge helpers pass through live unchanged", () => {
    installProcessGlobalG10S4(undefined);
    let liveRuns = 0;
    assert.equal(
      Effect.runSync(
        providerTurnViaG10Bridge(
          Effect.sync(() => {
            liveRuns += 1;
            return "ok";
          }),
        ),
      ),
      "ok",
    );
    assert.equal(liveRuns, 1);

    assert.deepEqual(
      Effect.runSync(httpAuthViaG10Bridge("session", Effect.succeed({ ok: true }))),
      { ok: true },
    );
    assert.equal(
      Effect.runSync(httpStaticViaG10Bridge("static-file-200-selected", Effect.void)),
      undefined,
    );
    assert.equal(Effect.runSync(mcpHttpViaG10Bridge(Effect.succeed("mcp"))), "mcp");
  });

  it("present Layer service resolves via serviceOption; process-global fallback works", () => {
    const ctrl = createG10S4Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S4(undefined);

    const fromLayer = Effect.runSync(
      resolveOptionalG10S4().pipe(Effect.provide(G10S4CutoverLayer(ctrl))),
    );
    assert.equal(Option.isSome(fromLayer), true);
    if (Option.isSome(fromLayer)) {
      assert.equal(fromLayer.value.isReplaceInstalled(), true);
    }

    installProcessGlobalG10S4(ctrl);
    assert.equal(getProcessGlobalG10S4(), ctrl);
    const fromGlobal = Effect.runSync(resolveOptionalG10S4());
    assert.equal(Option.isSome(fromGlobal), true);
    installProcessGlobalG10S4(undefined);
  });

  it("present + landed: lander bridges record live+manifold observe", () => {
    const ctrl = createG10S4Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S4(ctrl);

    Effect.runSync(providerTurnViaG10Bridge(Effect.succeed("turn-ok")));
    Effect.runSync(httpAuthViaG10Bridge("session", Effect.void));
    Effect.runSync(httpStaticViaG10Bridge("static-file-200-selected", Effect.void));
    Effect.runSync(mcpHttpViaG10Bridge(Effect.void));

    for (const id of [
      "INV-T2-PROVIDER-TURN",
      "INV-T2-HTTP-AUTH",
      "INV-T2-HTTP-STATIC",
      "INV-T2-MCP-HTTP",
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
    installProcessGlobalG10S4(undefined);
  });

  it("G10S4CutoverService Tag is Context.Service (Layer.succeed)", () => {
    const ctrl = createG10S4Controller(repoRoot);
    const got = Effect.runSync(
      Effect.gen(function* () {
        return yield* G10S4CutoverService;
      }).pipe(Effect.provide(Layer.succeed(G10S4CutoverService, ctrl))),
    );
    assert.equal(got.slice, "S4");
  });
});

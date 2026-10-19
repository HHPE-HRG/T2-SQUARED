/**
 * G10 S7 campaign controller tests (full Ordered proof).
 *
 * Intended: land → live-rehearsal → ≡ → rollback-drill → dual-run-exit →
 * arm-inversion; ten wired sole-lander seams + four foreign handoff stubs;
 * markDualRunExited refuses; bridge helpers absent ⇒ live passthrough.
 * Does not start S8. Does not steal VcsDriver / relayClient / provider/** /
 * Manager.ts foreign hotspots.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { resolveG10RepoRoot } from "./g10CutoverRegistry.ts";
import { orderedProofSatisfiedThrough } from "./g10ProofHarness.ts";
import { markDualRunExited } from "./g10Substitution.ts";
import {
  G10_S7_COMM_IDS,
  G10_S7_FILE_CHECKPOINTS_HANDOFF,
  G10_S7_FLAG_CLOUDFLARED_HANDOFF,
  G10_S7_FLAG_CODEX_LAUNCH_HANDOFF,
  G10_S7_FLAG_TERM_ENV_HANDOFF,
  G10_S7_HANDOFF_PENDING_COMM_IDS,
  G10_S7_PHASE_COUNT,
  G10_S7_WIRED_COMM_IDS,
  G10S7CutoverLayer,
  G10S7CutoverService,
  attachmentWriteViaG10Bridge,
  createG10S7Controller,
  fileLogsDirCreateViaG10Bridge,
  getProcessGlobalG10S7,
  installProcessGlobalG10S7,
  projectSqlViaG10Bridge,
  resolveOptionalG10S7,
  sqliteExecuteViaG10Bridge,
} from "./g10SliceS7.ts";

const repoRoot = resolveG10RepoRoot();

describe("G10 S7 controller", () => {
  it("owns frozen 14 activatable, ten wired, four handoff-pending slots", () => {
    assert.equal(G10_S7_COMM_IDS.length, 14);
    assert.equal(G10_S7_WIRED_COMM_IDS.length, 10);
    assert.equal(G10_S7_HANDOFF_PENDING_COMM_IDS.length, 4);
    assert.equal(G10_S7_PHASE_COUNT, 72);
    assert.equal(G10_S7_FILE_CHECKPOINTS_HANDOFF.status, "handoff-pending");
    assert.equal(G10_S7_FLAG_CLOUDFLARED_HANDOFF.status, "handoff-pending");
    assert.equal(G10_S7_FLAG_CODEX_LAUNCH_HANDOFF.status, "handoff-pending");
    assert.equal(G10_S7_FLAG_TERM_ENV_HANDOFF.status, "handoff-pending");
    assert.ok(!G10_S7_WIRED_COMM_IDS.includes("INV-T2-FILE-CHECKPOINTS" as never));
    assert.ok(!G10_S7_WIRED_COMM_IDS.includes("INV-T2-FLAG-CLOUDFLARED" as never));
    const ctrl = createG10S7Controller(repoRoot);
    assert.equal(ctrl.slice, "S7");
    assert.equal(ctrl.authority(), "live");
    assert.equal(ctrl.isReplaceInstalled(), false);
  });

  it("full Ordered proof sequence ends inverted with manifold authority", () => {
    const ctrl = createG10S7Controller(repoRoot);
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
    assert.equal(orderedProofSatisfiedThrough(ctrl.model, "S7", "arm-inversion"), true);
    assert.equal(bodies[2]?.equalitySamples?.length, 14);
    const exitBody = bodies[4];
    assert.ok(exitBody?.notes.some((n) => n.includes("ten wired")));
    assert.ok(exitBody?.notes.some((n) => n.includes("handoff-deferred") || n.includes("four")));
    assert.throws(() => markDualRunExited(ctrl.model, "S7"), /recordOrderedProofStep/);
  });

  it("live-rehearsal records bridge traffic for wired ten + stubs for four", () => {
    const ctrl = createG10S7Controller(repoRoot);
    ctrl.land();
    ctrl.liveRehearsal();
    for (const id of G10_S7_WIRED_COMM_IDS) {
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
    for (const id of G10_S7_HANDOFF_PENDING_COMM_IDS) {
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
    const ctrl = createG10S7Controller(repoRoot);
    const bodies = ctrl.runFullOrderedProof();
    for (const body of bodies) {
      const md = ctrl.formatEvidenceMarkdown(body);
      assert.ok(md.includes(`# S7 ${body.step} evidence`));
      assert.ok(md.includes("**GREEN**"));
      assert.ok(md.includes("INV-T2-SQLITE"));
      assert.ok(md.includes("INV-T2-PROJECT-SQL"));
      assert.ok(md.includes("72"));
    }
  });

  it("absent controller: bridge helpers pass through live unchanged", () => {
    installProcessGlobalG10S7(undefined);
    let liveRuns = 0;
    assert.equal(
      Effect.runSync(
        attachmentWriteViaG10Bridge(
          Effect.sync(() => {
            liveRuns += 1;
            return "ok";
          }),
        ),
      ),
      "ok",
    );
    assert.equal(liveRuns, 1);
    assert.equal(
      Effect.runSync(fileLogsDirCreateViaG10Bridge("logsDir", Effect.succeed("mkdir"))),
      "mkdir",
    );
    assert.equal(
      Effect.runSync(sqliteExecuteViaG10Bridge("execute", Effect.succeed("sql"))),
      "sql",
    );
    assert.equal(
      Effect.runSync(
        projectSqlViaG10Bridge("ProjectionCheckpoints-upsert-succeeded", Effect.succeed("proj")),
      ),
      "proj",
    );
  });

  it("present Layer service resolves via serviceOption; process-global fallback works", () => {
    const ctrl = createG10S7Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S7(undefined);

    const fromLayer = Effect.runSync(
      resolveOptionalG10S7().pipe(Effect.provide(G10S7CutoverLayer(ctrl))),
    );
    assert.equal(Option.isSome(fromLayer), true);
    if (Option.isSome(fromLayer)) {
      assert.equal(fromLayer.value.isReplaceInstalled(), true);
    }

    installProcessGlobalG10S7(ctrl);
    assert.equal(getProcessGlobalG10S7(), ctrl);
    const fromGlobal = Effect.runSync(resolveOptionalG10S7());
    assert.equal(Option.isSome(fromGlobal), true);
    installProcessGlobalG10S7(undefined);
  });

  it("present + landed: lander bridges record live+manifold observe", () => {
    const ctrl = createG10S7Controller(repoRoot);
    ctrl.land();
    installProcessGlobalG10S7(ctrl);

    Effect.runSync(attachmentWriteViaG10Bridge(Effect.succeed("att-ok")));
    Effect.runSync(fileLogsDirCreateViaG10Bridge("logsDir", Effect.succeed("logs-ok")));
    Effect.runSync(sqliteExecuteViaG10Bridge("execute", Effect.succeed("sql-ok")));
    Effect.runSync(
      projectSqlViaG10Bridge(
        "ProjectionCheckpoints-upsert-succeeded",
        Effect.succeed("sql-proj-ok"),
      ),
    );

    for (const id of [
      "INV-T2-FILE-ATTACHMENTS",
      "INV-T2-FILE-LOGS",
      "INV-T2-SQLITE",
      "INV-T2-PROJECT-SQL",
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
    installProcessGlobalG10S7(undefined);
  });

  it("G10S7CutoverService Tag is Context.Service (Layer.succeed)", () => {
    const ctrl = createG10S7Controller(repoRoot);
    const got = Effect.runSync(
      Effect.gen(function* () {
        return yield* G10S7CutoverService;
      }).pipe(Effect.provide(Layer.succeed(G10S7CutoverService, ctrl))),
    );
    assert.equal(got.slice, "S7");
  });
});

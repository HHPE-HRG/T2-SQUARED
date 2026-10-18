// @effect-diagnostics nodeBuiltinImport:off
/**
 * G9 Task 14 full ledger capture projection widen tests (RFC-017/019).
 *
 * Intended: prove generated (comm_id, phase_id) set equals ledger 184;
 * live-success and dormant-prototype enqueue typed occurrences; declaration-
 * absence fails placement without enqueue; illegal inputs → placement;
 * live-safe layer still never-fails on defects and preserves sequence-overflow.
 *
 * Observed: assertions below against loadG9Package + coordinator + live-safe
 * layer. Does not flip g9toG10Authorized. Does not authorize G10.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Ref from "effect/Ref";

import { loadG8FramingParameters } from "./g8SharedClock.ts";
import { DipMuteStore } from "./g6DipMute.ts";
import { G9RosterCoordinator } from "./g9Coordinator.ts";
import { G9_LEDGER_PHASE_PAIRS } from "./g9CaptureInput.generated.ts";
import { G9FaultController } from "./g9Fault.ts";
import { G9CaptureService, G9LiveSafeCaptureLayer } from "./g9OrchQueueCapture.ts";
import {
  G9InvariantFault,
  type G9CaptureOccurrenceInput,
  type G9FaultSink,
} from "./g9Occurrence.ts";
import { makeG9Observation } from "./g9Observation.ts";
import {
  findRowPhase,
  ledgerPhasePairKey,
  listPackagePhasePairs,
  loadG9Package,
} from "./g9Package.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const ORCH_NODE = "node.orchestration";

const makeCoordinator = () => {
  const pkg = loadG9Package(repoRoot);
  const store = new DipMuteStore(pkg.governed);
  const observation = makeG9Observation();
  const sink: G9FaultSink = { deliver: () => Effect.void };
  const faults = new G9FaultController(
    observation,
    sink,
    () => undefined,
    () => undefined,
  );
  const framing = loadG8FramingParameters(repoRoot);
  const coordinator = new G9RosterCoordinator(pkg, store, observation, faults, framing);
  return { pkg, store, observation, faults, framing, coordinator };
};

describe("g9CaptureWiden (Task 14)", () => {
  it("generated (comm_id, phase_id) pairs set-equal ledger package 184", () => {
    const pkg = loadG9Package(repoRoot);
    const fromPkg = listPackagePhasePairs(pkg);
    assert.equal(fromPkg.length, 184);
    assert.equal(G9_LEDGER_PHASE_PAIRS.length, 184);

    const pkgKeys = new Set(fromPkg.map((p) => ledgerPhasePairKey(p.comm_id, p.phase_id)));
    const genKeys = new Set(
      G9_LEDGER_PHASE_PAIRS.map((p) => ledgerPhasePairKey(p.comm_id, p.phase_id)),
    );
    assert.equal(pkgKeys.size, 184);
    assert.equal(genKeys.size, 184);
    for (const key of pkgKeys) {
      assert.equal(genKeys.has(key), true, `missing generated pair ${key}`);
    }
    for (const key of genKeys) {
      assert.equal(pkgKeys.has(key), true, `extra generated pair ${key}`);
    }

    // fixture_driver_class projected on package phases (RFC-019 machine keys).
    const absence = findRowPhase(pkg, "INV-T2-FILE-LOGS", "serverLogPath-declared-no-live-writer");
    assert.equal(absence?.phase.fixture_driver_class, "declaration-absence");
    const dormant = findRowPhase(pkg, "INV-T2-SCM-HOME-BUS-LINK", "home-bus-forward-succeeded");
    assert.equal(dormant?.phase.fixture_driver_class, "dormant-prototype");
  });

  it.effect("live-success ORCH-QUEUE enqueue projects named A / labels / retain", () =>
    Effect.gen(function* () {
      const { coordinator, pkg } = makeCoordinator();
      const phase = findRowPhase(pkg, "INV-T2-ORCH-QUEUE", "queue-offered")!.phase;
      const input: G9CaptureOccurrenceInput = {
        comm_id: "INV-T2-ORCH-QUEUE",
        phase: "queue-offered",
        input: { command_type: "client" },
      };
      const result = yield* coordinator.captureOccurrence(input);
      assert.equal(result.status, "enqueued");
      if (result.status !== "enqueued") return;
      assert.equal(result.occurrence.comm_id, "INV-T2-ORCH-QUEUE");
      assert.equal(result.occurrence.phase_id, "queue-offered");
      assert.deepEqual(result.occurrence.equality_A, { command_type: "client" });
      assert.equal(result.occurrence.request_label, "client");
      assert.equal(result.occurrence.state_label, "offered");
      assert.equal(result.occurrence.retainCurrentAfterPublish, phase.retainCurrentAfterPublish);
      assert.equal(result.occurrence.semanticKind, phase.semanticKind);
      assert.equal(coordinator.fifo.depth(ORCH_NODE), 1);
    }),
  );

  it.effect("live-success flag-resolved with multi state_label enqueues correct labels", () =>
    Effect.gen(function* () {
      const { coordinator, pkg } = makeCoordinator();
      const looked = findRowPhase(pkg, "INV-T2-FLAG-T2-OTEL", "flag-resolved")!;
      const input: G9CaptureOccurrenceInput = {
        comm_id: "INV-T2-FLAG-T2-OTEL",
        phase: "flag-resolved",
        input: { member: "T2CODE_TRACE_FILE", state_label: "defaulted" },
      };
      const result = yield* coordinator.captureOccurrence(input);
      assert.equal(result.status, "enqueued");
      if (result.status !== "enqueued") return;
      assert.deepEqual(result.occurrence.equality_A, { member: "T2CODE_TRACE_FILE" });
      assert.equal(result.occurrence.request_label, "T2CODE_TRACE_FILE");
      assert.equal(result.occurrence.state_label, "defaulted");
      assert.equal(
        result.occurrence.retainCurrentAfterPublish,
        looked.phase.retainCurrentAfterPublish,
      );
      assert.equal(coordinator.fifo.depth(looked.row.node_id), 1);
    }),
  );

  it.effect("declaration-absence → placement; FIFO unchanged; WP8-style no-capture assert", () =>
    Effect.gen(function* () {
      const { coordinator, pkg } = makeCoordinator();
      const looked = findRowPhase(
        pkg,
        "INV-T2-FILE-LOGS",
        "serverLogPath-declared-no-live-writer",
      )!;
      assert.equal(looked.phase.fixture_driver_class, "declaration-absence");
      // WP8 absence driver asserts declaration only — does not call captureOccurrence.
      const depthBefore = coordinator.fifo.depth(looked.row.node_id);

      const input: G9CaptureOccurrenceInput = {
        comm_id: "INV-T2-FILE-LOGS",
        phase: "serverLogPath-declared-no-live-writer",
        input: { member_id: "serverLogPath" },
      };
      const exit = yield* Effect.exit(coordinator.captureOccurrence(input));
      assert.equal(Exit.isFailure(exit), true);
      if (!Exit.isFailure(exit)) return;
      const squashed = Cause.squash(exit.cause);
      assert.equal(squashed instanceof G9InvariantFault, true);
      assert.equal((squashed as G9InvariantFault).code, "placement");
      assert.equal(coordinator.fifo.depth(looked.row.node_id), depthBefore);
    }),
  );

  it.effect("dormant-prototype enqueues under fixture/test coordinator wiring", () =>
    Effect.gen(function* () {
      const { coordinator, pkg } = makeCoordinator();
      const looked = findRowPhase(pkg, "INV-T2-SCM-HOME-BUS-LINK", "home-bus-forward-succeeded")!;
      assert.equal(looked.phase.fixture_driver_class, "dormant-prototype");
      const input: G9CaptureOccurrenceInput = {
        comm_id: "INV-T2-SCM-HOME-BUS-LINK",
        phase: "home-bus-forward-succeeded",
        input: { route_id: "fixture-forward" },
      };
      const result = yield* coordinator.captureOccurrence(input);
      assert.equal(result.status, "enqueued");
      if (result.status !== "enqueued") return;
      assert.deepEqual(result.occurrence.equality_A, { route_id: "fixture-forward" });
      assert.equal(result.occurrence.request_label, "fixture-forward");
      assert.equal(result.occurrence.state_label, "succeeded");
      assert.equal(coordinator.fifo.depth(looked.row.node_id), 1);
      // Production bootstrap (WP7) never invokes dormant capture — documented by
      // fixture_driver_class presence + this test-only wiring path.
      assert.equal(looked.phase.fixture_driver_class, "dormant-prototype");
    }),
  );

  it.effect("illegal phase / out-of-domain A → placement", () =>
    Effect.gen(function* () {
      const { coordinator } = makeCoordinator();

      // Force an illegal A value via cast (not a union member).
      const badA = yield* Effect.exit(
        coordinator.captureOccurrence({
          comm_id: "INV-T2-ORCH-QUEUE",
          phase: "queue-offered",
          input: { command_type: "not-a-label" },
        } as unknown as G9CaptureOccurrenceInput),
      );
      assert.equal(Exit.isFailure(badA), true);
      if (!Exit.isFailure(badA)) return;
      assert.equal((Cause.squash(badA.cause) as G9InvariantFault).code, "placement");

      const unknown = yield* Effect.exit(
        coordinator.captureOccurrence({
          comm_id: "INV-T2-ORCH-QUEUE",
          phase: "not-a-phase",
          input: { command_type: "client" },
        } as unknown as G9CaptureOccurrenceInput),
      );
      assert.equal(Exit.isFailure(unknown), true);
      if (!Exit.isFailure(unknown)) return;
      assert.equal((Cause.squash(unknown.cause) as G9InvariantFault).code, "placement");
    }),
  );

  it.effect("live-safe layer never-fails on Die (capture-defect) and typed sequence-overflow", () =>
    Effect.gen(function* () {
      const { pkg, observation } = makeCoordinator();
      const waker = { state: () => "stopped" as const };

      const sinkCodes = yield* Ref.make<string[]>([]);
      const sink: G9FaultSink = {
        deliver: (fault) => Ref.update(sinkCodes, (xs) => [...xs, fault.code]),
      };
      const faults = new G9FaultController(
        observation,
        sink,
        () => undefined,
        () => undefined,
      );

      const dieCoordinator = {
        captureOccurrence: () => Effect.die(new Error("boom")),
      } as unknown as G9RosterCoordinator;
      const dieLayer = G9LiveSafeCaptureLayer(dieCoordinator, faults, pkg, waker);

      const dieResult = yield* G9CaptureService.pipe(
        Effect.flatMap((capture) =>
          capture.captureOccurrence({
            comm_id: "INV-T2-ORCH-QUEUE",
            phase: "queue-offered",
            input: { command_type: "client" },
          }),
        ),
        Effect.provide(dieLayer),
      );

      assert.equal(dieResult, undefined);
      assert.deepEqual(yield* Ref.get(sinkCodes), ["capture-defect"]);

      // Fresh controller — first-fault latch already consumed above.
      const sinkCodes2 = yield* Ref.make<string[]>([]);
      const sink2: G9FaultSink = {
        deliver: (fault) => Ref.update(sinkCodes2, (xs) => [...xs, fault.code]),
      };
      const faults2 = new G9FaultController(
        observation,
        sink2,
        () => undefined,
        () => undefined,
      );
      const overflowCoordinator = {
        captureOccurrence: () => Effect.fail(new G9InvariantFault("sequence-overflow", ORCH_NODE)),
      } as unknown as G9RosterCoordinator;
      const overflowLayer = G9LiveSafeCaptureLayer(overflowCoordinator, faults2, pkg, waker);

      const overflowResult = yield* G9CaptureService.pipe(
        Effect.flatMap((capture) =>
          capture.captureOccurrence({
            comm_id: "INV-T2-ORCH-QUEUE",
            phase: "queue-offered",
            input: { command_type: "internal" },
          }),
        ),
        Effect.provide(overflowLayer),
      );

      assert.equal(overflowResult, undefined);
      assert.deepEqual(yield* Ref.get(sinkCodes2), ["sequence-overflow"]);
    }),
  );
});

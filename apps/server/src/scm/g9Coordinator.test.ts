// @effect-diagnostics nodeBuiltinImport:off
/**
 * G9RosterCoordinator tests (WP3 / Task 8).
 *
 * Intended: ten buses (no authority key); withheld spelling; all-or-nothing
 * preflight (two nodes, one bad W1); skip frozen bus on advance; 404/parent
 * reject without admitPublish / G7 mutation.
 * Observed: assertions below via loadG9Package + real DipMuteStore.
 *
 * Does not edit sibling G9 modules. Does not authorize G10.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import type { W1Word } from "./g4Word.ts";
import { loadG8FramingParameters } from "./g8SharedClock.ts";
import { DipMuteStore, STEWARD_ACTOR } from "./g6DipMute.ts";
import { G9RosterCoordinator } from "./g9Coordinator.ts";
import { G9FaultController } from "./g9Fault.ts";
import { G9InvariantFault, type G9FaultSink, type G9Occurrence } from "./g9Occurrence.ts";
import { makeG9Observation } from "./g9Observation.ts";
import { loadG9Package } from "./g9Package.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const ORCH_NODE = "node.orchestration";
const CONTROL_BUS = "bus.control";
const RPC_NODE = "node.rpc";
const RPC_BUS = "bus.rpc";

const captureInput = {
  comm_id: "INV-T2-ORCH-QUEUE" as const,
  phase: "queue-offered" as const,
  input: { command_type: "client" as const },
};

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

/** Inject a FIFO occurrence for a non-slice node (test-only all-or-nothing path). */
const injectFifo = (coordinator: G9RosterCoordinator, occurrence: G9Occurrence): void => {
  const out = coordinator.fifo.admit({
    node_id: occurrence.node_id,
    bus_id: occurrence.origin_bus_id,
    build: () => occurrence,
  });
  assert.equal(out.result.status, "enqueued");
};

describe("G9RosterCoordinator", () => {
  it("constructs ten InProcessOpenLoopBus instances with no authority key", () => {
    const { pkg, coordinator } = makeCoordinator();
    assert.equal(coordinator.buses.size, 10);
    assert.equal(pkg.runtimeBusIds.size, 10);
    assert.equal(coordinator.buses.has("bus.scm.authority"), false);
    for (const busId of pkg.runtimeBusIds) {
      assert.equal(coordinator.buses.has(busId), true);
      assert.equal(coordinator.buses.get(busId)!.fundamentalTimestep, 0);
    }
  });

  it.effect(
    "freeze bus.control → capture is rejected-bus-withheld; sequence advances; no overload",
    () =>
      Effect.gen(function* () {
        const { store, coordinator, faults } = makeCoordinator();
        store.setBusPosition(CONTROL_BUS, "frozen", STEWARD_ACTOR);

        const result = yield* coordinator.captureOccurrence(captureInput);
        assert.equal(result.status, "rejected-bus-withheld");
        if (result.status !== "rejected-bus-withheld") return;
        assert.equal(result.attempt_sequence, 0);
        assert.equal(coordinator.fifo.depth(ORCH_NODE), 0);
        assert.equal(faults.latched(), undefined);
      }),
  );

  it.effect(
    "two nodes, one bad W1 → all-or-nothing: latch once, no publish, fifo/timestep unchanged",
    () =>
      Effect.gen(function* () {
        const { coordinator, faults, store } = makeCoordinator();

        const enqueued = yield* coordinator.captureOccurrence(captureInput);
        assert.equal(enqueued.status, "enqueued");
        assert.equal(coordinator.fifo.depth(ORCH_NODE), 1);

        injectFifo(coordinator, {
          comm_id: "INV-T2-HTTP-META",
          phase_id: "http-request-admitted",
          node_id: RPC_NODE,
          origin_bus_id: RPC_BUS,
          attempt_sequence: 0,
          equality_A: { command_type: "client" },
          semanticKind: "request",
          request_label: "descriptor",
          // Empty state forces toW1 / checkW1Word → w1-invalid during preflight.
          state_label: "",
          retainCurrentAfterPublish: false,
        });
        assert.equal(coordinator.fifo.depth(RPC_NODE), 1);

        const controlBefore = coordinator.buses.get(CONTROL_BUS)!.fundamentalTimestep;
        const rpcBefore = coordinator.buses.get(RPC_BUS)!.fundamentalTimestep;

        const exit = yield* Effect.exit(coordinator.advanceFundamentalTimestep());
        assert.equal(Exit.isFailure(exit), true);
        if (!Exit.isFailure(exit)) return;

        const squashed = Cause.squash(exit.cause);
        assert.equal(squashed instanceof G9InvariantFault, true);
        assert.equal((squashed as G9InvariantFault).code, "w1-invalid");

        assert.ok(faults.latched() instanceof G9InvariantFault);
        assert.equal(faults.latched()?.code, "w1-invalid");

        assert.equal(coordinator.buses.get(CONTROL_BUS)!.read(ORCH_NODE), undefined);
        assert.equal(coordinator.buses.get(RPC_BUS)!.read(RPC_NODE), undefined);
        assert.equal(coordinator.fifo.depth(ORCH_NODE), 1);
        assert.equal(coordinator.fifo.depth(RPC_NODE), 1);
        assert.equal(coordinator.buses.get(CONTROL_BUS)!.fundamentalTimestep, controlBefore);
        assert.equal(coordinator.buses.get(RPC_BUS)!.fundamentalTimestep, rpcBefore);
        assert.equal(store.busPosition(CONTROL_BUS), "live");
        assert.equal(store.busPosition(RPC_BUS), "live");
      }),
  );

  it.effect(
    "freeze one bus; live enqueue commits advances 9 live buses; frozen fifo unchanged",
    () =>
      Effect.gen(function* () {
        const { coordinator, store } = makeCoordinator();

        injectFifo(coordinator, {
          comm_id: "INV-T2-HTTP-META",
          phase_id: "http-request-admitted",
          node_id: RPC_NODE,
          origin_bus_id: RPC_BUS,
          attempt_sequence: 0,
          equality_A: { command_type: "client" },
          semanticKind: "request",
          request_label: "descriptor",
          state_label: "admitted",
          retainCurrentAfterPublish: false,
        });
        const frozenDepthBefore = coordinator.fifo.depth(RPC_NODE);
        store.setBusPosition(RPC_BUS, "frozen", STEWARD_ACTOR);

        const enqueued = yield* coordinator.captureOccurrence(captureInput);
        assert.equal(enqueued.status, "enqueued");

        const result = yield* coordinator.advanceFundamentalTimestep();
        assert.deepEqual(result, { deliveries: [], failures: [] });

        let advanced = 0;
        let frozenStill = 0;
        for (const [busId, bus] of coordinator.buses) {
          if (busId === RPC_BUS) {
            assert.equal(bus.fundamentalTimestep, 0);
            frozenStill += 1;
          } else {
            assert.equal(bus.fundamentalTimestep, 1);
            advanced += 1;
          }
        }
        assert.equal(advanced, 9);
        assert.equal(frozenStill, 1);
        assert.equal(coordinator.fifo.depth(RPC_NODE), frozenDepthBefore);
        assert.equal(coordinator.fifo.depth(ORCH_NODE), 0);
        assert.ok(coordinator.buses.get(CONTROL_BUS)!.read(ORCH_NODE) !== undefined);
      }),
  );

  it("preflight of 404 or parent identity throws without admitPublish or G7 mutation", () => {
    const { coordinator, store, pkg } = makeCoordinator();
    const row = pkg.rowsByCommId.get("INV-T2-ORCH-QUEUE");
    assert.ok(row !== undefined);

    const baseWord: W1Word = {
      bus_id: CONTROL_BUS,
      node_id: ORCH_NODE,
      fundamental_state: "offered",
      fundamental_request: "client",
      state_age: 0,
      request_age: 0,
      modifier_start: "modifier_start",
      null: "null",
      modifiers: [],
    };

    const positionsBefore = [...coordinator.buses.keys()].map((id) => ({
      id,
      position: store.busPosition(id),
      timestep: coordinator.buses.get(id)!.fundamentalTimestep,
    }));

    // Design check order: 404/parent fail closed as G9InvariantFault before any
    // admitPublish. Exact code may be placement (checks 2–3) or reserved/authority
    // (checks 4–5) depending on which gate fires first for the crafted identity.
    let reservedErr: unknown;
    try {
      coordinator.admitShadowPublish({ ...baseWord, node_id: "node.observer.404" }, row!);
    } catch (err) {
      reservedErr = err;
    }
    assert.ok(reservedErr instanceof G9InvariantFault);

    let parentErr: unknown;
    try {
      coordinator.admitShadowPublish(
        {
          ...baseWord,
          node_id: "node.scm.authority",
          bus_id: "bus.scm.authority",
        },
        row!,
      );
    } catch (err) {
      parentErr = err;
    }
    assert.ok(parentErr instanceof G9InvariantFault);

    for (const before of positionsBefore) {
      assert.equal(store.busPosition(before.id), before.position);
      assert.equal(coordinator.buses.get(before.id)!.fundamentalTimestep, before.timestep);
      assert.equal(coordinator.buses.get(before.id)!.read(ORCH_NODE), undefined);
    }
  });

  it.effect("wrong capture placement fails with placement (not a capture result)", () =>
    Effect.gen(function* () {
      const { coordinator } = makeCoordinator();
      const exit = yield* Effect.exit(
        coordinator.captureOccurrence({
          // @ts-expect-error intentional bad comm_id for placement fault
          comm_id: "INV-T2-NOT-A-ROW",
          phase: "queue-offered",
          input: { command_type: "client" },
        }),
      );
      assert.equal(Exit.isFailure(exit), true);
      if (!Exit.isFailure(exit)) return;
      const squashed = Cause.squash(exit.cause);
      assert.equal(squashed instanceof G9InvariantFault, true);
      assert.equal((squashed as G9InvariantFault).code, "placement");
    }),
  );
});

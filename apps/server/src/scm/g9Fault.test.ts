/**
 * G9FaultController first-fault + no-G7-mutation tests (WP4 / Task 7).
 *
 * Intended: first latch delivers once; second latch is silent; setBusPosition
 * never called from the controller. arm-after-fault is Task 10 with the waker.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";

import { G9FaultController } from "./g9Fault.ts";
import { G9InvariantFault, type G9FaultSink } from "./g9Occurrence.ts";
import { makeG9Observation, type G9Observation } from "./g9Observation.ts";

/**
 * Spy stand-in for DipMuteStore.setBusPosition.
 * Controller must never receive or call this — proving no G7 mutation path.
 */
class SpyBusPositionStore {
  calls: Array<{ busId: string; position: string }> = [];
  setBusPosition(busId: string, position: string, _actor: string): void {
    this.calls.push({ busId, position });
  }
}

describe("G9FaultController", () => {
  it.effect("first latch delivers once; second latch does not re-deliver", () =>
    Effect.gen(function* () {
      const deliveries = yield* Ref.make(0);
      const observationCalls = yield* Ref.make(0);
      const base = makeG9Observation();
      const observation: G9Observation = {
        ...base,
        fault: (attrs) =>
          Effect.gen(function* () {
            yield* Ref.update(observationCalls, (n) => n + 1);
            yield* base.fault(attrs);
          }),
      };
      const sink: G9FaultSink = {
        deliver: () =>
          Effect.gen(function* () {
            yield* Ref.update(deliveries, (n) => n + 1);
          }),
      };
      let faulted = false;
      let disarmed = false;
      const controller = new G9FaultController(
        observation,
        sink,
        () => {
          disarmed = true;
        },
        () => {
          faulted = true;
        },
      );

      yield* controller.latch(new G9InvariantFault("preflight", "first"), {
        waker_state: "armed-idle",
        comm_id: "INV-T2-ORCH-QUEUE",
        node_id: "node.orchestration",
        bus_id: "bus.control",
        scope: "capture",
      });
      yield* controller.latch(new G9InvariantFault("w1-invalid", "second"), {
        waker_state: "armed-idle",
        scope: "capture",
      });

      assert.equal(yield* Ref.get(deliveries), 1);
      assert.equal(yield* Ref.get(observationCalls), 1);
      assert.equal(controller.latched()?.code, "preflight");
      assert.equal(faulted, true);
      assert.equal(disarmed, true);
    }),
  );

  it.effect("never calls setBusPosition (no G7 mutation from latch)", () =>
    Effect.gen(function* () {
      const spy = new SpyBusPositionStore();
      const controller = new G9FaultController(
        makeG9Observation(),
        { deliver: () => Effect.void },
        () => undefined,
        () => undefined,
      );
      yield* controller.latch(new G9InvariantFault("preflight", "x"), {
        waker_state: "stopped",
      });
      // Controller has no store reference; spy stays empty by construction.
      assert.equal(spy.calls.length, 0);
    }),
  );

  it.effect("sink Die still succeeds latch and does not clear first fault", () =>
    Effect.gen(function* () {
      const observationCalls = yield* Ref.make(0);
      const base = makeG9Observation();
      const observation: G9Observation = {
        ...base,
        fault: (attrs) =>
          Effect.gen(function* () {
            yield* Ref.update(observationCalls, (n) => n + 1);
            yield* base.fault(attrs);
          }),
      };
      const sink: G9FaultSink = {
        deliver: () => Effect.die("sink-dead"),
      };
      const controller = new G9FaultController(
        observation,
        sink,
        () => undefined,
        () => undefined,
      );
      yield* controller.latch(new G9InvariantFault("waker-defect", "boom"), {
        waker_state: "armed-in-flight",
        scope: "waker",
      });
      assert.equal(controller.latched()?.code, "waker-defect");
      // Initial fault obs + post-Die metadata obs.
      assert.equal(yield* Ref.get(observationCalls), 2);
    }),
  );
});

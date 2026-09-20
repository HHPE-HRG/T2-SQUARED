import { assert, describe, it } from "@effect/vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";

import { checkW1Word } from "./g4Word.ts";
import { InProcessOpenLoopBus } from "./g5OpenLoop.ts";
import { BidirectionalHomeBusLink } from "./g6HomeBusLink.ts";
import {
  G8_PRODUCER_NAME,
  loadG8FramingParameters,
  SharedFundamentalClock,
} from "./g8SharedClock.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const fixture = () => {
  const busA = new InProcessOpenLoopBus();
  const busB = new InProcessOpenLoopBus();
  const link = new BidirectionalHomeBusLink({
    buses: new Map([
      ["bus.rpc", busA],
      ["bus.control", busB],
    ]),
    routes: [
      {
        route_id: "route.rpc-to-control",
        source_bus_id: "bus.rpc",
        destination_bus_id: "bus.control",
        allowed_origin_node_ids: ["node.rpc"],
        enabled: true,
      },
      {
        route_id: "route.control-to-rpc",
        source_bus_id: "bus.control",
        destination_bus_id: "bus.rpc",
        allowed_origin_node_ids: ["node.orchestration"],
        enabled: true,
      },
    ],
  });
  return { busA, busB, clock: new SharedFundamentalClock(link) };
};

describe("shared SCM fundamental clock", () => {
  it("names the in-process producer scm.fundamental-clock and loads framing placeholders", () => {
    const { clock } = fixture();
    assert.equal(G8_PRODUCER_NAME, "scm.fundamental-clock");
    assert.equal(clock.producer_name, G8_PRODUCER_NAME);
    assert.deepEqual(loadG8FramingParameters(repoRoot), {
      producer_name: "scm.fundamental-clock",
      modifier_start: "modifier_start",
      null: "null",
      words_per_node_per_fundamental_timestep: 1,
    });
  });

  it.effect("advances every elapsed fundamental timestep in order", () =>
    Effect.gen(function* () {
      const { busA, busB, clock } = fixture();
      const checked = checkW1Word({
        bus_id: "bus.rpc",
        node_id: "node.rpc",
        fundamental_state: "active",
        fundamental_request: "need-control",
        state_age: 0,
        request_age: 0,
        modifier_start: "modifier_start",
        null: "null",
      });
      if (!checked.ok) throw new Error("fixture W1 must be valid");

      busA.publish(checked.word);
      clock.start();
      const deliveries = yield* clock.advanceProcessInterval(2);

      assert.equal(clock.currentFundamentalTimestep, 2);
      assert.equal(deliveries.deliveries.length, 1);
      assert.deepEqual(deliveries.failures, []);
      assert.equal(busB.read("node.rpc")?.fundamental_request, "need-control");
    }),
  );

  it.effect("does not advance before start or after stop", () =>
    Effect.gen(function* () {
      const { clock } = fixture();
      assert.equal(Exit.isFailure(yield* clock.advanceProcessInterval(1).pipe(Effect.exit)), true);
      clock.start();
      yield* clock.advanceProcessInterval(1);
      clock.stop();
      assert.equal(Exit.isFailure(yield* clock.advanceProcessInterval(1).pipe(Effect.exit)), true);
      assert.equal(clock.currentFundamentalTimestep, 1);
    }),
  );

  it.effect("rejects invalid elapsed timestep counts", () =>
    Effect.gen(function* () {
      const { clock } = fixture();
      clock.start();
      for (const count of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        const exit = yield* clock.advanceProcessInterval(count).pipe(Effect.exit);
        assert.equal(Exit.isFailure(exit), true, String(count));
      }
      assert.equal(clock.currentFundamentalTimestep, 0);
    }),
  );

  it.effect("rejects overlap and clears guard after completion", () =>
    Effect.gen(function* () {
      const entered = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const target = {
        advanceFundamentalTimestep: () =>
          Effect.gen(function* () {
            yield* Deferred.succeed(entered, undefined);
            yield* Deferred.await(release);
            return { deliveries: [], failures: [] };
          }),
      };
      const clock = new SharedFundamentalClock(target);
      clock.start();

      const first = yield* clock
        .advanceProcessInterval(1)
        .pipe(Effect.forkChild({ startImmediately: true }));
      yield* Deferred.await(entered);
      const overlap = yield* clock.advanceProcessInterval(1).pipe(Effect.exit);
      assert.equal(Exit.isFailure(overlap), true);

      yield* Deferred.succeed(release, undefined);
      yield* Fiber.join(first);
      const later = yield* clock.advanceProcessInterval(1);
      assert.deepEqual(later, { deliveries: [], failures: [] });
      assert.equal(clock.currentFundamentalTimestep, 2);
    }),
  );

  it.effect("treats zero elapsed timesteps as a no-op", () =>
    Effect.gen(function* () {
      const { clock } = fixture();
      clock.start();
      const zero = yield* clock.advanceProcessInterval(0);
      assert.deepEqual(zero, { deliveries: [], failures: [] });
      assert.equal(clock.currentFundamentalTimestep, 0);
    }),
  );
});

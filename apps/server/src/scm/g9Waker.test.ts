// @effect-diagnostics nodeBuiltinImport:off
/**
 * G9Waker four-state / skip-if-busy / defect isolation tests (WP4 / Task 10).
 *
 * Intended: stopped/faulted ticks do not call the clock; tick stays never;
 * waker-defect on Die; start once; skip-if-busy; arm after fault stays faulted;
 * n from runtime-parameters.json; disarm does not clock.stop().
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Ref from "effect/Ref";

import {
  SharedClockFailure,
  SharedFundamentalClock,
  type FundamentalTimestepTarget,
} from "./g8SharedClock.ts";
import { G9InvariantFault, type G9FaultSink } from "./g9Occurrence.ts";
import { makeG9Observation, type G9Observation } from "./g9Observation.ts";
import { makeG9Waker } from "./g9Waker.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const liveN = (): number => {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g9/runtime-parameters.json"), "utf8"),
  ) as { live_process_interval_fundamental_timesteps: number };
  return raw.live_process_interval_fundamental_timesteps;
};

describe("G9Waker", () => {
  it.effect("stopped and faulted ticks do not call the clock", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make(0);
      const target: FundamentalTimestepTarget<G9InvariantFault> = {
        advanceFundamentalTimestep: () =>
          Effect.gen(function* () {
            yield* Ref.update(calls, (n) => n + 1);
            return { deliveries: [], failures: [] };
          }),
      };
      const clock = new SharedFundamentalClock(target);
      const { waker } = makeG9Waker({
        clock,
        observation: makeG9Observation(),
        n: liveN(),
        sink: { deliver: () => Effect.void },
      });

      yield* waker.tick();
      assert.equal(waker.state(), "stopped");
      assert.equal(yield* Ref.get(calls), 0);

      waker.markFaulted();
      yield* waker.tick();
      assert.equal(waker.state(), "faulted");
      assert.equal(yield* Ref.get(calls), 0);
    }),
  );

  it.effect("tick stays never when link fails G9InvariantFault", () =>
    Effect.gen(function* () {
      const sinkCodes = yield* Ref.make<string[]>([]);
      const target: FundamentalTimestepTarget<G9InvariantFault> = {
        advanceFundamentalTimestep: () => Effect.fail(new G9InvariantFault("preflight", "link")),
      };
      const clock = new SharedFundamentalClock(target);
      const sink: G9FaultSink = {
        deliver: (fault) =>
          Effect.gen(function* () {
            yield* Ref.update(sinkCodes, (xs) => [...xs, fault.code]);
          }),
      };
      const { waker } = makeG9Waker({
        clock,
        observation: makeG9Observation(),
        n: liveN(),
        sink,
      });
      waker.arm();
      const exit = yield* waker.tick().pipe(Effect.exit);
      assert.equal(Exit.isSuccess(exit), true);
      assert.equal(waker.state(), "faulted");
      assert.deepEqual(yield* Ref.get(sinkCodes), ["preflight"]);
    }),
  );

  it.effect("SharedClockFailure overlap latches clock-overlap", () =>
    Effect.gen(function* () {
      const sinkCodes = yield* Ref.make<string[]>([]);
      const entered = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const target: FundamentalTimestepTarget<G9InvariantFault> = {
        advanceFundamentalTimestep: () =>
          Effect.gen(function* () {
            yield* Deferred.succeed(entered, undefined);
            yield* Deferred.await(release);
            return { deliveries: [], failures: [] };
          }),
      };
      const clock = new SharedFundamentalClock(target);
      const sink: G9FaultSink = {
        deliver: (fault) =>
          Effect.gen(function* () {
            yield* Ref.update(sinkCodes, (xs) => [...xs, fault.code]);
          }),
      };
      const { waker } = makeG9Waker({
        clock,
        observation: makeG9Observation(),
        n: liveN(),
        sink,
      });
      // Arm starts the clock once; hold advancing via a direct process interval.
      waker.arm();
      const first = yield* clock
        .advanceProcessInterval(liveN())
        .pipe(Effect.forkChild({ startImmediately: true }));
      yield* Deferred.await(entered);
      assert.equal(waker.state(), "armed-idle");

      const exit = yield* waker.tick().pipe(Effect.exit);
      assert.equal(Exit.isSuccess(exit), true);
      assert.equal(waker.state(), "faulted");
      assert.deepEqual(yield* Ref.get(sinkCodes), ["clock-overlap"]);

      yield* Deferred.succeed(release, undefined);
      yield* Fiber.join(first);
    }),
  );

  it.effect("Die during advance → waker-defect once, not stuck in-flight", () =>
    Effect.gen(function* () {
      const sinkCodes = yield* Ref.make<string[]>([]);
      const target: FundamentalTimestepTarget<G9InvariantFault> = {
        advanceFundamentalTimestep: () => Effect.die("admitPublish-boom"),
      };
      const clock = new SharedFundamentalClock(target);
      const sink: G9FaultSink = {
        deliver: (fault) =>
          Effect.gen(function* () {
            yield* Ref.update(sinkCodes, (xs) => [...xs, fault.code]);
          }),
      };
      const { waker } = makeG9Waker({
        clock,
        observation: makeG9Observation(),
        n: liveN(),
        sink,
      });
      waker.arm();
      const exit = yield* waker.tick().pipe(Effect.exit);
      assert.equal(Exit.isSuccess(exit), true);
      assert.equal(waker.state(), "faulted");
      assert.notEqual(waker.state(), "armed-in-flight");
      assert.deepEqual(yield* Ref.get(sinkCodes), ["waker-defect"]);
    }),
  );

  it.effect("start once per clock; success uses n from runtime-parameters", () =>
    Effect.gen(function* () {
      const startCalls = yield* Ref.make(0);
      const elapsedCalls = yield* Ref.make<number[]>([]);
      const n = liveN();
      const target: FundamentalTimestepTarget<G9InvariantFault> = {
        advanceFundamentalTimestep: () => Effect.succeed({ deliveries: [], failures: [] }),
      };
      const baseClock = new SharedFundamentalClock(target);
      const clock = new Proxy(baseClock, {
        get(obj, prop, receiver) {
          if (prop === "start") {
            return () => {
              Effect.runSync(Ref.update(startCalls, (c) => c + 1));
              return obj.start();
            };
          }
          if (prop === "advanceProcessInterval") {
            return (elapsed: number) => {
              Effect.runSync(Ref.update(elapsedCalls, (xs) => [...xs, elapsed]));
              return obj.advanceProcessInterval(elapsed);
            };
          }
          return Reflect.get(obj, prop, receiver);
        },
      }) as SharedFundamentalClock<G9InvariantFault>;

      const { waker } = makeG9Waker({
        clock,
        observation: makeG9Observation(),
        n,
        sink: { deliver: () => Effect.void },
      });
      waker.arm();
      yield* waker.tick();
      assert.equal(waker.state(), "armed-idle");
      waker.disarm();
      waker.arm();
      yield* waker.tick();
      assert.equal(yield* Ref.get(startCalls), 1);
      assert.deepEqual(yield* Ref.get(elapsedCalls), [n, n]);
    }),
  );

  it.effect("skip-if-busy increments wake skipped and does not re-enter clock", () =>
    Effect.gen(function* () {
      const entered = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const advanceCalls = yield* Ref.make(0);
      const skipped = yield* Ref.make(0);
      const target: FundamentalTimestepTarget<G9InvariantFault> = {
        advanceFundamentalTimestep: () =>
          Effect.gen(function* () {
            yield* Ref.update(advanceCalls, (c) => c + 1);
            yield* Deferred.succeed(entered, undefined);
            yield* Deferred.await(release);
            return { deliveries: [], failures: [] };
          }),
      };
      const clock = new SharedFundamentalClock(target);
      const base = makeG9Observation();
      const observation: G9Observation = {
        ...base,
        incWakeSkipped: () =>
          Effect.gen(function* () {
            yield* Ref.update(skipped, (c) => c + 1);
            yield* base.incWakeSkipped();
          }),
      };
      const { waker } = makeG9Waker({
        clock,
        observation,
        n: liveN(),
        sink: { deliver: () => Effect.void },
      });
      waker.arm();
      const first = yield* waker.tick().pipe(Effect.forkChild({ startImmediately: true }));
      yield* Deferred.await(entered);
      assert.equal(waker.state(), "armed-in-flight");
      yield* waker.tick();
      assert.equal(yield* Ref.get(skipped), 1);
      assert.equal(yield* Ref.get(advanceCalls), 1);
      yield* Deferred.succeed(release, undefined);
      yield* Fiber.join(first);
      assert.equal(waker.state(), "armed-idle");
    }),
  );

  it.effect("arm after G9 fault leaves faulted; disarm from faulted stays faulted", () =>
    Effect.gen(function* () {
      const target: FundamentalTimestepTarget<G9InvariantFault> = {
        advanceFundamentalTimestep: () => Effect.fail(new G9InvariantFault("preflight", "x")),
      };
      const clock = new SharedFundamentalClock(target);
      const { waker } = makeG9Waker({
        clock,
        observation: makeG9Observation(),
        n: liveN(),
        sink: { deliver: () => Effect.void },
      });
      waker.arm();
      yield* waker.tick();
      assert.equal(waker.state(), "faulted");
      waker.arm();
      assert.equal(waker.state(), "faulted");
      waker.disarm();
      assert.equal(waker.state(), "faulted");
    }),
  );

  it.effect("disarm while hung does not call clock.stop", () =>
    Effect.gen(function* () {
      const entered = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      let stopCalls = 0;
      const target: FundamentalTimestepTarget<G9InvariantFault> = {
        advanceFundamentalTimestep: () =>
          Effect.gen(function* () {
            yield* Deferred.succeed(entered, undefined);
            yield* Deferred.await(release);
            return { deliveries: [], failures: [] };
          }),
      };
      const baseClock = new SharedFundamentalClock(target);
      const clock = new Proxy(baseClock, {
        get(obj, prop, receiver) {
          if (prop === "stop") {
            return () => {
              stopCalls += 1;
              return obj.stop();
            };
          }
          return Reflect.get(obj, prop, receiver);
        },
      }) as SharedFundamentalClock<G9InvariantFault>;

      const { waker } = makeG9Waker({
        clock,
        observation: makeG9Observation(),
        n: liveN(),
        sink: { deliver: () => Effect.void },
      });
      waker.arm();
      const first = yield* waker.tick().pipe(Effect.forkChild({ startImmediately: true }));
      yield* Deferred.await(entered);
      waker.disarm();
      assert.equal(waker.state(), "stopped");
      assert.equal(stopCalls, 0);
      yield* Deferred.succeed(release, undefined);
      yield* Fiber.join(first);
      assert.equal(waker.state(), "stopped");
      assert.equal(stopCalls, 0);
    }),
  );

  it("non-overlap SharedClockFailure messages are not clock-overlap", () => {
    const notRunning = new SharedClockFailure("fundamental clock is not running");
    const badCount = new SharedClockFailure(
      "elapsed fundamental timesteps must be a non-negative integer",
    );
    assert.notEqual(notRunning.message, "process interval advance already active");
    assert.notEqual(badCount.message, "process interval advance already active");
  });
});

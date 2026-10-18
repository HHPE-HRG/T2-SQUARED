/**
 * G9 four-state process-interval waker (WP4 / Task 10).
 *
 * Intended: states stopped | armed-idle | armed-in-flight | faulted; skip-if-busy;
 * n from package live_process_interval_fundamental_timesteps (not a TS literal);
 * SharedFundamentalClock<G9InvariantFault>; tick returns never and isolates
 * G9InvariantFault / SharedClockFailure(clock-overlap) / defects as waker-defect.
 * No setTimeout / wall sleep. No clock.stop from disarm or latch.
 *
 * Observed: start() once per clock; disarm from faulted stays faulted; success
 * settles armed-in-flight → armed-idle unless disarm already set stopped or
 * latch set faulted. Interruption-only causes do not latch.
 *
 * Does not own coordinator commit. Does not authorize G10.
 */
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { G9FaultController } from "./g9Fault.ts";
import { G9InvariantFault, type G9FaultSink, type G9WakerState } from "./g9Occurrence.ts";
import type { G9Observation } from "./g9Observation.ts";
import { SharedClockFailure, SharedFundamentalClock } from "./g8SharedClock.ts";

/** Bound defect message length for waker-defect latch. */
const WAKER_DEFECT_MESSAGE_MAX = 200;

/**
 * Four-state G9 waker over a shared fundamental clock.
 *
 * Parameters
 * ----------
 * clock : SharedFundamentalClock<G9InvariantFault>
 *     Process-interval driver (G9 link error channel).
 * faults : G9FaultController
 *     First-fault latch + sink.
 * observation : G9Observation
 *     Skip counter emitter.
 * n : number
 *     pkg.parameters.live_process_interval_fundamental_timesteps.
 */
export class G9Waker {
  private current: G9WakerState = "stopped";
  private clockStarted = false;
  private readonly clock: SharedFundamentalClock<G9InvariantFault>;
  private readonly faults: G9FaultController;
  private readonly observation: G9Observation;
  private readonly n: number;

  constructor(
    clock: SharedFundamentalClock<G9InvariantFault>,
    faults: G9FaultController,
    observation: G9Observation,
    n: number,
  ) {
    this.clock = clock;
    this.faults = faults;
    this.observation = observation;
    this.n = n;
  }

  /** Current waker lifecycle state. */
  state(): G9WakerState {
    return this.current;
  }

  /**
   * Arm the waker. stopped → armed-idle; starts the clock once.
   * faulted: no-op (no resume). Does not call start() again after first start.
   */
  arm(): void {
    if (this.current === "faulted") {
      return;
    }
    if (this.current === "stopped") {
      this.current = "armed-idle";
      if (!this.clockStarted) {
        this.clock.start();
        this.clockStarted = true;
      }
    }
  }

  /**
   * Stop future ticks from this waker. Not clock.stop().
   * armed-idle / armed-in-flight → stopped. faulted stays faulted.
   * In-flight advance is not cancelled; ensuring still clears advancing.
   */
  disarm(): void {
    if (this.current === "faulted") {
      return;
    }
    if (this.current === "armed-idle" || this.current === "armed-in-flight") {
      this.current = "stopped";
    }
  }

  /**
   * Latch / fault-controller hook: mark faulted (before disarm).
   * Intended: no path back to stopped via arm().
   */
  markFaulted(): void {
    this.current = "faulted";
  }

  /**
   * One wake attempt. Returns never.
   *
   * Intended: skip-if-busy; isolate clock/link/defect failures into latch;
   * interruption-only does not latch. Observed: never leaves armed-in-flight
   * after a defect; success returns to armed-idle unless disarm/fault won.
   */
  tick(): Effect.Effect<void, never> {
    if (this.current === "stopped" || this.current === "faulted") {
      return Effect.void;
    }
    if (this.current === "armed-in-flight") {
      return this.observation.incWakeSkipped();
    }

    this.current = "armed-in-flight";
    const self = this;
    const wakerStateAtTick: G9WakerState = "armed-in-flight";

    return Effect.gen(function* () {
      const exit = yield* Effect.exit(self.clock.advanceProcessInterval(self.n));

      if (Exit.isSuccess(exit)) {
        if (self.current === "armed-in-flight") {
          self.current = "armed-idle";
        }
        return;
      }

      if (Cause.hasInterruptsOnly(exit.cause)) {
        if (self.current === "armed-in-flight") {
          self.current = "armed-idle";
        }
        return;
      }

      const squashed = Cause.squash(exit.cause);
      const latchCtx = { scope: "waker" as const, waker_state: wakerStateAtTick };

      if (squashed instanceof G9InvariantFault) {
        yield* self.faults.latch(squashed, latchCtx);
        return;
      }

      if (
        squashed instanceof SharedClockFailure &&
        squashed.message === "process interval advance already active"
      ) {
        yield* self.faults.latch(new G9InvariantFault("clock-overlap", squashed.message), latchCtx);
        return;
      }

      const message = boundDefectMessage(squashed);
      yield* self.faults.latch(new G9InvariantFault("waker-defect", message), latchCtx);
      // Latch markFaulted must have run; never remain armed-in-flight after defect.
      if (self.current === "armed-in-flight") {
        self.current = "faulted";
      }
    }).pipe(Effect.catchCause(() => Effect.void));
  }
}

/**
 * Bound a squashed defect into a finite latch message.
 *
 * Parameters
 * ----------
 * squashed : unknown
 *     Cause.squash result.
 *
 * Returns
 * -------
 * string
 *     Truncated message for G9InvariantFault("waker-defect", …).
 */
const boundDefectMessage = (squashed: unknown): string => {
  if (typeof squashed === "string") {
    return squashed.slice(0, WAKER_DEFECT_MESSAGE_MAX);
  }
  if (squashed instanceof Error) {
    return squashed.message.slice(0, WAKER_DEFECT_MESSAGE_MAX);
  }
  return "waker defect";
};

/**
 * Wire fault-controller callbacks to a waker instance.
 *
 * Intended: setWakerFaulted then wakerDisarm order from latch; disarm leaves
 * faulted alone. Observed: factory avoids circular construct-time capture.
 *
 * Parameters
 * ----------
 * clock / observation / n / sink : wired into waker + controller.
 *
 * Returns
 * -------
 * { waker, faults }
 */
export const makeG9Waker = (args: {
  readonly clock: SharedFundamentalClock<G9InvariantFault>;
  readonly observation: G9Observation;
  readonly n: number;
  readonly sink: G9FaultSink;
}): { readonly waker: G9Waker; readonly faults: G9FaultController } => {
  let waker!: G9Waker;
  const faults = new G9FaultController(
    args.observation,
    args.sink,
    () => waker.disarm(),
    () => waker.markFaulted(),
  );
  waker = new G9Waker(args.clock, faults, args.observation, args.n);
  return { waker, faults };
};

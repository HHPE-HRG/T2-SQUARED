/**
 * Shared fundamental-clock driver for the bounded home-bus link.
 *
 * One process interval may advance N timesteps. No production clock.
 */
import * as Effect from "effect/Effect";

import {
  type BridgeAdvanceResult,
  type BridgeDelivery,
  type BridgeRouteFailure,
  type HomeBusLinkFailure,
} from "./g6HomeBusLink.ts";

export class SharedClockFailure extends Error {
  readonly _tag = "SharedClockFailure";
}

export interface SharedProcessIntervalResult {
  readonly deliveries: ReadonlyArray<BridgeDelivery>;
  readonly failures: ReadonlyArray<BridgeRouteFailure>;
}

export interface FundamentalTimestepTarget {
  advanceFundamentalTimestep(): Effect.Effect<BridgeAdvanceResult, HomeBusLinkFailure>;
}

/**
 * Injectable shared fundamental clock for two linked home buses.
 *
 * Parameters
 * ----------
 * link : FundamentalTimestepTarget
 *     Coordinator that advances one fundamental timestep.
 *
 * Returns
 * -------
 * SharedFundamentalClock
 *     Start/stop driver with overlap guard.
 *
 * Example
 * -------
 * const clock = new SharedFundamentalClock(link);
 * clock.start();
 * yield* clock.advanceProcessInterval(2);
 */
export class SharedFundamentalClock {
  currentFundamentalTimestep = 0;
  private running = false;
  private advancing = false;
  private readonly link: FundamentalTimestepTarget;

  constructor(link: FundamentalTimestepTarget) {
    this.link = link;
  }

  /**
   * Arm the clock so process intervals may run.
   *
   * Parameters
   * ----------
   * none
   *
   * Returns
   * -------
   * void
   *
   * Example
   * -------
   * clock.start();
   */
  start(): void {
    if (this.running) {
      throw new SharedClockFailure("fundamental clock already started");
    }
    this.running = true;
  }

  /**
   * Disarm the clock. Later intervals fail.
   *
   * Parameters
   * ----------
   * none
   *
   * Returns
   * -------
   * void
   *
   * Example
   * -------
   * clock.stop();
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Advance N fundamental timesteps in order.
   *
   * Parameters
   * ----------
   * elapsedFundamentalTimesteps : number
   *     Non-negative integer. Zero is a no-op.
   *
   * Returns
   * -------
   * Effect.Effect
   *     Aggregated deliveries and failures.
   *
   * Example
   * -------
   * const result = yield* clock.advanceProcessInterval(2);
   */
  advanceProcessInterval(
    elapsedFundamentalTimesteps: number,
  ): Effect.Effect<SharedProcessIntervalResult, SharedClockFailure | HomeBusLinkFailure> {
    if (!this.running) {
      return Effect.fail(new SharedClockFailure("fundamental clock is not running"));
    }
    if (!Number.isInteger(elapsedFundamentalTimesteps) || elapsedFundamentalTimesteps < 0) {
      return Effect.fail(
        new SharedClockFailure("elapsed fundamental timesteps must be a non-negative integer"),
      );
    }
    if (this.advancing) {
      return Effect.fail(new SharedClockFailure("process interval advance already active"));
    }

    this.advancing = true;
    const link = this.link;
    const bumpTimestep = () => {
      this.currentFundamentalTimestep += 1;
    };
    const clearAdvancing = () => {
      this.advancing = false;
    };
    return Effect.gen(function* () {
      const deliveries: BridgeDelivery[] = [];
      const failures: BridgeRouteFailure[] = [];
      for (let index = 0; index < elapsedFundamentalTimesteps; index += 1) {
        const result = yield* link.advanceFundamentalTimestep();
        deliveries.push(...result.deliveries);
        failures.push(...result.failures);
        bumpTimestep();
      }
      return { deliveries, failures };
    }).pipe(Effect.ensuring(Effect.sync(clearAdvancing)));
  }
}

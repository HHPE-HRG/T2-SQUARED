/**
 * Shared fundamental-clock driver for the bounded home-bus link.
 *
 * One process interval may advance N timesteps. No production clock.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as Effect from "effect/Effect";

import {
  type BridgeAdvanceResult,
  type BridgeDelivery,
  type BridgeRouteFailure,
  type HomeBusLinkFailure,
} from "./g6HomeBusLink.ts";

/**
 * In-process G8 timestep producer name. Prototype string, not a node_id.
 *
 * Parameters
 * ----------
 * none
 *
 * Returns
 * -------
 * "scm.fundamental-clock"
 *
 * Example
 * -------
 * assert.equal(clock.producer_name, G8_PRODUCER_NAME);
 */
export const G8_PRODUCER_NAME = "scm.fundamental-clock" as const;

/**
 * Framing placeholders loaded from docs/scm/g8/framing-parameters.json.
 *
 * Named strings only; G8 does not encode modifier_start or null as wire values.
 */
export interface G8FramingParameters {
  readonly producer_name: typeof G8_PRODUCER_NAME;
  readonly modifier_start: "modifier_start";
  readonly null: "null";
  readonly words_per_node_per_fundamental_timestep: 1;
}

/**
 * Load G8 framing placeholders from the repo fixture.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     T2-SQUARED repository root.
 *
 * Returns
 * -------
 * G8FramingParameters
 *     Producer name and named placeholders (not encodings).
 *
 * Example
 * -------
 * const framing = loadG8FramingParameters(repoRoot);
 */
export const loadG8FramingParameters = (repoRoot: string): G8FramingParameters =>
  JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g8/framing-parameters.json"), "utf8"),
  ) as G8FramingParameters;

/**
 * Integer ages for the next published word.
 *
 * First word is `{0, 0}`. Same request keeps `request_age`; a new request
 * resets it to 0. Same state increments `state_age`; a new state resets it.
 * The two columns are independent: a request change does not reset
 * `state_age` by itself.
 */
export interface AgePair {
  readonly state_age: number;
  readonly request_age: number;
}

/**
 * Apply the G8 age/repeat table to the next state and request values.
 *
 * Parameters
 * ----------
 * previous : { fundamental_state, fundamental_request, state_age, request_age } | undefined
 *     Prior published word, or undefined for the first word on a node.
 * nextState : string
 *     Next `fundamental_state`.
 * nextRequest : string
 *     Next `fundamental_request`.
 *
 * Returns
 * -------
 * AgePair
 *     `state_age` and `request_age` for the next word.
 *
 * Example
 * -------
 * nextAges(undefined, "active", "need-control");
 * nextAges(
 *   { fundamental_state: "active", fundamental_request: "need-control", state_age: 5, request_age: 2 },
 *   "active",
 *   "need-halt",
 * );
 */
export const nextAges = (
  previous:
    | {
        fundamental_state: string;
        fundamental_request: string;
        state_age: number;
        request_age: number;
      }
    | undefined,
  nextState: string,
  nextRequest: string,
): AgePair => {
  if (previous === undefined) {
    return { state_age: 0, request_age: 0 };
  }
  return {
    state_age: previous.fundamental_state === nextState ? previous.state_age + 1 : 0,
    request_age: previous.fundamental_request === nextRequest ? previous.request_age : 0,
  };
};

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
  readonly producer_name = G8_PRODUCER_NAME;
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

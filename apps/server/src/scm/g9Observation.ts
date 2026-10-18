/**
 * G9 Effectful observation catalog emitters + dying-observer sandbox (WP4 / Task 6).
 *
 * Intended: emit only catalog span names and metric names; fault attrs are the
 * exact five-key allowlist (required fault_code + waker_state; optional identities
 * omitted when absent — never fabricated). Each method sandboxes internally so a
 * dying observer cannot fail the caller or mutate coordinator protocol. Adapters
 * never import this module.
 *
 * Observed: withOwnedSpan for the three G9-owned spans; Effect Metric for the
 * four underscored counters/gauge; sandboxObserve = catchAllCause → void.
 *
 * Does not own FIFO mutate, latch, or waker state. Does not authorize G10.
 */
import type { Attributes } from "@opentelemetry/api";
import * as Effect from "effect/Effect";
import * as Metric from "effect/Metric";

import { withOwnedSpan } from "../t2Observability/T2Observability.ts";

import type { G9FaultCode, G9OverloadReason, G9WakerState } from "./g9Occurrence.ts";

/** Catalog span names (observation-catalog.json g9_owned_span_names). */
const SPAN_OVERLOAD_START = "t2.scm.shadow.overload.start";
const SPAN_OVERLOAD_RECOVERED = "t2.scm.shadow.overload.recovered";
const SPAN_FAULT = "t2.scm.shadow.fault";

/** Catalog metric names (observation-catalog.json metrics). */
const METRIC_WAKE_SKIPPED = Metric.counter("t2_scm_shadow_wake_skipped_total");
const METRIC_FIFO_DEPTH = Metric.gauge("t2_scm_shadow_fifo_depth");
const METRIC_REJECTED_CAPACITY = Metric.counter("t2_scm_shadow_rejected_capacity_total");
const METRIC_REJECTED_WITHHELD = Metric.counter("t2_scm_shadow_rejected_withheld_total");

/**
 * Closed G9 observation surface used by coordinator / fault / waker.
 *
 * Every method returns Effect<void, never> (internal sandbox).
 */
export interface G9Observation {
  readonly overloadStart: (attrs: {
    readonly node_id: string;
    readonly bus_id: string;
    readonly fifo_depth: number;
    readonly reason: G9OverloadReason;
  }) => Effect.Effect<void, never>;
  readonly overloadRecovered: (attrs: {
    readonly node_id: string;
    readonly bus_id: string;
    readonly fifo_depth: number;
    readonly reason: G9OverloadReason;
  }) => Effect.Effect<void, never>;
  /**
   * Agent RFC-020: exact five-key allowlist for t2.scm.shadow.fault.
   * fault_code + waker_state always required. Identity attrs optional only when
   * no associated occurrence (omit — never fabricate). Never emit scope.
   */
  readonly fault: (attrs: {
    readonly fault_code: G9FaultCode;
    readonly waker_state: G9WakerState;
    readonly comm_id?: string;
    readonly node_id?: string;
    readonly bus_id?: string;
  }) => Effect.Effect<void, never>;
  readonly incWakeSkipped: () => Effect.Effect<void, never>;
  readonly setFifoDepth: (
    node_id: string,
    bus_id: string,
    depth: number,
  ) => Effect.Effect<void, never>;
  readonly incRejectedCapacity: () => Effect.Effect<void, never>;
  readonly incRejectedWithheld: () => Effect.Effect<void, never>;
}

/**
 * Isolate observer defects so they cannot fail the caller fiber.
 *
 * Intended: dying observer is evidence loss at most, never protocol rollback.
 * Observed: catchAllCause → Effect.void (covers Fail and Die).
 *
 * Parameters
 * ----------
 * effect : Effect.Effect<void, never>
 *     Observation body already typed never on the error channel.
 *
 * Returns
 * -------
 * Effect.Effect<void, never>
 *     Always succeeds.
 */
export const sandboxObserve = (effect: Effect.Effect<void, never>): Effect.Effect<void, never> =>
  // Effect v4: catchCause (plan name catchAllCause) swallows Fail and Die.
  effect.pipe(Effect.catchCause(() => Effect.void));

/** Build overload span attrs from the four-key allowlist only. */
const overloadAttributes = (attrs: {
  readonly node_id: string;
  readonly bus_id: string;
  readonly fifo_depth: number;
  readonly reason: G9OverloadReason;
}): Attributes => ({
  "t2.scm.node_id": attrs.node_id,
  "t2.scm.bus_id": attrs.bus_id,
  "t2.scm.fifo_depth": attrs.fifo_depth,
  "t2.scm.reason": attrs.reason,
});

/**
 * Build fault span attrs: required pair always; identities only when present.
 * Never emits scope or a sixth key.
 */
const faultAttributes = (attrs: {
  readonly fault_code: G9FaultCode;
  readonly waker_state: G9WakerState;
  readonly comm_id?: string;
  readonly node_id?: string;
  readonly bus_id?: string;
}): Attributes => {
  const out: Attributes = {
    "t2.scm.fault_code": attrs.fault_code,
    "t2.scm.waker_state": attrs.waker_state,
  };
  if (attrs.comm_id !== undefined) {
    out["t2.scm.comm_id"] = attrs.comm_id;
  }
  if (attrs.node_id !== undefined) {
    out["t2.scm.node_id"] = attrs.node_id;
  }
  if (attrs.bus_id !== undefined) {
    out["t2.scm.bus_id"] = attrs.bus_id;
  }
  return out;
};

/**
 * Construct the live G9 observation implementation.
 *
 * Intended: coordinator always observes after FIFO mutation; methods already
 * sandbox so callers cannot forget. Observed: span+metric names match catalog.
 *
 * Returns
 * -------
 * G9Observation
 *     Sandboxed emitters.
 */
export const makeG9Observation = (): G9Observation => ({
  overloadStart: (attrs) =>
    sandboxObserve(withOwnedSpan(SPAN_OVERLOAD_START, Effect.void, overloadAttributes(attrs))),
  overloadRecovered: (attrs) =>
    sandboxObserve(withOwnedSpan(SPAN_OVERLOAD_RECOVERED, Effect.void, overloadAttributes(attrs))),
  fault: (attrs) => sandboxObserve(withOwnedSpan(SPAN_FAULT, Effect.void, faultAttributes(attrs))),
  incWakeSkipped: () => sandboxObserve(Metric.update(METRIC_WAKE_SKIPPED, 1)),
  setFifoDepth: (node_id, bus_id, depth) =>
    sandboxObserve(
      Metric.update(
        Metric.withAttributes(METRIC_FIFO_DEPTH, [
          ["t2.scm.node_id", node_id],
          ["t2.scm.bus_id", bus_id],
        ]),
        depth,
      ),
    ),
  incRejectedCapacity: () => sandboxObserve(Metric.update(METRIC_REJECTED_CAPACITY, 1)),
  incRejectedWithheld: () => sandboxObserve(Metric.update(METRIC_REJECTED_WITHHELD, 1)),
});

/**
 * Shared G9 fault latch / controller (WP4 / Task 7).
 *
 * Intended: first-fault latch; Design Faults 1–9. Latch does not publish, does
 * not call admitPublish, does not import DipMuteStore.setBusPosition (no G7
 * mutation), does not self-resume. Emits metadata-only fault observation then
 * delivers to sink; sink Die is sandboxed with a second metadata observation.
 *
 * Observed: latchedFault retained; second latch is a no-op (no second obs/sink);
 * setWakerFaulted then wakerDisarm; scope is latch bookkeeping only — never an
 * observation attribute.
 *
 * Does not own waker state machine or coordinator preflight. Does not authorize G10.
 */
import * as Effect from "effect/Effect";

import { G9InvariantFault, type G9FaultSink, type G9WakerState } from "./g9Occurrence.ts";
import type { G9Observation } from "./g9Observation.ts";

/**
 * Latch context for fault observation.
 * scope is call-site bookkeeping only — NEVER an observation attribute.
 */
export type G9FaultLatchContext = {
  readonly waker_state: G9WakerState;
  readonly comm_id?: string;
  readonly node_id?: string;
  readonly bus_id?: string;
  readonly scope?: "capture" | "waker";
};

/**
 * First-fault shared controller for G9.
 *
 * Parameters
 * ----------
 * observation : G9Observation
 *     Catalog emitters (already sandboxed per method).
 * sink : G9FaultSink
 *     Supervisor delivery channel (error never).
 * wakerDisarm : () => void
 *     Disarm future wakes (must leave faulted when already setFaulted).
 * setWakerFaulted : () => void
 *     Mark waker faulted before disarm.
 */
export class G9FaultController {
  private latchedFault: G9InvariantFault | undefined;
  private readonly observation: G9Observation;
  private readonly sink: G9FaultSink;
  private readonly wakerDisarm: () => void;
  private readonly setWakerFaulted: () => void;

  constructor(
    observation: G9Observation,
    sink: G9FaultSink,
    wakerDisarm: () => void,
    setWakerFaulted: () => void,
  ) {
    this.observation = observation;
    this.sink = sink;
    this.wakerDisarm = wakerDisarm;
    this.setWakerFaulted = setWakerFaulted;
  }

  /** First retained G9InvariantFault, or undefined before latch. */
  latched(): G9InvariantFault | undefined {
    return this.latchedFault;
  }

  /**
   * Latch the first fault; subsequent calls are no-ops.
   *
   * Intended: Design Faults 1–9. Observed: retain first fault; set faulted;
   * disarm; emit fault attrs (no scope); deliver sink; sink Die → second
   * metadata-only observation then succeed.
   *
   * Parameters
   * ----------
   * fault : G9InvariantFault
   *     Typed invariant fault to retain and deliver.
   * ctx : G9FaultLatchContext
   *     waker_state required; identities only when a package row exists.
   *
   * Returns
   * -------
   * Effect.Effect<void, never>
   *     Never fails the latch caller.
   */
  latch(fault: G9InvariantFault, ctx: G9FaultLatchContext): Effect.Effect<void, never> {
    if (this.latchedFault !== undefined) {
      return Effect.void;
    }
    this.latchedFault = fault;
    this.setWakerFaulted();
    this.wakerDisarm();

    const observation = this.observation;
    const sink = this.sink;
    const faultAttrs = {
      fault_code: fault.code,
      waker_state: ctx.waker_state,
      ...(ctx.comm_id !== undefined ? { comm_id: ctx.comm_id } : {}),
      ...(ctx.node_id !== undefined ? { node_id: ctx.node_id } : {}),
      ...(ctx.bus_id !== undefined ? { bus_id: ctx.bus_id } : {}),
    };

    return Effect.gen(function* () {
      // Fault 5: metadata-only observation (scope deliberately omitted).
      yield* observation.fault(faultAttrs);
      // Fault 6: deliver; on Die emit metadata-only again then succeed.
      yield* sink.deliver(fault).pipe(Effect.catchCause(() => observation.fault(faultAttrs)));
    }).pipe(Effect.catchCause(() => Effect.void));
  }
}

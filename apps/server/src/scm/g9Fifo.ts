/**
 * G9 per-node FIFO admit, sequence, and overload episodes (WP2 / Task 4).
 *
 * Intended: one public admit method allocates sequence then enqueues or
 * capacity-rejects; never drop queued; never coalesce; overload-start on first
 * capacity reject; overload-recovered only on successful enqueue after overload.
 * Observed: Maps for queues / next-seq / overloaded; max from package JSON via
 * constructor (no TypeScript capacity literal as a second source of truth).
 *
 * Consumes freezeOccurrence. Accepts widened G9Occurrence (Task 14); no
 * ORCH-QUEUE-only literals in admit. Does not own promotion or coordinator.
 */
import {
  freezeOccurrence,
  G9InvariantFault,
  type G9CaptureResult,
  type G9Occurrence,
  type G9OverloadReason,
} from "./g9Occurrence.ts";

/**
 * Overload episode event returned alongside admit.
 * recovered fires only on successful enqueue after overloaded===true, not dequeue.
 */
export type G9OverloadEvent =
  | { readonly kind: "none" }
  | {
      readonly kind: "overload-start";
      readonly node_id: string;
      readonly bus_id: string;
      readonly fifo_depth: number;
      readonly reason: G9OverloadReason;
    }
  | {
      readonly kind: "overload-recovered";
      readonly node_id: string;
      readonly bus_id: string;
      readonly fifo_depth: number;
      readonly reason: G9OverloadReason;
    };

/**
 * Node-local FIFO store. Coordinator later calls one method: admit.
 *
 * Parameters
 * ----------
 * max : number
 *     Capacity from G9Package.parameters.fifo_max_occurrences_per_node.
 */
export class G9NodeFifos {
  private readonly queues = new Map<string, G9Occurrence[]>();
  private readonly nextSeq = new Map<string, number>();
  private readonly overloaded = new Map<string, boolean>();

  readonly max: number;
  constructor(max: number) {
    this.max = max;
  }

  /**
   * Allocate sequence, then enqueue or reject. Never two public steps.
   * bus_id is the origin bus of the candidate (for overload attrs).
   *
   * Parameters
   * ----------
   * args.node_id : string
   *     G3 node owning this FIFO.
   * args.bus_id : string
   *     Origin bus of the candidate (overload attrs only).
   * args.build : (attempt_sequence: number) => G9Occurrence
   *     Builds the occurrence after sequence allocation; only called on enqueue.
   *
   * Returns
   * -------
   * { result, overload, depth }
   *     Capture result, optional overload episode, post-admit depth.
   *
   * Throws
   * ------
   * G9InvariantFault
   *     code sequence-overflow when allocated seq would exceed safe integer.
   */
  admit(args: {
    node_id: string;
    bus_id: string;
    build: (attempt_sequence: number) => G9Occurrence;
  }): { result: G9CaptureResult; overload: G9OverloadEvent; depth: number } {
    const seq = this.nextSequence(args.node_id);
    if (seq > Number.MAX_SAFE_INTEGER - 1) {
      throw new G9InvariantFault("sequence-overflow", args.node_id);
    }
    const depth = this.depth(args.node_id);
    if (depth >= this.max) {
      const start = !this.overloaded.get(args.node_id);
      if (start) this.overloaded.set(args.node_id, true);
      return {
        result: { status: "rejected-capacity", attempt_sequence: seq },
        overload: start
          ? {
              kind: "overload-start",
              node_id: args.node_id,
              bus_id: args.bus_id,
              fifo_depth: depth,
              reason: "capacity",
            }
          : { kind: "none" },
        depth,
      };
    }
    const occ = freezeOccurrence(args.build(seq));
    let queue = this.queues.get(args.node_id);
    if (queue === undefined) {
      queue = [];
      this.queues.set(args.node_id, queue);
    }
    queue.push(occ);
    const recovered = this.overloaded.get(args.node_id) === true;
    if (recovered) this.overloaded.set(args.node_id, false);
    const newDepth = this.depth(args.node_id);
    return {
      result: { status: "enqueued", occurrence: occ },
      overload: recovered
        ? {
            kind: "overload-recovered",
            node_id: args.node_id,
            bus_id: args.bus_id,
            fifo_depth: newDepth,
            reason: "capacity",
          }
        : { kind: "none" },
      depth: newDepth,
    };
  }

  /**
   * Advance sequence for rejected-bus-withheld without touching FIFO or overload.
   *
   * Parameters
   * ----------
   * node_id : string
   *     Node whose attempt sequence advances.
   *
   * Returns
   * -------
   * { attempt_sequence: number }
   *     Allocated sequence (same allocator as admit).
   */
  recordWithheld(node_id: string): { attempt_sequence: number } {
    const seq = this.nextSequence(node_id);
    if (seq > Number.MAX_SAFE_INTEGER - 1) {
      throw new G9InvariantFault("sequence-overflow", node_id);
    }
    return { attempt_sequence: seq };
  }

  /**
   * Remove and return the FIFO head, or undefined when empty.
   * Does not clear overloaded (recovery is enqueue-only).
   */
  dequeueHead(node_id: string): G9Occurrence | undefined {
    const queue = this.queues.get(node_id);
    if (queue === undefined || queue.length === 0) return undefined;
    return queue.shift();
  }

  /** Current queued depth for node_id (0 when no queue). */
  depth(node_id: string): number {
    return this.queues.get(node_id)?.length ?? 0;
  }

  /** Peek FIFO head without removing. */
  peekHead(node_id: string): G9Occurrence | undefined {
    const queue = this.queues.get(node_id);
    if (queue === undefined || queue.length === 0) return undefined;
    return queue[0];
  }

  /**
   * Node-local sequence: first allocation is 0; increments after return.
   * Advances on enqueue, capacity reject, and withheld.
   */
  private nextSequence(node_id: string): number {
    const current = this.nextSeq.get(node_id) ?? 0;
    this.nextSeq.set(node_id, current + 1);
    return current;
  }
}

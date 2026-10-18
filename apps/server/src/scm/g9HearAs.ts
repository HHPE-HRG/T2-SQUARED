/**
 * Receiver-aware G9 hearAs (WP3 / Task 9).
 *
 * Intended: same-bus hear only. Binding requires receiving bus in runtimeBusIds,
 * receiving node in placedNodeIds, and nodeHomeBus(node) === receiving_bus_id.
 * Reserved node.observer.404 is not placed → fail closed (undefined). No
 * cross-bus search. Delegates mute-aware read to G6 hearObserved.
 *
 * Observed: see hearAs below. Does not publish, advance, or mutate DIP.
 * Does not authorize G10.
 */
import * as Effect from "effect/Effect";

import type { T2Observability } from "../t2Observability/T2Observability.ts";
import type { W1Word } from "./g4Word.ts";
import { hearObserved, type DipMuteStore } from "./g6DipMute.ts";
import type { G9RosterCoordinator } from "./g9Coordinator.ts";
import type { G9Package } from "./g9Package.ts";

/**
 * hearAs binding + origin identity for a same-bus read.
 *
 * Parameters
 * ----------
 * receiving_node_id : string
 *     Placed node that must be home-bound to receiving_bus_id.
 * receiving_bus_id : string
 *     Runtime bus whose storage is read.
 * origin_node_id : string
 *     Publishing origin node key in that bus's readable set.
 */
export interface G9HearInput {
  readonly receiving_node_id: string;
  readonly receiving_bus_id: string;
  readonly origin_node_id: string;
}

/**
 * Roster-aware hear: binding predicate then G6 hearObserved on that bus only.
 *
 * Parameters
 * ----------
 * pkg : G9Package
 *     Runtime bus/node sets and home bindings.
 * coordinator : G9RosterCoordinator
 *     Owns the ten InProcessOpenLoopBus instances.
 * store : DipMuteStore
 *     DIP rows for mute-source / mute-modifiers on the receiving bus.
 * input : G9HearInput
 *     Receiver binding + origin node to hear.
 *
 * Returns
 * -------
 * Effect.Effect&lt;W1Word | undefined, never, T2Observability&gt;
 *     Heard word, or undefined when unbound / missing bus / muted / absent.
 */
export const hearAs = (
  pkg: G9Package,
  coordinator: G9RosterCoordinator,
  store: DipMuteStore,
  input: G9HearInput,
): Effect.Effect<W1Word | undefined, never, T2Observability> => {
  const bound =
    pkg.runtimeBusIds.has(input.receiving_bus_id) &&
    pkg.placedNodeIds.has(input.receiving_node_id) &&
    pkg.nodeHomeBus.get(input.receiving_node_id) === input.receiving_bus_id;
  // reserved 404 is not in placedNodeIds → fail closed
  if (!bound) return Effect.succeed(undefined);
  const bus = coordinator.buses.get(input.receiving_bus_id);
  if (bus === undefined) return Effect.succeed(undefined);
  return hearObserved(bus, store, input.receiving_bus_id, input.origin_node_id);
};

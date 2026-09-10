/**
 * Bounded bidirectional in-process home-bus link.
 *
 * Two explicit inverse routes. No G6 completion, DIP, halt, or codec.
 */
import type { Attributes } from "@opentelemetry/api";
import * as Effect from "effect/Effect";

import { withOwnedSpan } from "../t2Observability/T2Observability.ts";
import { checkW1Word, type W1Word } from "./g4Word.ts";
import { InProcessOpenLoopBus, w1WordId } from "./g5OpenLoop.ts";

export interface BridgeRoute {
  readonly route_id: string;
  readonly source_bus_id: string;
  readonly destination_bus_id: string;
  readonly allowed_origin_node_ids: ReadonlyArray<string>;
  readonly enabled: boolean;
}

export interface BridgeDelivery {
  readonly route_id: string;
  readonly source_bus_id: string;
  readonly destination_bus_id: string;
  readonly origin_node_id: string;
  readonly origin_bus_id: string;
  readonly origin_timestep: number;
  readonly forwarded_at_timestep: number;
  readonly bridge_hop: 1;
  readonly word_id: string;
  readonly word: W1Word;
}

export interface BridgeRouteFailure {
  readonly route_id: string;
  readonly origin_node_id: string;
  readonly message: string;
}

export interface BridgeAdvanceResult {
  readonly deliveries: ReadonlyArray<BridgeDelivery>;
  readonly failures: ReadonlyArray<BridgeRouteFailure>;
}

export class HomeBusLinkFailure extends Error {
  readonly _tag = "HomeBusLinkFailure";
}

const nonEmpty = (value: string): boolean => value.trim().length > 0;

const routeDeliveryKey = (delivery: BridgeDelivery): string =>
  [
    delivery.route_id,
    delivery.origin_bus_id,
    delivery.origin_node_id,
    String(delivery.origin_timestep),
    delivery.word_id,
  ].join("\0");

const bridgeAttributes = (delivery: BridgeDelivery): Attributes => ({
  "t2.scm.word_id": delivery.word_id,
  "t2.scm.origin_node_id": delivery.origin_node_id,
  "t2.scm.origin_bus_id": delivery.origin_bus_id,
  "t2.scm.source_bus_id": delivery.source_bus_id,
  "t2.scm.destination_bus_id": delivery.destination_bus_id,
  "t2.scm.route_id": delivery.route_id,
  "t2.scm.bridge_hop": delivery.bridge_hop,
  "t2.scm.origin_timestep": delivery.origin_timestep,
  "t2.scm.forwarded_at_timestep": delivery.forwarded_at_timestep,
});

/**
 * Observe a completed bridge forward on the isolated T2 plane.
 *
 * Parameters
 * ----------
 * delivery : BridgeDelivery
 *     Forwarded instance after destination write.
 * effect : Effect.Effect
 *     Prior write or follow-on effect. Observation runs after success.
 *
 * Returns
 * -------
 * Effect.Effect
 *     Same result, then `t2.scm.bridge.forward` when T2 is present.
 *
 * Example
 * -------
 * yield* observeBridgeForward(delivery, Effect.void);
 */
export const observeBridgeForward = <A, E, R>(
  delivery: BridgeDelivery,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.flatMap(effect, (result) =>
    withOwnedSpan("t2.scm.bridge.forward", Effect.succeed(result), bridgeAttributes(delivery)),
  );

/**
 * Two-bus coordinator for explicit inverse home-bus routes.
 *
 * Parameters
 * ----------
 * config.buses : ReadonlyMap
 *     Known in-process buses keyed by bus_id.
 * config.routes : [BridgeRoute, BridgeRoute]
 *     Unique inverse routes over those buses.
 *
 * Returns
 * -------
 * BidirectionalHomeBusLink
 *     Clock-driven forwarder. Not a node.
 *
 * Example
 * -------
 * const link = new BidirectionalHomeBusLink({ buses, routes: [aToB, bToA] });
 */
export class BidirectionalHomeBusLink {
  private fundamentalTimestep = 0;
  private advancing = false;
  private readonly config: {
    readonly buses: ReadonlyMap<string, InProcessOpenLoopBus>;
    readonly routes: readonly [BridgeRoute, BridgeRoute];
  };

  constructor(config: {
    readonly buses: ReadonlyMap<string, InProcessOpenLoopBus>;
    readonly routes: readonly [BridgeRoute, BridgeRoute];
  }) {
    this.config = config;
    const [forward, reverse] = config.routes;
    const routeIds = new Set(config.routes.map((route) => route.route_id));
    if (
      routeIds.size !== 2 ||
      !config.routes.every(
        (route) =>
          nonEmpty(route.route_id) &&
          nonEmpty(route.source_bus_id) &&
          nonEmpty(route.destination_bus_id) &&
          route.source_bus_id !== route.destination_bus_id &&
          config.buses.has(route.source_bus_id) &&
          config.buses.has(route.destination_bus_id) &&
          route.allowed_origin_node_ids.length > 0 &&
          route.allowed_origin_node_ids.every(nonEmpty) &&
          new Set(route.allowed_origin_node_ids).size === route.allowed_origin_node_ids.length,
      ) ||
      new Set(config.routes.flatMap((route) => route.allowed_origin_node_ids)).size !==
        config.routes.flatMap((route) => route.allowed_origin_node_ids).length ||
      forward.source_bus_id !== reverse.destination_bus_id ||
      forward.destination_bus_id !== reverse.source_bus_id
    ) {
      throw new HomeBusLinkFailure("routes must be unique inverse routes over two known buses");
    }
  }

  /**
   * Advance one shared fundamental timestep and forward eligible local origins.
   *
   * Parameters
   * ----------
   * none
   *
   * Returns
   * -------
   * Effect.Effect
   *     Deliveries and isolated route failures for this timestep.
   *
   * Example
   * -------
   * const result = yield* link.advanceFundamentalTimestep();
   */
  advanceFundamentalTimestep(): Effect.Effect<BridgeAdvanceResult, HomeBusLinkFailure> {
    if (this.advancing) {
      return Effect.fail(new HomeBusLinkFailure("fundamental timestep advance already active"));
    }
    this.advancing = true;

    const config = this.config;
    const readTimestep = () => this.fundamentalTimestep;
    const bumpTimestep = () => {
      this.fundamentalTimestep += 1;
    };
    const clearAdvancing = () => {
      this.advancing = false;
    };

    return Effect.gen(function* () {
      for (const bus of config.buses.values()) {
        bus.advanceFundamentalTimestep();
      }

      const originTimestep = readTimestep();
      bumpTimestep();
      const forwardedAt = readTimestep();
      const deliveries: BridgeDelivery[] = [];
      const failures: BridgeRouteFailure[] = [];
      const seen = new Set<string>();

      for (const route of config.routes) {
        if (!route.enabled) continue;
        const source = config.buses.get(route.source_bus_id)!;
        const destination = config.buses.get(route.destination_bus_id)!;

        for (const nodeId of route.allowed_origin_node_ids) {
          const candidate = source.read(nodeId);
          if (candidate === undefined) continue;
          const checked = checkW1Word(candidate);
          if (!checked.ok) {
            failures.push({
              route_id: route.route_id,
              origin_node_id: nodeId,
              message: "source bus exposed invalid W1",
            });
            continue;
          }
          if (checked.word.node_id !== nodeId || checked.word.bus_id !== route.source_bus_id) {
            failures.push({
              route_id: route.route_id,
              origin_node_id: nodeId,
              message: "route accepts only registered local-origin words",
            });
            continue;
          }

          const delivery: BridgeDelivery = {
            route_id: route.route_id,
            source_bus_id: route.source_bus_id,
            destination_bus_id: route.destination_bus_id,
            origin_node_id: checked.word.node_id,
            origin_bus_id: checked.word.bus_id,
            origin_timestep: originTimestep,
            forwarded_at_timestep: forwardedAt,
            bridge_hop: 1,
            word_id: w1WordId(checked.word),
            word: checked.word,
          };
          const key = routeDeliveryKey(delivery);
          if (seen.has(key)) continue;
          seen.add(key);

          destination.publish(checked.word);
          deliveries.push(delivery);
        }
      }

      yield* Effect.forEach(deliveries, (delivery) => observeBridgeForward(delivery, Effect.void));
      return { deliveries, failures };
    }).pipe(Effect.ensuring(Effect.sync(clearAdvancing)));
  }
}

// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { assert, describe, it } from "@effect/vitest";
import { trace } from "@opentelemetry/api";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { T2Observability, layerTest } from "../t2Observability/T2Observability.ts";
import { checkW1Word, type W1Word } from "./g4Word.ts";
import { InProcessOpenLoopBus, observePublish, observeReceive, w1WordId } from "./g5OpenLoop.ts";
import {
  BidirectionalHomeBusLink,
  HomeBusLinkFailure,
  observeBridgeForward,
  type BridgeDelivery,
  type BridgeRoute,
} from "./g6HomeBusLink.ts";

const tracePath = (): string =>
  NodePath.join(
    NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "t2-scm-link-")),
    "t2.trace.ndjson",
  );

const checkedWord = (bus_id: string, node_id: string, request = "canonical-absence"): W1Word => {
  const checked = checkW1Word({
    bus_id,
    node_id,
    fundamental_state: "active",
    fundamental_request: request,
    state_age: 0,
    request_age: 0,
    modifier_start: "modifier_start",
    null: "null",
  });
  if (!checked.ok) {
    throw new Error(checked.failures.map((failure) => failure.message).join("\n"));
  }
  return checked.word;
};

const routeAtoB: BridgeRoute = {
  route_id: "route.rpc-to-control",
  source_bus_id: "bus.rpc",
  destination_bus_id: "bus.control",
  allowed_origin_node_ids: ["node.rpc"],
  enabled: true,
};

const routeBtoA: BridgeRoute = {
  route_id: "route.control-to-rpc",
  source_bus_id: "bus.control",
  destination_bus_id: "bus.rpc",
  allowed_origin_node_ids: ["node.orchestration"],
  enabled: true,
};

const fixture = () => {
  const busA = new InProcessOpenLoopBus();
  const busB = new InProcessOpenLoopBus();
  const link = new BidirectionalHomeBusLink({
    buses: new Map([
      ["bus.rpc", busA],
      ["bus.control", busB],
    ]),
    routes: [routeAtoB, routeBtoA],
  });
  return { busA, busB, link };
};

describe("bidirectional SCM home-bus link", () => {
  it.effect("makes each direction visible at T+2", () =>
    Effect.gen(function* () {
      const { busA, busB, link } = fixture();
      const fromA = checkedWord("bus.rpc", "node.rpc", "need-control");
      const fromB = checkedWord("bus.control", "node.orchestration", "need-rpc");

      busA.publish(fromA);
      busB.publish(fromB);
      assert.equal(busB.read("node.rpc"), undefined);
      assert.equal(busA.read("node.orchestration"), undefined);

      const first = yield* link.advanceFundamentalTimestep();
      assert.equal(first.deliveries.length, 2);
      assert.deepEqual(first.failures, []);
      assert.equal(busB.read("node.rpc"), undefined);
      assert.equal(busA.read("node.orchestration"), undefined);

      yield* link.advanceFundamentalTimestep();
      assert.deepEqual(busB.read("node.rpc"), fromA);
      assert.deepEqual(busA.read("node.orchestration"), fromB);
    }),
  );

  it.effect("forwards identical cyclic content once per origin timestep", () =>
    Effect.gen(function* () {
      const { busA, link } = fixture();
      const repeated = checkedWord("bus.rpc", "node.rpc", "still-needed");

      busA.publish(repeated);
      const first = yield* link.advanceFundamentalTimestep();
      busA.publish(repeated);
      const second = yield* link.advanceFundamentalTimestep();

      assert.equal(first.deliveries.length, 1);
      assert.equal(second.deliveries.length, 1);
      assert.equal(first.deliveries[0]?.word_id, second.deliveries[0]?.word_id);
      assert.notEqual(first.deliveries[0]?.origin_timestep, second.deliveries[0]?.origin_timestep);
    }),
  );

  it.effect("does not re-forward imported words", () =>
    Effect.gen(function* () {
      const { busA, busB, link } = fixture();
      busA.publish(checkedWord("bus.rpc", "node.rpc", "one-way-instance"));

      const atOne = yield* link.advanceFundamentalTimestep();
      const atTwo = yield* link.advanceFundamentalTimestep();
      const atThree = yield* link.advanceFundamentalTimestep();

      assert.equal(atOne.deliveries.length, 1);
      assert.equal(atTwo.deliveries.length, 0);
      assert.equal(atThree.deliveries.length, 0);
      assert.equal(busA.read("node.rpc"), undefined);
      assert.equal(busB.read("node.rpc"), undefined);
    }),
  );

  it("rejects invalid route configuration at construction", () => {
    const invalidRouteSets: ReadonlyArray<readonly [string, readonly [BridgeRoute, BridgeRoute]]> =
      [
        ["duplicate route IDs", [{ ...routeAtoB }, { ...routeBtoA, route_id: routeAtoB.route_id }]],
        [
          "same source and destination",
          [{ ...routeAtoB, destination_bus_id: "bus.rpc" }, routeBtoA],
        ],
        ["unknown bus", [{ ...routeAtoB, destination_bus_id: "bus.missing" }, routeBtoA]],
        [
          "duplicate allowed origin",
          [{ ...routeAtoB, allowed_origin_node_ids: ["node.rpc", "node.rpc"] }, routeBtoA],
        ],
        [
          "origin registered on both home buses",
          [routeAtoB, { ...routeBtoA, allowed_origin_node_ids: ["node.rpc"] }],
        ],
        [
          "routes are not inverse",
          [routeAtoB, { ...routeBtoA, destination_bus_id: "bus.control" }],
        ],
      ];

    for (const [name, routes] of invalidRouteSets) {
      assert.throws(
        () =>
          new BidirectionalHomeBusLink({
            buses: new Map([
              ["bus.rpc", new InProcessOpenLoopBus()],
              ["bus.control", new InProcessOpenLoopBus()],
            ]),
            routes,
          }),
        HomeBusLinkFailure,
        "routes must be unique inverse routes over two known buses",
        name,
      );
    }
  });

  it.effect("forwards only enabled direction", () =>
    Effect.gen(function* () {
      const busA = new InProcessOpenLoopBus();
      const busB = new InProcessOpenLoopBus();
      const link = new BidirectionalHomeBusLink({
        buses: new Map([
          ["bus.rpc", busA],
          ["bus.control", busB],
        ]),
        routes: [{ ...routeAtoB, enabled: false }, routeBtoA],
      });

      busA.publish(checkedWord("bus.rpc", "node.rpc", "blocked-direction"));
      busB.publish(checkedWord("bus.control", "node.orchestration", "enabled-direction"));
      const result = yield* link.advanceFundamentalTimestep();

      assert.equal(result.deliveries.length, 1);
      assert.equal(result.deliveries[0]?.route_id, "route.control-to-rpc");
      assert.deepEqual(result.failures, []);
    }),
  );

  it.effect("isolates invalid route input from reverse route", () =>
    Effect.gen(function* () {
      const { busA, busB, link } = fixture();
      busA.publish({ ...checkedWord("bus.rpc", "node.rpc"), request_age: -1 } as W1Word);
      busB.publish(checkedWord("bus.control", "node.orchestration", "still-forward"));
      const result = yield* link.advanceFundamentalTimestep();
      assert.equal(result.failures.length, 1);
      assert.equal(result.failures[0]?.route_id, "route.rpc-to-control");
      assert.equal(result.deliveries.length, 1);
      assert.equal(result.deliveries[0]?.route_id, "route.control-to-rpc");
    }),
  );

  it.effect("observes one forward per delivery on isolated T2 provider", () => {
    const exporter = new InMemorySpanExporter();
    const before = trace.getTracerProvider();
    const { busA, busB, link } = fixture();

    return Effect.gen(function* () {
      const source = checkedWord("bus.rpc", "node.rpc", "need-control");
      yield* observePublish(
        source,
        Effect.sync(() => busA.publish(source)),
      );
      const result = yield* link.advanceFundamentalTimestep();
      yield* link.advanceFundamentalTimestep();
      const received = yield* observeReceive(Effect.sync(() => busB.read("node.rpc")));
      assert.deepEqual(received, source);
      const t2 = yield* T2Observability;
      yield* t2.forceFlush;

      const spans = exporter.getFinishedSpans();
      const publishes = spans.filter((span) => span.name === "t2.scm.publish");
      const forwards = spans.filter((span) => span.name === "t2.scm.bridge.forward");
      const receives = spans.filter((span) => span.name === "t2.scm.receive");
      assert.equal(publishes.length, 1);
      assert.equal(forwards.length, 1);
      assert.equal(receives.length, 1);
      assert.equal(forwards[0]?.attributes["t2.scm.route_id"], "route.rpc-to-control");
      assert.equal(forwards[0]?.attributes["t2.scm.bridge_hop"], 1);
      assert.equal(forwards[0]?.attributes["t2.scm.word_id"], result.deliveries[0]?.word_id);
      assert.equal(
        publishes[0]?.attributes["t2.scm.word_id"],
        forwards[0]?.attributes["t2.scm.word_id"],
      );
      assert.equal(
        receives[0]?.attributes["t2.scm.word_id"],
        forwards[0]?.attributes["t2.scm.word_id"],
      );
      assert.equal(trace.getTracerProvider(), before);
    }).pipe(Effect.provide(layerTest({ exporter, filePath: tracePath() })));
  });

  it.effect("does not retract destination write when wrapped effect fails afterward", () =>
    Effect.gen(function* () {
      const destination = new InProcessOpenLoopBus();
      const source = checkedWord("bus.rpc", "node.rpc", "need-control");
      const delivery: BridgeDelivery = {
        route_id: "route.rpc-to-control",
        source_bus_id: "bus.rpc",
        destination_bus_id: "bus.control",
        origin_node_id: "node.rpc",
        origin_bus_id: "bus.rpc",
        origin_timestep: 0,
        forwarded_at_timestep: 1,
        bridge_hop: 1,
        word_id: w1WordId(source),
        word: source,
      };

      const exit = yield* observeBridgeForward(
        delivery,
        Effect.sync(() => destination.publish(delivery.word)).pipe(
          Effect.flatMap(() => Effect.fail("observer-down")),
        ),
      ).pipe(Effect.exit);
      assert.equal(Exit.isFailure(exit), true);
      destination.advanceFundamentalTimestep();
      assert.deepEqual(destination.read(delivery.origin_node_id), delivery.word);
    }),
  );

  it.effect("preserves source identity and invents no control surfaces", () =>
    Effect.gen(function* () {
      const { busA, link } = fixture();
      const sourceWord = checkedWord("bus.rpc", "node.rpc", "need-control");
      busA.publish(sourceWord);
      const result = yield* link.advanceFundamentalTimestep();
      const delivery = result.deliveries[0];
      assert.ok(delivery);
      assert.equal(delivery.source_bus_id, "bus.rpc");
      assert.equal(delivery.destination_bus_id, "bus.control");
      assert.equal(delivery.origin_bus_id, "bus.rpc");
      assert.equal(delivery.origin_node_id, "node.rpc");
      assert.equal(delivery.bridge_hop, 1);
      assert.deepEqual(delivery.word, sourceWord);
      assert.equal(delivery.word.bus_id, "bus.rpc");
      assert.equal(delivery.word.node_id, "node.rpc");
      assert.equal("authority_class" in delivery.word, false);

      for (const forbidden of [
        "ack",
        "acknowledge",
        "nack",
        "retry",
        "retryCount",
        "halt",
        "mute",
        "codec",
      ]) {
        assert.equal(forbidden in link, false, forbidden);
      }
    }),
  );
});

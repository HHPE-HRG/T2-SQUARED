/**
 * G7 DIP bus-level position, bus mutationGuard, and home-bus bridge tests.
 *
 * Store cases: governed buses default to live, steward freeze/halt,
 * observer and node.observer.404 denial, unknown-bus fail-closed, mute
 * while live, mute-row mutation blocked after freeze/halt.
 *
 * Bus cases: InProcessOpenLoopBus optional mutationGuard refuses
 * publish/advance after freeze; read/hear keep the pre-freeze snapshot.
 * No G5→G6 import.
 *
 * Bridge cases: BidirectionalHomeBusLink optional dip skips frozen/halted
 * bus advance and does not destination.publish; mute-source is not freeze.
 * No OTEL or recommend-stop yet.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { checkW1Word, type W1Word } from "./g4Word.ts";
import { InProcessOpenLoopBus } from "./g5OpenLoop.ts";
import {
  DipMuteFailure,
  DipMuteStore,
  hear,
  STEWARD_ACTOR,
  type AuthorityClass,
  type DipActor,
  type DipRow,
  type GovernedClasses,
} from "./g6DipMute.ts";
import { BidirectionalHomeBusLink, type BridgeRoute } from "./g6HomeBusLink.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

interface GovernedClassesJson {
  readonly authority_bus_id: string;
  readonly buses: Record<string, AuthorityClass>;
  readonly nodes: Record<string, AuthorityClass>;
}

/**
 * Turn JSON buses/nodes objects into GovernedClasses Maps.
 *
 * Parameters
 * ----------
 * raw : GovernedClassesJson
 *     Fixture objects keyed by bus/node id.
 *
 * Returns
 * -------
 * GovernedClasses
 *     Same ids with Map lookups.
 *
 * Example
 * -------
 * const governed = governedFromJson(JSON.parse(text));
 */
const governedFromJson = (raw: GovernedClassesJson): GovernedClasses => ({
  authority_bus_id: raw.authority_bus_id,
  buses: new Map(Object.entries(raw.buses)),
  nodes: new Map(Object.entries(raw.nodes)),
});

/**
 * Load docs/scm/g6/governed-classes.json as GovernedClasses.
 *
 * Parameters
 * ----------
 * none
 *
 * Returns
 * -------
 * GovernedClasses
 *     Authority parent plus A2 homes from the G6 fixture.
 *
 * Example
 * -------
 * const store = new DipMuteStore(loadFixtureGoverned());
 */
const loadFixtureGoverned = (): GovernedClasses => {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g6/governed-classes.json"), "utf8"),
  ) as GovernedClassesJson;
  return governedFromJson(raw);
};

const OBSERVER_ACTOR: DipActor = {
  node_id: "node.observer.test",
  authority_class: "observer",
};

const OBSERVER_404_ACTOR: DipActor = {
  node_id: "node.observer.404",
  authority_class: "observer",
};

/**
 * Legal A2 mute-source row for bus.scm.a of bus.scm.b / node.scm.home-b.
 *
 * Parameters
 * ----------
 * overrides : Partial<DipRow>
 *     Field replacements after fixture defaults.
 *
 * Returns
 * -------
 * DipRow
 *     Row accepted by G6 mute law on the fixture table.
 *
 * Example
 * -------
 * store.setDip(a2PeerMute({ mode: "hear" }));
 */
const a2PeerMute = (overrides: Partial<DipRow> = {}): DipRow => ({
  receiving_bus_id: "bus.scm.a",
  receiving_authority_class: "A2",
  source_bus_id: "bus.scm.b",
  source_node_id: "node.scm.home-b",
  source_authority_class: "A2",
  mode: "mute-source",
  steward: "steward.test",
  runtime_mutable: true,
  ...overrides,
});

describe("G7 DIP bus-level position (store)", () => {
  it("governed bus defaults to live until set", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    assert.equal(store.busPosition("bus.scm.a"), "live");
    assert.equal(store.busPosition("bus.scm.b"), "live");
    assert.equal(store.busPosition("bus.scm.authority"), "live");
    store.assertMutable("bus.scm.a");
  });

  it("steward freeze then halt latch; idempotent same position succeeds", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    store.setBusPosition("bus.scm.a", "frozen", STEWARD_ACTOR);
    assert.equal(store.busPosition("bus.scm.a"), "frozen");
    store.setBusPosition("bus.scm.a", "frozen", STEWARD_ACTOR);
    assert.equal(store.busPosition("bus.scm.a"), "frozen");
    assert.throws(() => store.assertMutable("bus.scm.a"), DipMuteFailure);

    const haltStore = new DipMuteStore(loadFixtureGoverned());
    haltStore.setBusPosition("bus.scm.a", "halted", STEWARD_ACTOR);
    assert.equal(haltStore.busPosition("bus.scm.a"), "halted");
    haltStore.setBusPosition("bus.scm.a", "halted", STEWARD_ACTOR);
    assert.equal(haltStore.busPosition("bus.scm.a"), "halted");
    assert.throws(() => haltStore.assertMutable("bus.scm.a"), DipMuteFailure);
    assert.equal(haltStore.busPosition("bus.scm.b"), "live");
  });

  it("observer setBusPosition frozen/halted throws; prior live retained", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    assert.throws(
      () => store.setBusPosition("bus.scm.a", "frozen", OBSERVER_ACTOR),
      DipMuteFailure,
    );
    assert.equal(store.busPosition("bus.scm.a"), "live");
    assert.throws(
      () => store.setBusPosition("bus.scm.a", "halted", OBSERVER_ACTOR),
      DipMuteFailure,
    );
    assert.equal(store.busPosition("bus.scm.a"), "live");
    store.assertMutable("bus.scm.a");
  });

  it("node.observer.404 setBusPosition frozen/halted throws; prior live retained", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    assert.throws(
      () => store.setBusPosition("bus.scm.a", "frozen", OBSERVER_404_ACTOR),
      DipMuteFailure,
    );
    assert.equal(store.busPosition("bus.scm.a"), "live");
    assert.throws(
      () => store.setBusPosition("bus.scm.a", "halted", OBSERVER_404_ACTOR),
      DipMuteFailure,
    );
    assert.equal(store.busPosition("bus.scm.a"), "live");
  });

  it("unknown bus_id throws on busPosition and setBusPosition; no write", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    assert.throws(() => store.busPosition("bus.unknown"), DipMuteFailure);
    assert.throws(
      () => store.setBusPosition("bus.unknown", "frozen", STEWARD_ACTOR),
      DipMuteFailure,
    );
    assert.throws(() => store.assertMutable("bus.unknown"), DipMuteFailure);
    assert.equal(store.busPosition("bus.scm.a"), "live");
  });

  it("mute still settable while live; setDip/removeDip fail after freeze", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    store.setDip(a2PeerMute());
    assert.equal(store.listDip("bus.scm.a").length, 1);
    store.setDip(a2PeerMute({ mode: "hear" }));
    assert.equal(store.resolveMode("bus.scm.a", "bus.scm.b", "node.scm.home-b"), "hear");

    store.setBusPosition("bus.scm.a", "frozen", STEWARD_ACTOR);
    assert.throws(() => store.setDip(a2PeerMute({ mode: "mute-source" })), DipMuteFailure);
    assert.throws(
      () => store.removeDip("bus.scm.a", "bus.scm.b", "node.scm.home-b"),
      DipMuteFailure,
    );
    const after = store.listDip("bus.scm.a");
    assert.equal(after.length, 1);
    assert.equal(after[0]?.mode, "hear");
  });

  it("frozen/halted cannot change to another position; peer bus stays live", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    store.setBusPosition("bus.scm.a", "frozen", STEWARD_ACTOR);
    assert.throws(() => store.setBusPosition("bus.scm.a", "live", STEWARD_ACTOR), DipMuteFailure);
    assert.throws(() => store.setBusPosition("bus.scm.a", "halted", STEWARD_ACTOR), DipMuteFailure);
    assert.equal(store.busPosition("bus.scm.a"), "frozen");
    assert.equal(store.busPosition("bus.scm.b"), "live");

    const haltStore = new DipMuteStore(loadFixtureGoverned());
    haltStore.setBusPosition("bus.scm.a", "halted", STEWARD_ACTOR);
    assert.throws(
      () => haltStore.setBusPosition("bus.scm.a", "live", STEWARD_ACTOR),
      DipMuteFailure,
    );
    assert.throws(
      () => haltStore.setBusPosition("bus.scm.a", "frozen", STEWARD_ACTOR),
      DipMuteFailure,
    );
    assert.equal(haltStore.busPosition("bus.scm.a"), "halted");
  });

  it("setDip/removeDip fail after halt; rows unchanged", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    store.setDip(a2PeerMute());
    store.setBusPosition("bus.scm.a", "halted", STEWARD_ACTOR);
    assert.throws(() => store.setDip(a2PeerMute({ mode: "hear" })), DipMuteFailure);
    assert.throws(
      () => store.removeDip("bus.scm.a", "bus.scm.b", "node.scm.home-b"),
      DipMuteFailure,
    );
    assert.equal(store.listDip("bus.scm.a")[0]?.mode, "mute-source");
  });
});

/**
 * Legal W1 word for a G7 snapshot on a home bus.
 *
 * Parameters
 * ----------
 * bus_id : string
 *     Origin bus id stored on the word.
 * node_id : string
 *     Origin node id; also the bus.read / hear key.
 * request : string
 *     fundamental_request used to distinguish snapshots.
 *
 * Returns
 * -------
 * W1Word
 *     Word accepted by checkW1Word.
 *
 * Example
 * -------
 * const word = checkedWord("bus.scm.a", "node.scm.home-a", "pre-freeze");
 */
const checkedWord = (bus_id: string, node_id: string, request: string): W1Word => {
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

describe("G7 bus mutationGuard", () => {
  it("freeze then publish and advance throw; read and hear keep pre-freeze snapshot", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    const busA = new InProcessOpenLoopBus({
      mutationGuard: () => store.assertMutable("bus.scm.a"),
    });
    const snapshot = checkedWord("bus.scm.a", "node.scm.home-a", "pre-freeze");
    busA.publish(snapshot);
    busA.advanceFundamentalTimestep();

    store.setBusPosition("bus.scm.a", "frozen", STEWARD_ACTOR);
    const afterFreeze = checkedWord("bus.scm.a", "node.scm.home-a", "post-freeze");
    assert.throws(() => busA.publish(afterFreeze), DipMuteFailure);
    assert.throws(() => busA.advanceFundamentalTimestep(), DipMuteFailure);

    assert.equal(busA.read("node.scm.home-a")?.fundamental_request, "pre-freeze");
    assert.equal(
      hear(busA, store, "bus.scm.a", "node.scm.home-a")?.fundamental_request,
      "pre-freeze",
    );
  });

  it("unguarded bus still publishes and advances", () => {
    const bus = new InProcessOpenLoopBus();
    const word = checkedWord("bus.scm.a", "node.scm.home-a", "ungarded");
    bus.publish(word);
    bus.advanceFundamentalTimestep();
    assert.equal(bus.read("node.scm.home-a")?.fundamental_request, "ungarded");
  });
});

/**
 * Inverse routes over fixture homes bus.scm.a / bus.scm.b.
 *
 * Parameters
 * ----------
 * none
 *
 * Returns
 * -------
 * [BridgeRoute, BridgeRoute]
 *     Unique inverse pair for BidirectionalHomeBusLink.
 *
 * Example
 * -------
 * routes: g7HomeRoutes()
 */
const g7HomeRoutes = (): readonly [BridgeRoute, BridgeRoute] => [
  {
    route_id: "route.scm.a-to-b",
    source_bus_id: "bus.scm.a",
    destination_bus_id: "bus.scm.b",
    allowed_origin_node_ids: ["node.scm.home-a"],
    enabled: true,
  },
  {
    route_id: "route.scm.b-to-a",
    source_bus_id: "bus.scm.b",
    destination_bus_id: "bus.scm.a",
    allowed_origin_node_ids: ["node.scm.home-b"],
    enabled: true,
  },
];

/**
 * Two guarded home buses plus a DIP-aware inverse link.
 *
 * Parameters
 * ----------
 * store : DipMuteStore
 *     Governed DIP used for mutationGuard and optional bridge consult.
 *
 * Returns
 * -------
 * { busA, busB, link }
 *     bus.scm.a / bus.scm.b with assertMutable guards and dip on the link.
 *
 * Example
 * -------
 * const { busA, busB, link } = g7LinkedHomes(store);
 */
const g7LinkedHomes = (
  store: DipMuteStore,
): {
  readonly busA: InProcessOpenLoopBus;
  readonly busB: InProcessOpenLoopBus;
  readonly link: BidirectionalHomeBusLink;
} => {
  const busA = new InProcessOpenLoopBus({
    mutationGuard: () => store.assertMutable("bus.scm.a"),
  });
  const busB = new InProcessOpenLoopBus({
    mutationGuard: () => store.assertMutable("bus.scm.b"),
  });
  const link = new BidirectionalHomeBusLink({
    buses: new Map([
      ["bus.scm.a", busA],
      ["bus.scm.b", busB],
    ]),
    routes: g7HomeRoutes(),
    dip: store,
  });
  return { busA, busB, link };
};

describe("G7 home-bus bridge obeys DIP", () => {
  it.effect("freeze A before publish: neither direction delivers; B still publishes locally", () =>
    Effect.gen(function* () {
      const store = new DipMuteStore(loadFixtureGoverned());
      const { busA, busB, link } = g7LinkedHomes(store);
      store.setBusPosition("bus.scm.a", "frozen", STEWARD_ACTOR);

      const fromA = checkedWord("bus.scm.a", "node.scm.home-a", "blocked-a");
      const fromB = checkedWord("bus.scm.b", "node.scm.home-b", "local-b");
      assert.throws(() => busA.publish(fromA), DipMuteFailure);
      busB.publish(fromB);

      const first = yield* link.advanceFundamentalTimestep();
      assert.equal(first.deliveries.length, 0);
      assert.equal(first.failures.length, 2);
      for (const failure of first.failures) {
        assert.equal(
          failure.message.includes("frozen") || failure.message.includes("halted"),
          true,
        );
      }
      assert.deepEqual(busB.read("node.scm.home-b"), fromB);

      const second = yield* link.advanceFundamentalTimestep();
      assert.equal(second.deliveries.length, 0);
      assert.equal(busA.read("node.scm.home-b"), undefined);
      assert.equal(busB.read("node.scm.home-a"), undefined);
    }),
  );

  it.effect("mute-source on live buses: bridge still forwards", () =>
    Effect.gen(function* () {
      const store = new DipMuteStore(loadFixtureGoverned());
      store.setDip(a2PeerMute({ mode: "mute-source" }));
      const { busA, busB, link } = g7LinkedHomes(store);
      const fromA = checkedWord("bus.scm.a", "node.scm.home-a", "live-a");
      const fromB = checkedWord("bus.scm.b", "node.scm.home-b", "live-b");

      busA.publish(fromA);
      busB.publish(fromB);
      const first = yield* link.advanceFundamentalTimestep();
      assert.equal(first.deliveries.length, 2);
      assert.deepEqual(first.failures, []);
      yield* link.advanceFundamentalTimestep();

      assert.deepEqual(busA.read("node.scm.home-b"), fromB);
      assert.deepEqual(busB.read("node.scm.home-a"), fromA);
      assert.equal(hear(busA, store, "bus.scm.a", "node.scm.home-b"), undefined);
    }),
  );
});

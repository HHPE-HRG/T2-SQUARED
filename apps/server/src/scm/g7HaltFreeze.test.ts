// @effect-diagnostics nodeBuiltinImport:off
// @effect-diagnostics globalErrorInEffectCatch:off
// @effect-diagnostics globalErrorInEffectFailure:off
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
 *
 * OTEL: observeBusPosition emits t2.scm.freeze / t2.scm.halt after a
 * successful set; recommendStop emits t2.scm.recommend_stop without DIP write.
 *
 * admitPublish: known identity publishes; unknown node_id freezes that bus
 * without writing the word; already-frozen buses stay frozen.
 *
 * Package: loadG7Package/checkG7 legal completed tuple, G4/G5/G6 later-gate
 * flags stay false, G3 halt_initiator never yes. Halt both homes needs two
 * DIP writes. Mute-source is not freeze (bridge still forwards).
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";
import { trace } from "@opentelemetry/api";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { T2Observability, layerTest } from "../t2Observability/T2Observability.ts";
import { checkW1Word, loadG4Package, type W1Word } from "./g4Word.ts";
import { InProcessOpenLoopBus, loadG5Package } from "./g5OpenLoop.ts";
import {
  admitPublish,
  DipMuteFailure,
  DipMuteStore,
  hear,
  loadG6Package,
  observeBusPosition,
  recommendStop,
  STEWARD_ACTOR,
  type AuthorityClass,
  type DipActor,
  type DipRow,
  type GovernedClasses,
} from "./g6DipMute.ts";
import { BidirectionalHomeBusLink, type BridgeRoute } from "./g6HomeBusLink.ts";
import { checkG7, loadG7Package } from "./g7HaltFreeze.ts";

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

/**
 * Isolated T2 layerTest exporter file. Intended: never T3 server.trace.ndjson.
 * Observed: unique tmp path per test; tests do not call setGlobalTracerProvider.
 */
const makeOtelFilePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "t2-scm-g7-")), "t2.trace.ndjson");

describe("G7 OTEL freeze/halt and 404 recommend-stop", () => {
  it.effect(
    "recommendStop emits t2.scm.recommend_stop; DIP stays live; bus still publishes",
    () => {
      const exporter = new InMemorySpanExporter();
      const store = new DipMuteStore(loadFixtureGoverned());
      const busA = new InProcessOpenLoopBus({
        mutationGuard: () => store.assertMutable("bus.scm.a"),
      });
      return Effect.gen(function* () {
        yield* recommendStop("node.observer.404", "404 recommend-stop");
        assert.equal(store.busPosition("bus.scm.a"), "live");
        const word = checkedWord("bus.scm.a", "node.scm.home-a", "after-recommend");
        busA.publish(word);
        busA.advanceFundamentalTimestep();
        assert.deepEqual(busA.read("node.scm.home-a"), word);
        const t2 = yield* T2Observability;
        yield* t2.forceFlush;
        const stops = exporter
          .getFinishedSpans()
          .filter((span) => span.name === "t2.scm.recommend_stop");
        assert.equal(stops.length, 1);
        assert.equal(stops[0]?.attributes["t2.scm.node_id"], "node.observer.404");
        assert.equal(stops[0]?.attributes["t2.scm.reason"], "404 recommend-stop");
        const freezes = exporter.getFinishedSpans().filter((span) => span.name === "t2.scm.freeze");
        const halts = exporter.getFinishedSpans().filter((span) => span.name === "t2.scm.halt");
        assert.equal(freezes.length, 0);
        assert.equal(halts.length, 0);
      }).pipe(Effect.provide(layerTest({ exporter, filePath: makeOtelFilePath() })));
    },
  );

  it.effect("steward freeze wrapped in observeBusPosition emits t2.scm.freeze", () => {
    const exporter = new InMemorySpanExporter();
    const store = new DipMuteStore(loadFixtureGoverned());
    return Effect.gen(function* () {
      yield* observeBusPosition(
        {
          bus_id: "bus.scm.a",
          position: "frozen",
          reason: "steward freeze",
          node_id: STEWARD_ACTOR.node_id,
        },
        Effect.sync(() => {
          store.setBusPosition("bus.scm.a", "frozen", STEWARD_ACTOR);
        }),
      );
      assert.equal(store.busPosition("bus.scm.a"), "frozen");
      const t2 = yield* T2Observability;
      yield* t2.forceFlush;
      const freezes = exporter.getFinishedSpans().filter((span) => span.name === "t2.scm.freeze");
      assert.equal(freezes.length, 1);
      assert.equal(freezes[0]?.attributes["t2.scm.bus_id"], "bus.scm.a");
      assert.equal(freezes[0]?.attributes["t2.scm.position"], "frozen");
      assert.equal(freezes[0]?.attributes["t2.scm.reason"], "steward freeze");
      assert.equal(freezes[0]?.attributes["t2.scm.node_id"], "steward.test");
      const halts = exporter.getFinishedSpans().filter((span) => span.name === "t2.scm.halt");
      assert.equal(halts.length, 0);
    }).pipe(Effect.provide(layerTest({ exporter, filePath: makeOtelFilePath() })));
  });

  it.effect("observer setBusPosition throws and emits no freeze span", () => {
    const exporter = new InMemorySpanExporter();
    const store = new DipMuteStore(loadFixtureGoverned());
    return Effect.gen(function* () {
      const exit = yield* observeBusPosition(
        {
          bus_id: "bus.scm.a",
          position: "frozen",
          reason: "observer freeze",
          node_id: OBSERVER_ACTOR.node_id,
        },
        Effect.try({
          try: () => {
            store.setBusPosition("bus.scm.a", "frozen", OBSERVER_ACTOR);
          },
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        }),
      ).pipe(Effect.exit);
      assert.equal(Exit.isFailure(exit), true);
      assert.equal(store.busPosition("bus.scm.a"), "live");
      const t2 = yield* T2Observability;
      yield* t2.forceFlush;
      const freezes = exporter.getFinishedSpans().filter((span) => span.name === "t2.scm.freeze");
      assert.equal(freezes.length, 0);
    }).pipe(Effect.provide(layerTest({ exporter, filePath: makeOtelFilePath() })));
  });

  it.effect("tracer provider identity unchanged", () => {
    const exporter = new InMemorySpanExporter();
    const before = trace.getTracerProvider();
    const store = new DipMuteStore(loadFixtureGoverned());
    return Effect.gen(function* () {
      yield* recommendStop("node.observer.404", "identity check");
      yield* observeBusPosition(
        {
          bus_id: "bus.scm.a",
          position: "halted",
          reason: "steward halt",
          node_id: STEWARD_ACTOR.node_id,
        },
        Effect.sync(() => {
          store.setBusPosition("bus.scm.a", "halted", STEWARD_ACTOR);
        }),
      );
      const t2 = yield* T2Observability;
      yield* t2.forceFlush;
      const halts = exporter.getFinishedSpans().filter((span) => span.name === "t2.scm.halt");
      assert.equal(halts.length, 1);
      assert.equal(trace.getTracerProvider(), before);
    }).pipe(Effect.provide(layerTest({ exporter, filePath: makeOtelFilePath() })));
  });
});

describe("G7 admitPublish unknown identity freeze", () => {
  it("known identity publishes onto the writing bus", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    const bus = new InProcessOpenLoopBus({
      mutationGuard: () => store.assertMutable("bus.scm.a"),
    });
    const word = checkedWord("bus.scm.a", "node.scm.home-a", "known-identity");
    admitPublish(bus, store, "bus.scm.a", word);
    bus.advanceFundamentalTimestep();
    assert.deepEqual(bus.read("node.scm.home-a"), word);
    assert.equal(store.busPosition("bus.scm.a"), "live");
  });

  it("unknown node_id freezes that bus only; word never reaches writing or readable", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    const busA = new InProcessOpenLoopBus({
      mutationGuard: () => store.assertMutable("bus.scm.a"),
    });
    const busB = new InProcessOpenLoopBus({
      mutationGuard: () => store.assertMutable("bus.scm.b"),
    });
    const unknown = checkedWord("bus.scm.a", "node.unknown.intruder", "unknown-identity");
    assert.throws(() => admitPublish(busA, store, "bus.scm.a", unknown), DipMuteFailure);
    assert.equal(store.busPosition("bus.scm.a"), "frozen");
    assert.equal(store.busPosition("bus.scm.b"), "live");
    assert.throws(() => busA.advanceFundamentalTimestep(), DipMuteFailure);
    assert.equal(busA.read("node.unknown.intruder"), undefined);
    const liveB = checkedWord("bus.scm.b", "node.scm.home-b", "still-live");
    busB.publish(liveB);
    busB.advanceFundamentalTimestep();
    assert.deepEqual(busB.read("node.scm.home-b"), liveB);
  });

  it("already frozen: admitPublish throws and position stays frozen", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    const bus = new InProcessOpenLoopBus({
      mutationGuard: () => store.assertMutable("bus.scm.a"),
    });
    store.setBusPosition("bus.scm.a", "frozen", STEWARD_ACTOR);
    const word = checkedWord("bus.scm.a", "node.scm.home-a", "after-freeze");
    assert.throws(() => admitPublish(bus, store, "bus.scm.a", word), DipMuteFailure);
    assert.equal(store.busPosition("bus.scm.a"), "frozen");
    assert.throws(() => bus.advanceFundamentalTimestep(), DipMuteFailure);
    assert.equal(bus.read("node.scm.home-a"), undefined);
  });
});

describe("G7 halt both homes and package barrier", () => {
  it("halt both homes via two setBusPosition halted writes; both refuse publish", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    const { busA, busB } = g7LinkedHomes(store);
    store.setBusPosition("bus.scm.a", "halted", STEWARD_ACTOR);
    store.setBusPosition("bus.scm.b", "halted", STEWARD_ACTOR);
    assert.equal(store.busPosition("bus.scm.a"), "halted");
    assert.equal(store.busPosition("bus.scm.b"), "halted");
    assert.throws(
      () => busA.publish(checkedWord("bus.scm.a", "node.scm.home-a", "halted-a")),
      DipMuteFailure,
    );
    assert.throws(
      () => busB.publish(checkedWord("bus.scm.b", "node.scm.home-b", "halted-b")),
      DipMuteFailure,
    );
  });

  it("keeps G4/G5 g6toG10Authorized false", () => {
    assert.equal(loadG4Package(repoRoot).manifest.g6toG10Authorized, false);
    assert.equal(loadG5Package(repoRoot).manifest.g6toG10Authorized, false);
  });

  it("keeps G6 g7toG10Authorized false", () => {
    assert.equal(loadG6Package(repoRoot).manifest.g7toG10Authorized, false);
  });

  it("G3 node-roster.json has no halt_initiator yes", () => {
    const roster = JSON.parse(
      readFileSync(join(repoRoot, "docs/scm/g3/node-roster.json"), "utf8"),
    ) as { readonly nodes: ReadonlyArray<{ readonly halt_initiator: string }> };
    for (const node of roster.nodes) {
      assert.notEqual(node.halt_initiator, "yes");
    }
  });

  it("checkG7 accepts the legal completed tuple without a review hash", () => {
    const pkg = loadG7Package(repoRoot);
    const result = checkG7(pkg);
    assert.equal(
      result.ok,
      true,
      result.ok ? "" : result.failures.map((row) => row.message).join("\n"),
    );
    assert.equal(pkg.manifest.schemaVersion, 1);
    assert.equal(pkg.manifest.gate, "G7");
    assert.equal(pkg.manifest.status, "completed");
    assert.equal(pkg.manifest.authorized, true);
    assert.equal(pkg.manifest.completed, true);
    assert.equal(pkg.manifest.doesNotAuthorizeLaterGates, true);
    assert.equal(pkg.manifest.g8toG10Authorized, false);
    assert.equal(pkg.manifest.plan, "docs/superpowers/plans/2026-09-20-scm-g7-halt-freeze.md");
    assert.equal(pkg.manifest.authorization.identity, "human-operator");
    assert.equal(pkg.manifest.authorization.scope, "G7 halt vs 404");
    assert.ok(pkg.manifest.authorization.note.includes("2026-09-20"));
  });

  it("rejects later-gate authorization flags", () => {
    const pkg = loadG7Package(repoRoot);
    const mutated = structuredClone(pkg);
    mutated.manifest.g8toG10Authorized = true as unknown as false;
    mutated.manifest.doesNotAuthorizeLaterGates = false as unknown as true;
    const result = checkG7(mutated);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.failures.some((row) => row.code === "later-gates"));
  });

  it("README states DIP freeze/halt, bridge obeys, no campaign, OTEL, 404, G8-G10 locked", () => {
    const readme = readFileSync(join(repoRoot, "docs/scm/g7/README.md"), "utf8");
    assert.ok(readme.includes("DIP"));
    assert.ok(readme.includes("bridge"));
    assert.ok(readme.includes("campaign"));
    assert.ok(readme.includes("OTEL"));
    assert.ok(readme.includes("404"));
    assert.ok(readme.includes("recommend-stop"));
    assert.ok(readme.includes("G8"));
  });
});

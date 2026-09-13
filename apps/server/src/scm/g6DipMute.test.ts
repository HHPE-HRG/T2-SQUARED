/**
 * G6 DIP store mute-law tests, hear-path projection, and two-home
 * bridge proof matrix (Tasks 2–4).
 *
 * Proves D12 set-time validation, concrete-over-wildcard resolve,
 * immutable-row protection, hear-only mute, and mute one/both/none on
 * BidirectionalHomeBusLink without muting publish or bridge forward.
 * Does not cover OTEL or G6 package docs.
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
  type AuthorityClass,
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

const loadFixtureGoverned = (): GovernedClasses => {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g6/governed-classes.json"), "utf8"),
  ) as GovernedClassesJson;
  return governedFromJson(raw);
};

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

describe("G6 DIP store mute law", () => {
  it("1. setDip accepts A2 mute-source of A2 peer", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    store.setDip(a2PeerMute());
    const rows = store.listDip("bus.scm.a");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.mode, "mute-source");
    assert.equal(rows[0]?.source_node_id, "node.scm.home-b");
    assert.equal(store.resolveMode("bus.scm.a", "bus.scm.b", "node.scm.home-b"), "mute-source");
  });

  it("2. setDip rejects mute-source when source class > receiving class", () => {
    const governed = governedFromJson({
      authority_bus_id: "bus.scm.authority",
      buses: { "bus.scm.a": "A2", "bus.scm.higher": "A1" },
      nodes: { "node.scm.home-a": "A2", "node.scm.higher": "A1" },
    });
    const store = new DipMuteStore(governed);
    assert.throws(
      () =>
        store.setDip({
          receiving_bus_id: "bus.scm.a",
          receiving_authority_class: "A2",
          source_bus_id: "bus.scm.higher",
          source_node_id: "node.scm.higher",
          source_authority_class: "A1",
          mode: "mute-source",
          steward: "steward.test",
          runtime_mutable: true,
        }),
      DipMuteFailure,
    );
    assert.equal(store.listDip("bus.scm.a").length, 0);
  });

  it("3. setDip rejects mute-modifiers when source class > receiving class", () => {
    const governed = governedFromJson({
      authority_bus_id: "bus.scm.authority",
      buses: { "bus.scm.a": "A2", "bus.scm.higher": "A1" },
      nodes: { "node.scm.home-a": "A2", "node.scm.higher": "A1" },
    });
    const store = new DipMuteStore(governed);
    assert.throws(
      () =>
        store.setDip({
          receiving_bus_id: "bus.scm.a",
          receiving_authority_class: "A2",
          source_bus_id: "bus.scm.higher",
          source_node_id: "node.scm.higher",
          source_authority_class: "A1",
          mode: "mute-modifiers",
          steward: "steward.test",
          runtime_mutable: true,
        }),
      DipMuteFailure,
    );
    assert.equal(store.listDip("bus.scm.a").length, 0);
  });

  it("4. setDip rejects any mute targeting bus.scm.authority", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    const authorityMute = (mode: "mute-source" | "mute-modifiers"): DipRow => ({
      receiving_bus_id: "bus.scm.a",
      receiving_authority_class: "A2",
      source_bus_id: "bus.scm.authority",
      source_node_id: "node.scm.authority",
      source_authority_class: "A0",
      mode,
      steward: "steward.test",
      runtime_mutable: true,
    });
    assert.throws(() => store.setDip(authorityMute("mute-source")), DipMuteFailure);
    assert.throws(() => store.setDip(authorityMute("mute-modifiers")), DipMuteFailure);
    assert.equal(store.listDip("bus.scm.a").length, 0);
    store.setDip({
      ...authorityMute("hear"),
      mode: "hear",
    });
    assert.equal(store.resolveMode("bus.scm.a", "bus.scm.authority", "node.scm.authority"), "hear");
  });

  it("5. setDip rejects DIP class ≠ governed class for receiver and source", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    assert.throws(
      () => store.setDip(a2PeerMute({ receiving_authority_class: "A0" })),
      DipMuteFailure,
    );
    assert.throws(
      () =>
        store.setDip(
          a2PeerMute({
            source_node_id: "*",
            source_authority_class: "A0",
          }),
        ),
      DipMuteFailure,
    );
    assert.throws(() => store.setDip(a2PeerMute({ source_authority_class: "A0" })), DipMuteFailure);
    assert.throws(
      () => store.setDip(a2PeerMute({ source_node_id: "node.unknown" })),
      DipMuteFailure,
    );
    assert.throws(() => store.setDip(a2PeerMute({ receiving_bus_id: "" })), DipMuteFailure);
    assert.throws(
      () => store.setDip(a2PeerMute({ mode: "not-a-mode" as DipRow["mode"] })),
      DipMuteFailure,
    );
    assert.throws(
      () => store.setDip(a2PeerMute({ receiving_authority_class: "A9" as AuthorityClass })),
      DipMuteFailure,
    );
    assert.equal(store.listDip("bus.scm.a").length, 0);
  });

  it("6. invalid setDip leaves prior rows intact", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    store.setDip(a2PeerMute());
    const before = store.listDip("bus.scm.a");
    assert.equal(before.length, 1);
    assert.throws(
      () => store.setDip(a2PeerMute({ receiving_authority_class: "A1" })),
      DipMuteFailure,
    );
    const after = store.listDip("bus.scm.a");
    assert.equal(after.length, 1);
    assert.equal(after[0]?.mode, "mute-source");
    assert.equal(after[0]?.source_node_id, "node.scm.home-b");
  });

  it("7. wildcard + concrete: concrete wins for that node; wildcard for others", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    store.setDip(
      a2PeerMute({
        source_node_id: "*",
        source_authority_class: "A2",
        mode: "hear",
      }),
    );
    store.setDip(a2PeerMute({ mode: "mute-source" }));
    assert.equal(store.resolveMode("bus.scm.a", "bus.scm.b", "node.scm.home-b"), "mute-source");
    assert.equal(store.resolveMode("bus.scm.a", "bus.scm.b", "node.scm.home-a"), "hear");
    assert.equal(store.resolveMode("bus.scm.a", "bus.scm.b", "node.other"), "hear");
    assert.equal(store.resolveMode("bus.scm.a", "bus.scm.authority", "node.scm.authority"), "hear");
  });

  it("8. setDip upsert replaces same key mode hear → mute-source", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    store.setDip(a2PeerMute({ mode: "hear" }));
    assert.equal(store.resolveMode("bus.scm.a", "bus.scm.b", "node.scm.home-b"), "hear");
    store.setDip(a2PeerMute({ mode: "mute-source" }));
    const rows = store.listDip("bus.scm.a");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.mode, "mute-source");
    assert.equal(store.resolveMode("bus.scm.a", "bus.scm.b", "node.scm.home-b"), "mute-source");
  });

  it("9. runtime_mutable false row cannot be mutated via setDip/removeDip after install", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    store.setDip(a2PeerMute({ runtime_mutable: false }));
    assert.equal(store.listDip("bus.scm.a").length, 1);
    assert.throws(
      () => store.setDip(a2PeerMute({ runtime_mutable: false, mode: "hear" })),
      DipMuteFailure,
    );
    assert.throws(
      () => store.setDip(a2PeerMute({ runtime_mutable: true, mode: "hear" })),
      DipMuteFailure,
    );
    assert.throws(
      () => store.removeDip("bus.scm.a", "bus.scm.b", "node.scm.home-b"),
      DipMuteFailure,
    );
    const rows = store.listDip("bus.scm.a");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.mode, "mute-source");
    assert.equal(rows[0]?.runtime_mutable, false);
  });
});

/**
 * Checked W1 word for hear tests. Intended: valid fundamentals plus optional
 * prototype modifiers. Observed: throws if checkW1Word fails.
 *
 * Parameters
 * ----------
 * bus_id : string
 *     Origin bus identity preserved through hear.
 * node_id : string
 *     Origin node identity; also the bus.read key.
 * modifiers : ReadonlyArray<string>
 *     Prototype mute-modifiers tokens; default empty.
 *
 * Returns
 * -------
 * W1Word
 *     Word accepted by checkW1Word.
 *
 * Example
 * -------
 * const word = checkedWord("bus.scm.b", "node.scm.home-b", ["attn-low"]);
 */
const checkedWord = (
  bus_id: string,
  node_id: string,
  modifiers: ReadonlyArray<string> = [],
): W1Word => {
  const checked = checkW1Word({
    bus_id,
    node_id,
    fundamental_state: "active",
    fundamental_request: "canonical-absence",
    state_age: 0,
    request_age: 0,
    modifier_start: "modifier_start",
    null: "null",
    modifiers,
  });
  if (!checked.ok) {
    throw new Error(checked.failures.map((failure) => failure.message).join("\n"));
  }
  return checked.word;
};

describe("G6 DIP hear projection", () => {
  it("mute-source: read still has word, hear is undefined", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    store.setDip(a2PeerMute({ mode: "mute-source" }));
    const bus = new InProcessOpenLoopBus();
    const word = checkedWord("bus.scm.b", "node.scm.home-b");
    bus.publish(word);
    bus.advanceFundamentalTimestep();
    assert.deepEqual(bus.read("node.scm.home-b"), word);
    assert.equal(hear(bus, store, "bus.scm.a", "node.scm.home-b"), undefined);
  });

  it("mute-modifiers: hear clears modifiers; read still has them", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    store.setDip(a2PeerMute({ mode: "mute-modifiers" }));
    const bus = new InProcessOpenLoopBus();
    const word = checkedWord("bus.scm.b", "node.scm.home-b", ["attn-low"]);
    assert.deepEqual(word.modifiers, ["attn-low"]);
    bus.publish(word);
    bus.advanceFundamentalTimestep();
    const stored = bus.read("node.scm.home-b");
    assert.deepEqual(stored?.modifiers, ["attn-low"]);
    const heard = hear(bus, store, "bus.scm.a", "node.scm.home-b");
    assert.ok(heard !== undefined);
    assert.deepEqual(heard.modifiers, []);
    assert.equal(heard.bus_id, word.bus_id);
    assert.equal(heard.node_id, word.node_id);
    assert.equal(heard.fundamental_state, word.fundamental_state);
    assert.deepEqual(stored?.modifiers, ["attn-low"]);
  });

  it("no DIP: hear equals read", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    const bus = new InProcessOpenLoopBus();
    const word = checkedWord("bus.scm.b", "node.scm.home-b", ["attn-low"]);
    bus.publish(word);
    bus.advanceFundamentalTimestep();
    const stored = bus.read("node.scm.home-b");
    const heard = hear(bus, store, "bus.scm.a", "node.scm.home-b");
    assert.deepEqual(heard, stored);
    assert.deepEqual(heard, word);
  });

  it("restore: upsert mode to hear; hear returns word without republish", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    store.setDip(a2PeerMute({ mode: "mute-source" }));
    const bus = new InProcessOpenLoopBus();
    const word = checkedWord("bus.scm.b", "node.scm.home-b");
    bus.publish(word);
    bus.advanceFundamentalTimestep();
    assert.equal(hear(bus, store, "bus.scm.a", "node.scm.home-b"), undefined);
    store.setDip(a2PeerMute({ mode: "hear" }));
    assert.deepEqual(hear(bus, store, "bus.scm.a", "node.scm.home-b"), word);
    assert.deepEqual(bus.read("node.scm.home-b"), word);
  });

  it("stale mismatch: hear with disagreeing governed admits the full word", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    store.setDip(a2PeerMute({ mode: "mute-source" }));
    const bus = new InProcessOpenLoopBus();
    const word = checkedWord("bus.scm.b", "node.scm.home-b", ["attn-low"]);
    bus.publish(word);
    bus.advanceFundamentalTimestep();
    assert.equal(hear(bus, store, "bus.scm.a", "node.scm.home-b"), undefined);
    const staleGoverned = governedFromJson({
      authority_bus_id: "bus.scm.authority",
      buses: {
        "bus.scm.authority": "A0",
        "bus.scm.a": "A2",
        "bus.scm.b": "A2",
      },
      nodes: {
        "node.scm.authority": "A0",
        "node.scm.home-a": "A2",
        "node.scm.home-b": "A1",
      },
    });
    const heard = hear(bus, store, "bus.scm.a", "node.scm.home-b", { governed: staleGoverned });
    assert.deepEqual(heard, word);
    assert.deepEqual(bus.read("node.scm.home-b"), word);
  });
});

/**
 * Inverse child-home routes for the G6 proof matrix. Intended: exactly
 * two inverse routes so BidirectionalHomeBusLink can construct. Observed:
 * authority traffic is not a third linked bus; it is published locally.
 */
const routeScmAtoB: BridgeRoute = {
  route_id: "route.scm.a-to-b",
  source_bus_id: "bus.scm.a",
  destination_bus_id: "bus.scm.b",
  allowed_origin_node_ids: ["node.scm.home-a"],
  enabled: true,
};

const routeScmBtoA: BridgeRoute = {
  route_id: "route.scm.b-to-a",
  source_bus_id: "bus.scm.b",
  destination_bus_id: "bus.scm.a",
  allowed_origin_node_ids: ["node.scm.home-b"],
  enabled: true,
};

/**
 * Two A2 home buses plus inverse link. Intended: publish on a source is
 * readable on the destination after two link.advanceFundamentalTimestep
 * calls (T+2). Observed: first advance delivers; second makes dest read
 * visible. Does not include bus.scm.authority (link requires two buses).
 *
 * Returns
 * -------
 * { busA, busB, link }
 *     Child homes keyed bus.scm.a / bus.scm.b.
 *
 * Example
 * -------
 * const { busA, busB, link } = twoHomeFixture();
 */
const twoHomeFixture = (): {
  readonly busA: InProcessOpenLoopBus;
  readonly busB: InProcessOpenLoopBus;
  readonly link: BidirectionalHomeBusLink;
} => {
  const busA = new InProcessOpenLoopBus();
  const busB = new InProcessOpenLoopBus();
  const link = new BidirectionalHomeBusLink({
    buses: new Map([
      ["bus.scm.a", busA],
      ["bus.scm.b", busB],
    ]),
    routes: [routeScmAtoB, routeScmBtoA],
  });
  return { busA, busB, link };
};

/**
 * B→A mute-source row (inverse of a2PeerMute). Intended: bus.scm.b
 * mutes node.scm.home-a. Observed: same A2 classes as fixture JSON.
 */
const bMutesA = (overrides: Partial<DipRow> = {}): DipRow =>
  a2PeerMute({
    receiving_bus_id: "bus.scm.b",
    source_bus_id: "bus.scm.a",
    source_node_id: "node.scm.home-a",
    ...overrides,
  });

/**
 * Two-home bridge proof matrix (Task 4).
 *
 * Mute is hear-only: publish and BidirectionalHomeBusLink forward stay
 * unfiltered. Destination read after T+2 still holds bridged words when
 * hear is silenced. Authority parent is never a third linked bus;
 * authority-origin words are published directly onto a child bus.
 */
describe("G6 DIP two-home bridge proof matrix", () => {
  it.effect("1. no mute: each hear()s the other after T+2", () =>
    Effect.gen(function* () {
      const store = new DipMuteStore(loadFixtureGoverned());
      const { busA, busB, link } = twoHomeFixture();
      const fromA = checkedWord("bus.scm.a", "node.scm.home-a");
      const fromB = checkedWord("bus.scm.b", "node.scm.home-b");

      busA.publish(fromA);
      busB.publish(fromB);
      assert.equal(hear(busA, store, "bus.scm.a", "node.scm.home-b"), undefined);
      assert.equal(hear(busB, store, "bus.scm.b", "node.scm.home-a"), undefined);

      const first = yield* link.advanceFundamentalTimestep();
      assert.equal(first.deliveries.length, 2);
      assert.deepEqual(first.failures, []);
      assert.equal(busA.read("node.scm.home-b"), undefined);
      assert.equal(busB.read("node.scm.home-a"), undefined);

      yield* link.advanceFundamentalTimestep();
      assert.deepEqual(busA.read("node.scm.home-b"), fromB);
      assert.deepEqual(busB.read("node.scm.home-a"), fromA);
      assert.deepEqual(hear(busA, store, "bus.scm.a", "node.scm.home-b"), fromB);
      assert.deepEqual(hear(busB, store, "bus.scm.b", "node.scm.home-a"), fromA);
    }),
  );

  it.effect("2. mute one side: A mute-source B; A hear B undefined; B hear A present", () =>
    Effect.gen(function* () {
      const store = new DipMuteStore(loadFixtureGoverned());
      store.setDip(a2PeerMute({ mode: "mute-source" }));
      const { busA, busB, link } = twoHomeFixture();
      const fromA = checkedWord("bus.scm.a", "node.scm.home-a");
      const fromB = checkedWord("bus.scm.b", "node.scm.home-b");

      busA.publish(fromA);
      busB.publish(fromB);
      const first = yield* link.advanceFundamentalTimestep();
      assert.equal(first.deliveries.length, 2);
      assert.deepEqual(first.failures, []);
      yield* link.advanceFundamentalTimestep();

      assert.deepEqual(busA.read("node.scm.home-b"), fromB);
      assert.deepEqual(busB.read("node.scm.home-a"), fromA);
      assert.equal(hear(busA, store, "bus.scm.a", "node.scm.home-b"), undefined);
      assert.deepEqual(hear(busB, store, "bus.scm.b", "node.scm.home-a"), fromA);
    }),
  );

  it.effect("3. mute both: neither hears the other; read still sees peer", () =>
    Effect.gen(function* () {
      const store = new DipMuteStore(loadFixtureGoverned());
      store.setDip(a2PeerMute({ mode: "mute-source" }));
      store.setDip(bMutesA({ mode: "mute-source" }));
      const { busA, busB, link } = twoHomeFixture();
      const fromA = checkedWord("bus.scm.a", "node.scm.home-a");
      const fromB = checkedWord("bus.scm.b", "node.scm.home-b");

      busA.publish(fromA);
      busB.publish(fromB);
      const first = yield* link.advanceFundamentalTimestep();
      assert.equal(first.deliveries.length, 2);
      yield* link.advanceFundamentalTimestep();

      assert.deepEqual(busA.read("node.scm.home-b"), fromB);
      assert.deepEqual(busB.read("node.scm.home-a"), fromA);
      assert.equal(hear(busA, store, "bus.scm.a", "node.scm.home-b"), undefined);
      assert.equal(hear(busB, store, "bus.scm.b", "node.scm.home-a"), undefined);
    }),
  );

  it.effect(
    "4. mute-modifiers: A hears B fundamentals; hear.modifiers []; read keeps modifiers",
    () =>
      Effect.gen(function* () {
        const store = new DipMuteStore(loadFixtureGoverned());
        store.setDip(a2PeerMute({ mode: "mute-modifiers" }));
        const { busA, busB, link } = twoHomeFixture();
        const fromA = checkedWord("bus.scm.a", "node.scm.home-a");
        const fromB = checkedWord("bus.scm.b", "node.scm.home-b", ["attn-low"]);

        busA.publish(fromA);
        busB.publish(fromB);
        const first = yield* link.advanceFundamentalTimestep();
        assert.equal(first.deliveries.length, 2);
        yield* link.advanceFundamentalTimestep();

        const stored = busA.read("node.scm.home-b");
        assert.deepEqual(stored?.modifiers, ["attn-low"]);
        const heard = hear(busA, store, "bus.scm.a", "node.scm.home-b");
        assert.ok(heard !== undefined);
        assert.deepEqual(heard.modifiers, []);
        assert.equal(heard.bus_id, fromB.bus_id);
        assert.equal(heard.node_id, fromB.node_id);
        assert.equal(heard.fundamental_state, fromB.fundamental_state);
        assert.deepEqual(busA.read("node.scm.home-b")?.modifiers, ["attn-low"]);
      }),
  );

  it("5. authority mute attempt: setDip throws; authority word still heard on child", () => {
    const store = new DipMuteStore(loadFixtureGoverned());
    const busA = new InProcessOpenLoopBus();
    const authorityWord = checkedWord("bus.scm.authority", "node.scm.authority");
    busA.publish(authorityWord);
    busA.advanceFundamentalTimestep();

    const authorityMute = (mode: "mute-source" | "mute-modifiers"): DipRow => ({
      receiving_bus_id: "bus.scm.a",
      receiving_authority_class: "A2",
      source_bus_id: "bus.scm.authority",
      source_node_id: "node.scm.authority",
      source_authority_class: "A0",
      mode,
      steward: "steward.test",
      runtime_mutable: true,
    });
    assert.throws(() => store.setDip(authorityMute("mute-source")), DipMuteFailure);
    assert.throws(() => store.setDip(authorityMute("mute-modifiers")), DipMuteFailure);
    assert.deepEqual(busA.read("node.scm.authority"), authorityWord);
    assert.deepEqual(hear(busA, store, "bus.scm.a", "node.scm.authority"), authorityWord);
  });

  it("6. higher-class mute-modifiers: setDip throws (A2 receiving, A1 source)", () => {
    const governed = governedFromJson({
      authority_bus_id: "bus.scm.authority",
      buses: { "bus.scm.a": "A2", "bus.scm.higher": "A1" },
      nodes: { "node.scm.home-a": "A2", "node.scm.higher": "A1" },
    });
    const store = new DipMuteStore(governed);
    assert.throws(
      () =>
        store.setDip({
          receiving_bus_id: "bus.scm.a",
          receiving_authority_class: "A2",
          source_bus_id: "bus.scm.higher",
          source_node_id: "node.scm.higher",
          source_authority_class: "A1",
          mode: "mute-modifiers",
          steward: "steward.test",
          runtime_mutable: true,
        }),
      DipMuteFailure,
    );
    assert.equal(store.listDip("bus.scm.a").length, 0);
  });

  it.effect("7. publish continues while muted: storage/read updates; hear stays undefined", () =>
    Effect.gen(function* () {
      const store = new DipMuteStore(loadFixtureGoverned());
      store.setDip(a2PeerMute({ mode: "mute-source" }));
      const { busA, busB, link } = twoHomeFixture();
      const firstWord = checkedWord("bus.scm.b", "node.scm.home-b", ["attn-low"]);
      busB.publish(firstWord);
      yield* link.advanceFundamentalTimestep();
      yield* link.advanceFundamentalTimestep();
      assert.deepEqual(busA.read("node.scm.home-b"), firstWord);
      assert.equal(hear(busA, store, "bus.scm.a", "node.scm.home-b"), undefined);

      const nextWord = checkedWord("bus.scm.b", "node.scm.home-b", ["attn-high"]);
      busB.publish(nextWord);
      const third = yield* link.advanceFundamentalTimestep();
      assert.equal(third.deliveries.length, 1);
      assert.equal(third.deliveries[0]?.origin_node_id, "node.scm.home-b");
      yield* link.advanceFundamentalTimestep();
      assert.deepEqual(busA.read("node.scm.home-b"), nextWord);
      assert.notDeepEqual(busA.read("node.scm.home-b"), firstWord);
      assert.equal(hear(busA, store, "bus.scm.a", "node.scm.home-b"), undefined);
    }),
  );
});

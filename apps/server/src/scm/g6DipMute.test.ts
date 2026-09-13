/**
 * G6 DIP store mute-law tests plus hear-path projection (Tasks 2–3).
 *
 * Proves D12 set-time validation, concrete-over-wildcard resolve,
 * immutable-row protection, and hear-only mute. Does not cover OTEL,
 * two-home bridge matrix, or G6 package docs.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";

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

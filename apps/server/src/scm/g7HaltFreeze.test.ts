/**
 * G7 DIP bus-level position tests (store only for this task).
 *
 * Proves governed buses default to live, steward freeze/halt, observer
 * and node.observer.404 denial, unknown-bus fail-closed, mute while live,
 * and mute-row mutation blocked after freeze/halt. No bus guard, bridge
 * DIP consult, OTEL, or recommend-stop in this file yet.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";

import {
  DipMuteFailure,
  DipMuteStore,
  STEWARD_ACTOR,
  type AuthorityClass,
  type DipActor,
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

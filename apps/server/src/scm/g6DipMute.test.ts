/**
 * G6 DIP store mute-law tests (Task 2).
 *
 * Proves D12 set-time validation, concrete-over-wildcard resolve, and
 * immutable-row protection. Does not cover hear(), OTEL, or G6 package docs.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";

import {
  DipMuteFailure,
  DipMuteStore,
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

/**
 * G10 cutover registry tests (S0).
 *
 * Intended: registry matches inventory activatable set; home-bus dormant
 * exempt; radius shrink/expand refused.
 * Observed: assertions below against seam-inventory-completeness.json.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assert, describe, it } from "@effect/vitest";

import {
  G10_DORMANT_HOME_BUS_COMM_ID,
  G10_FABRIC_SLICE_IDS,
  G10_SEAM_INVENTORY_RELATIVE_PATH,
  activatableCommIdsForSlice,
  assertRadiusUnchanged,
  isDormantExempt,
  loadG10CutoverRegistry,
  refuseRadiusExpand,
  refuseRadiusShrink,
  resolveG10RepoRoot,
} from "./g10CutoverRegistry.ts";

const repoRoot = resolveG10RepoRoot();

describe("G10 cutover registry", () => {
  it("loads activatable set matching inventory (73 + 1 dormant of 74)", () => {
    const registry = loadG10CutoverRegistry(repoRoot);
    const raw = JSON.parse(
      readFileSync(join(repoRoot, G10_SEAM_INVENTORY_RELATIVE_PATH), "utf8"),
    ) as {
      completeness: {
        comm_id_count: number;
        per_slice_comm_ids: Record<string, string[]>;
      };
    };

    assert.equal(raw.completeness.comm_id_count, 74);
    assert.equal(registry.inventoryCommIdCount, 74);
    assert.equal(registry.radiusSet.size, 73);
    assert.equal(isDormantExempt(registry, G10_DORMANT_HOME_BUS_COMM_ID), true);
    assert.equal(registry.radiusSet.has(G10_DORMANT_HOME_BUS_COMM_ID), false);

    // Every fabric slice activatable set equals inventory list minus dormant.
    for (const slice of G10_FABRIC_SLICE_IDS) {
      const listed = raw.completeness.per_slice_comm_ids[slice] ?? [];
      const expected = listed.filter((id) => id !== G10_DORMANT_HOME_BUS_COMM_ID);
      assert.deepEqual([...activatableCommIdsForSlice(registry, slice)], expected);
    }

    // Union size matches radius.
    const union = new Set<string>();
    for (const slice of G10_FABRIC_SLICE_IDS) {
      for (const id of registry.bySlice[slice]) union.add(id);
    }
    assert.equal(union.size, registry.radiusSet.size);
    assertRadiusUnchanged(registry, union);
  });

  it("dormant home-bus is exempt from S6 activatable set", () => {
    const registry = loadG10CutoverRegistry(repoRoot);
    assert.equal(registry.bySlice.S6.includes(G10_DORMANT_HOME_BUS_COMM_ID), false);
    assert.equal(activatableCommIdsForSlice(registry, "S0").length, 0);
    assert.equal(activatableCommIdsForSlice(registry, "S8").length, 0);
  });

  it("refuses radius shrink and expand APIs", () => {
    const registry = loadG10CutoverRegistry(repoRoot);
    const sample = [...registry.radiusSet][0]!;
    assert.throws(() => refuseRadiusShrink(registry, [sample]), /shrink refused/);
    assert.throws(
      () => refuseRadiusExpand(registry, ["INV-T2-FAKE-ELEVENTH-BUS"]),
      /expand refused/,
    );
    // Empty proposals are no-ops.
    refuseRadiusShrink(registry, []);
    refuseRadiusExpand(registry, []);
  });
});

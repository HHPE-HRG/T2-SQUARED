/**
 * Fabric-depth FD0 census gate tests.
 */
import { assert, describe, it } from "@effect/vitest";
import { join } from "node:path";

import {
  assertSoleLandersRealForSlice,
  censusAllowsDepthExit,
  loadManifoldIoCensus,
  soleLanderDebtForSlice,
} from "./fabricDepthCensusGate.ts";
import { resolveG10RepoRoot } from "./g10CutoverRegistry.ts";

const censusPath = join(
  resolveG10RepoRoot(),
  "docs/scm/fabric-depth/evidence/manifold-io-census.json",
);

describe("Fabric-depth FD0 census gate", () => {
  it("loads census rows", () => {
    const doc = loadManifoldIoCensus(censusPath);
    assert.ok(doc.rows.length > 0);
  });

  it("S1 sole-lander debt empty (SETTINGS stub is handoff)", () => {
    const doc = loadManifoldIoCensus(censusPath);
    assert.deepEqual(soleLanderDebtForSlice(doc, "S1"), []);
    assert.equal(censusAllowsDepthExit(censusPath, "S1"), true);
    assertSoleLandersRealForSlice(censusPath, "S1");
  });

  it("S4 sole-lander debt empty after Battery FD4", () => {
    const doc = loadManifoldIoCensus(censusPath);
    assert.deepEqual(soleLanderDebtForSlice(doc, "S4"), []);
    assert.equal(censusAllowsDepthExit(censusPath, "S4"), true);
    assertSoleLandersRealForSlice(censusPath, "S4");
  });
});

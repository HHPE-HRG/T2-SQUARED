/**
 * Fabric-depth FD0 bootstrap gate tests.
 *
 * Intended: FD env distinct from cutover; process-live needs both; restart flag.
 */
import { assert, describe, it } from "@effect/vitest";

import { G10_CUTOVER_ENV } from "./g10Bootstrap.ts";
import {
  FABRIC_DEPTH_ENV,
  FABRIC_DEPTH_ENV_DISTINCT_FROM_CUTOVER,
  FABRIC_DEPTH_REQUIRES_RESTART,
  isFabricDepthEnabled,
  isFabricDepthProcessLiveReady,
} from "./fabricDepthBootstrap.ts";

describe("Fabric-depth FD0 bootstrap", () => {
  it("FD env key is distinct from G10 cutover", () => {
    assert.equal(FABRIC_DEPTH_ENV, "T2CODE_SCM_FABRIC_DEPTH");
    assert.equal(FABRIC_DEPTH_ENV_DISTINCT_FROM_CUTOVER, true);
    assert.notEqual(FABRIC_DEPTH_ENV, G10_CUTOVER_ENV);
    assert.equal(FABRIC_DEPTH_REQUIRES_RESTART, true);
  });

  it("isFabricDepthEnabled reads truthy tokens only", () => {
    assert.equal(isFabricDepthEnabled({}), false);
    assert.equal(isFabricDepthEnabled({ [FABRIC_DEPTH_ENV]: "0" }), false);
    assert.equal(isFabricDepthEnabled({ [FABRIC_DEPTH_ENV]: "1" }), true);
    assert.equal(isFabricDepthEnabled({ [FABRIC_DEPTH_ENV]: "TRUE" }), true);
  });

  it("process-live ready requires both cutover and FD", () => {
    assert.equal(isFabricDepthProcessLiveReady({}), false);
    assert.equal(isFabricDepthProcessLiveReady({ [FABRIC_DEPTH_ENV]: "1" }), false);
    assert.equal(isFabricDepthProcessLiveReady({ [G10_CUTOVER_ENV]: "1" }), false);
    assert.equal(
      isFabricDepthProcessLiveReady({
        [G10_CUTOVER_ENV]: "1",
        [FABRIC_DEPTH_ENV]: "1",
      }),
      true,
    );
  });
});

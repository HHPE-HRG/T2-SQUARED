/**
 * Fabric-depth FD8 campaign close tests.
 */
import { assert, describe, it } from "@effect/vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { FABRIC_DEPTH_ENV } from "./fabricDepthBootstrap.ts";
import {
  formatFabricDepthCampaignCloseMarkdown,
  runFabricDepthCampaignClose,
} from "./fabricDepthCampaignClose.ts";
import { resolveG10RepoRoot } from "./g10CutoverRegistry.ts";

const repoRoot = resolveG10RepoRoot();

const withFdEnv = <A>(fn: () => A): A => {
  const prev = process.env[FABRIC_DEPTH_ENV];
  process.env[FABRIC_DEPTH_ENV] = "1";
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[FABRIC_DEPTH_ENV];
    else process.env[FABRIC_DEPTH_ENV] = prev;
  }
};

describe("Fabric-depth FD8 campaign close", () => {
  it("refuses when FD env off", () => {
    assert.throws(() => runFabricDepthCampaignClose(repoRoot, {}), /T2CODE_SCM_FABRIC_DEPTH/);
  });

  it("closes GREEN: all slices retired, debt 0, aggregate forbids 763, rollback re-emits", () => {
    withFdEnv(() => {
      const result = runFabricDepthCampaignClose(repoRoot);
      assert.equal(result.green, true);
      assert.equal(result.censusSoleLanderDebtTotal, 0);
      assert.equal(result.slices.length, 7);
      assert.ok(result.slices.every((s) => s.softFallback === "retired"));
      assert.equal(result.forbids763, true);
      assert.ok(result.aggregateSampleCount > 0);
      assert.equal(result.softFallbackReemitAfterRollback.length, 7);

      const md = formatFabricDepthCampaignCloseMarkdown(result);
      assert.ok(md.includes("**GREEN**"));
      writeFileSync(
        join(repoRoot, "docs/scm/fabric-depth/evidence/FD8-campaign-close.md"),
        md,
        "utf8",
      );
    });
  });
});

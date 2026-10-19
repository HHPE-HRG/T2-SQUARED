/**
 * G10 campaign stack tests (auth-freeze process wire).
 *
 * Intended: present-mode stack installs S1–S7 process-globals and returns a
 * non-empty merged Layer. Observed: assertions below.
 */
import { assert, describe, it } from "@effect/vitest";

import { buildG10CampaignCutoverStack } from "./g10CampaignStack.ts";
import { resolveG10RepoRoot } from "./g10CutoverRegistry.ts";
import { getProcessGlobalG10S1 } from "./g10SliceS1.ts";
import { getProcessGlobalG10S7 } from "./g10SliceS7.ts";

const repoRoot = resolveG10RepoRoot();

describe("G10 campaign cutover stack", () => {
  it("builds non-empty Layer and installs process-globals", () => {
    const { layer, controllers } = buildG10CampaignCutoverStack(repoRoot);
    assert.ok(layer !== undefined);
    assert.equal(controllers.s1.slice, "S1");
    assert.equal(controllers.s7.slice, "S7");
    assert.equal(getProcessGlobalG10S1(), controllers.s1);
    assert.equal(getProcessGlobalG10S7(), controllers.s7);
  });
});

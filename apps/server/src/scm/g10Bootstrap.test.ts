/**
 * G10 bootstrap gate tests (S0).
 *
 * Intended: default off = today’s live; env gate distinct from G9 shadow;
 * no fabric wiring / no server.ts edit / no home-bus import.
 * Observed: assertions below.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";

import { G9_SHADOW_PARITY_ENV } from "./g9Bootstrap.ts";
import {
  G10_CUTOVER_ENV,
  G10_SERVER_MERGE_NOTE,
  g10CutoverStackLayerFromEnv,
  isG10CutoverEnabled,
} from "./g10Bootstrap.ts";
import { authorityForSlice, createSubstitutionModel } from "./g10Substitution.ts";
import { loadG10CutoverRegistry, resolveG10RepoRoot } from "./g10CutoverRegistry.ts";

const here = dirname(fileURLToPath(import.meta.url));
const bootstrapSourcePath = join(here, "g10Bootstrap.ts");
const repoRoot = resolveG10RepoRoot();

describe("G10 bootstrap gate", () => {
  it("defaults off (today’s live); accepts 1/true/yes", () => {
    assert.equal(isG10CutoverEnabled({}), false);
    assert.equal(isG10CutoverEnabled({ [G10_CUTOVER_ENV]: "0" }), false);
    assert.equal(isG10CutoverEnabled({ [G10_CUTOVER_ENV]: "1" }), true);
    assert.equal(isG10CutoverEnabled({ [G10_CUTOVER_ENV]: "TRUE" }), true);
    assert.equal(isG10CutoverEnabled({ [G10_CUTOVER_ENV]: " yes " }), true);
    // G9 shadow on does not enable G10 cutover.
    assert.equal(isG10CutoverEnabled({ [G9_SHADOW_PARITY_ENV]: "1" }), false);
  });

  it("default live authority when cutover env absent", () => {
    const model = createSubstitutionModel(loadG10CutoverRegistry(repoRoot));
    assert.equal(isG10CutoverEnabled({}), false);
    assert.equal(authorityForSlice(model, "S1"), "live");
    assert.ok(g10CutoverStackLayerFromEnv({}) !== undefined);
    assert.ok(G10_SERVER_MERGE_NOTE.includes("server.ts"));
    assert.ok(
      G10_SERVER_MERGE_NOTE.includes("today’s live") || G10_SERVER_MERGE_NOTE.includes("Landed"),
    );
  });

  it("present-mode Layer is non-empty (campaign stack)", () => {
    const present = g10CutoverStackLayerFromEnv({ [G10_CUTOVER_ENV]: "1" });
    const absent = g10CutoverStackLayerFromEnv({});
    // Layer.empty has no residual services; present stack must differ by identity.
    assert.notEqual(present, absent);
    assert.ok(present !== undefined);
  });

  it("bootstrap source does not import fabric seams or home-bus-link", () => {
    const src = readFileSync(bootstrapSourcePath, "utf8");
    // Import path / symbol — comments may mention fabric law in prose.
    assert.equal(/\bfrom\s+["']\.\/g6HomeBusLink\.ts["']/.test(src), false);
    assert.equal(/\bfrom\s+["']\.\.\/ws\.ts["']/.test(src), false);
    assert.equal(
      /\bfrom\s+["']\.\.\/orchestration\/Layers\/OrchestrationEngine\.ts["']/.test(src),
      false,
    );
    assert.equal(/\bfrom\s+["']\.\.\/provider\//.test(src), false);
  });
});

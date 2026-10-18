// @effect-diagnostics nodeBuiltinImport:off
/**
 * G9 WP8 exact-set marathon (RFC-010 A single entrypoint).
 *
 * Intended: prove all counted fixture vectors from fixture-vectors.json execute
 * with zero silent skip; 74 rows each have ≥1 vector; validation count matches;
 * declaration-absence never calls capture; dormant uses B6 fixtures only; no
 * wall sleep in the runner; live Layer absent/present noninterference seams.
 *
 * Observed: assertions below via runG9FixtureMarathon. Complete G9 shadow-label
 * parity claim is allowed only after this proof under authorized bootstrap.
 * Does not flip g9toG10Authorized. Does not authorize G10. No Effect patch.
 * No hand-edit of generated JSON.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { buildG9ShadowStack, g9ShadowStackLayerFromEnv, resolveG9RepoRoot } from "./g9Bootstrap.ts";
import {
  loadG9CoverageValidationSlice,
  loadG9FixtureVectors,
  runG9FixtureMarathon,
} from "./g9FixtureRunner.ts";
import { G9CaptureService } from "./g9OrchQueueCapture.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveG9RepoRoot();
const runnerSourcePath = join(here, "g9FixtureRunner.ts");

describe("G9 WP8 fixture runner (exact-set proof)", () => {
  it("validation slice: 74-set equality + counted_fixture_vector_count 763", () => {
    const validation = loadG9CoverageValidationSlice(repoRoot);
    assert.equal(validation.g1b_unique_count, 74);
    assert.equal(validation.g3_unique_count, 74);
    assert.equal(validation.g9_unique_count, 74);
    assert.equal(validation.top_level_set_equality, true);
    assert.equal(validation.counted_fixture_vector_count, 763);
    assert.equal(validation.declaration_absence_phases.length, 1);
    assert.equal(validation.dormant_prototype_phases.length, 1);
    assert.deepEqual(validation["dormant-prototype"], ["INV-T2-SCM-HOME-BUS-LINK"]);
  });

  it("fixture corpus map size equals counted_fixture_vector_count", () => {
    const validation = loadG9CoverageValidationSlice(repoRoot);
    const fixtures = loadG9FixtureVectors(repoRoot);
    assert.equal(fixtures.schemaVersion, 1);
    assert.equal(Object.keys(fixtures.vectors).length, validation.counted_fixture_vector_count);
  });

  it("runner source has no wall sleep / setTimeout proof crutches", () => {
    const source = readFileSync(runnerSourcePath, "utf8");
    assert.equal(/\bsetTimeout\b/.test(source), false);
    assert.equal(/\bsetInterval\b/.test(source), false);
    assert.equal(/\bAtomics\.wait\b/.test(source), false);
    // Ban sleep( as a call-ish token; comments may still say "no wall sleep".
    assert.equal(/\bsleep\s*\(/.test(source), false);
  });

  it.effect("live noninterference: G9 Layer absent leaves capture unresolved", () =>
    Effect.gen(function* () {
      const opt = yield* Effect.serviceOption(G9CaptureService);
      assert.equal(Option.isNone(opt), true);
    }).pipe(Effect.provide(g9ShadowStackLayerFromEnv({}))),
  );

  it("live noninterference: present stack builds ten-bus coordinator (WP7 dual-Accepted)", () => {
    const stack = buildG9ShadowStack({ repoRoot });
    assert.equal(stack.coordinator.buses.size, 10);
    assert.equal(stack.pkg.rowsByCommId.size, 74);
  });

  it("exact-set marathon: 763 executed, zero failed, zero unmapped, 74 rows covered", () => {
    const manifest = runG9FixtureMarathon(repoRoot);

    // Fail-fast diagnostics: first few failures / unmapped ids (no payloads).
    if (manifest.failed.length > 0) {
      const sample = manifest.failed
        .slice(0, 8)
        .map((f) => `${f.fixture_id}: ${f.reason}`)
        .join("\n");
      assert.fail(`fixture failures (${manifest.failed.length}):\n${sample}`);
    }
    if (manifest.unmapped.length > 0) {
      const sample = manifest.unmapped
        .slice(0, 8)
        .map((u) => `${u.fixture_id}: ${u.reason}`)
        .join("\n");
      assert.fail(`unmapped vectors (${manifest.unmapped.length}):\n${sample}`);
    }

    assert.equal(manifest.counted_fixture_vector_count, 763);
    assert.equal(manifest.executed.length, 763);
    assert.equal(manifest.failed.length, 0);
    assert.equal(manifest.unmapped.length, 0);
    assert.equal(manifest.covered_comm_ids.length, 74);
  });
});

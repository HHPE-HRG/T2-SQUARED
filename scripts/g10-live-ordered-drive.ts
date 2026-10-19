/**
 * G10 live Ordered proof driver (ops).
 *
 * Intended: process-live drive of the same campaign cutover stack the server
 * installs when `T2CODE_SCM_G10_CUTOVER` is on. Runs S1–S7
 * `runFullOrderedProof` then S8 campaign-close helpers. Not vitest harness
 * GREEN and not WP8 763. Does not flip manifest.completed (steward/ops).
 *
 * Observed: prints JSON lines for evidence append. Exit 0 only if all slices
 * + S8 succeed.
 */
import { buildG10CampaignCutoverStack } from "../apps/server/src/scm/g10CampaignStack.ts";
import { isG10CutoverEnabled } from "../apps/server/src/scm/g10Bootstrap.ts";
import { runS8CampaignCloseProof } from "../apps/server/src/scm/g10SliceS8.ts";
import { resolveG10RepoRoot } from "../apps/server/src/scm/g10CutoverRegistry.ts";

const root = resolveG10RepoRoot();
process.env.T2CODE_SCM_G10_CUTOVER ??= "1";

const started = new Date().toISOString();
console.log(
  JSON.stringify({
    phase: "start",
    started,
    shaHint: "d6ca1aaa9+",
    cutoverEnv: isG10CutoverEnabled(),
    repoRoot: root,
  }),
);

const { controllers } = buildG10CampaignCutoverStack(root);
const slices = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"] as const;

type SliceResult = {
  ok: boolean;
  steps: number;
  authority?: string;
  inversion?: boolean;
  error?: string;
};

const results: Record<string, SliceResult> = {};
let failed = false;

for (const key of slices) {
  const ctrl = controllers[key];
  try {
    const bodies = ctrl.runFullOrderedProof();
    results[key.toUpperCase()] = {
      ok: true,
      steps: bodies.length,
      authority: String(ctrl.authority()),
      inversion: ctrl.inversionArmed(),
    };
    console.log(
      JSON.stringify({
        slice: key.toUpperCase(),
        ok: true,
        steps: bodies.length,
        authority: ctrl.authority(),
        inversion: ctrl.inversionArmed(),
      }),
    );
  } catch (e) {
    failed = true;
    results[key.toUpperCase()] = {
      ok: false,
      steps: 0,
      error: e instanceof Error ? e.message : String(e),
    };
    console.log(
      JSON.stringify({
        slice: key.toUpperCase(),
        ok: false,
        error: results[key.toUpperCase()].error,
      }),
    );
    break;
  }
}

if (!failed) {
  try {
    const { audit, rollback, equivalence } = runS8CampaignCloseProof(root);
    results.S8 = { ok: true, steps: 3 };
    console.log(
      JSON.stringify({
        phase: "s8",
        ok: true,
        activatable: audit.activatableCount,
        dormant: audit.dormantExemptCount,
        radiusUnchanged: audit.radiusUnchanged,
        homeBusDormant: audit.homeBusDormant,
        rollbackValid: rollback.valid,
        rollbackAllLive: rollback.allLive,
        equivSamples: equivalence.sampleCount,
        equivCarrier: equivalence.carrier,
      }),
    );
  } catch (e) {
    failed = true;
    results.S8 = {
      ok: false,
      steps: 0,
      error: e instanceof Error ? e.message : String(e),
    };
    console.log(JSON.stringify({ phase: "s8", ok: false, error: results.S8.error }));
  }
}

const finished = new Date().toISOString();
console.log(
  JSON.stringify({
    phase: "done",
    finished,
    results,
    exitCode: failed ? 1 : 0,
  }),
);

process.exit(failed ? 1 : 0);

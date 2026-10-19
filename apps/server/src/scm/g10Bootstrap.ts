/**
 * G10 cutover bootstrap gate (auth-freeze process wire).
 *
 * Intended: optional env gate `T2CODE_SCM_G10_CUTOVER` (default off = today’s
 * live). When present, compose the campaign cutover stack Layer (S1–S7
 * controllers) for server.ts merge. When absent, Layer.empty — no cutover.
 *
 * Observed: non-empty Layer when env on via buildG10CampaignCutoverStack.
 * Distinct from `T2CODE_SCM_G9_SHADOW` (observe-beside). Does not activate
 * home-bus-link. Does not flip auth. Does not run Ordered proof at boot.
 */
import * as Layer from "effect/Layer";

import {
  buildG10CampaignCutoverStack,
  type G10CampaignCutoverServices,
} from "./g10CampaignStack.ts";
import { resolveG10RepoRoot } from "./g10CutoverRegistry.ts";

/**
 * RFC-style production opt-in env key for G10 cutover coordinator.
 *
 * Agent: truthy "1" / "true" / "yes" (case-insensitive) ⇒ present mode.
 * Unset / other ⇒ absent (today’s live; no cutover stack).
 * This is **not** T2CODE_SCM_G9_SHADOW.
 */
export const G10_CUTOVER_ENV = "T2CODE_SCM_G10_CUTOVER" as const;

/** Options for building the cutover stack Layer. */
export type G10CutoverStackOptions = {
  /** Absolute monorepo root (inventory). Defaults to resolveG10RepoRoot(). */
  readonly repoRoot?: string;
};

/**
 * RFC gate: is G10 cutover opted in for this process?
 */
export const isG10CutoverEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const raw = env[G10_CUTOVER_ENV];
  if (raw === undefined) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

/**
 * Present-mode campaign cutover Layer (S1–S7 CutoverServices + process-globals).
 *
 * Intended: called only when env gate is on. Installs controllers so seam
 * bridges resolve. Ordered proof stays ops/live-test owned.
 */
export const makeG10CutoverStackLayer = (
  options: G10CutoverStackOptions = {},
): Layer.Layer<G10CampaignCutoverServices> => {
  const repoRoot = options.repoRoot ?? resolveG10RepoRoot();
  return buildG10CampaignCutoverStack(repoRoot).layer;
};

/**
 * Env-gated Layer: absent ⇒ Layer.empty; present ⇒ campaign cutover stack.
 */
export const g10CutoverStackLayerFromEnv = (
  env: NodeJS.ProcessEnv = process.env,
  options: G10CutoverStackOptions = {},
): Layer.Layer<G10CampaignCutoverServices> => {
  if (!isG10CutoverEnabled(env)) {
    return Layer.empty as Layer.Layer<G10CampaignCutoverServices>;
  }
  return makeG10CutoverStackLayer(options);
};

/**
 * Documentation constant for agents: server.ts merge point (landed).
 */
export const G10_SERVER_MERGE_NOTE =
  "Landed: Layer.provideMerge(g10CutoverStackLayerFromEnv()) in apps/server/src/server.ts. Env off ⇒ today’s live; env on ⇒ S1–S7 cutover services." as const;

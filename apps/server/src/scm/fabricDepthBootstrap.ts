/**
 * Fabric-depth process gate (FD0 contracts).
 *
 * Intended: optional env `T2CODE_SCM_FABRIC_DEPTH` (default off). Distinct from
 * `T2CODE_SCM_G10_CUTOVER` (bridge stack install). Process-live depth drive
 * requires both: cutover installs S1–S7 controllers; FD enables soft-fallback
 * signal/retire + census depth gates. Toggling FD requires process restart
 * (G10 Layer parity) — no hot toggle.
 *
 * Observed: env predicate + docs constants only. Does not install cutover
 * stack. Does not flip fabricDepthAuthorized. Does not invent G11.
 */
import { G10_CUTOVER_ENV } from "./g10Bootstrap.ts";

/**
 * RFC-style production opt-in env key for Fabric-depth depth drive.
 *
 * Agent: truthy "1" / "true" / "yes" (case-insensitive) ⇒ present.
 * Unset / other ⇒ absent. This is **not** T2CODE_SCM_G10_CUTOVER.
 */
export const FABRIC_DEPTH_ENV = "T2CODE_SCM_FABRIC_DEPTH" as const;

/**
 * RFC gate: is Fabric-depth opted in for this process?
 */
export const isFabricDepthEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const raw = env[FABRIC_DEPTH_ENV];
  if (raw === undefined) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

/**
 * Process-live depth drive readiness: both cutover stack + FD gate.
 *
 * Agent: FD alone does not install bridge controllers; cutover alone is not
 * Fabric-depth proof.
 */
export const isFabricDepthProcessLiveReady = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const cutoverRaw = env[G10_CUTOVER_ENV];
  const cutoverOn =
    cutoverRaw !== undefined && ["1", "true", "yes"].includes(cutoverRaw.trim().toLowerCase());
  return cutoverOn && isFabricDepthEnabled(env);
};

/** Agent note: FD env change requires process restart (no hot toggle). */
export const FABRIC_DEPTH_REQUIRES_RESTART = true as const;

/** Explicit: FD env must not reuse G10 cutover key. */
export const FABRIC_DEPTH_ENV_DISTINCT_FROM_CUTOVER = FABRIC_DEPTH_ENV !== G10_CUTOVER_ENV;

/**
 * Fabric-depth soft-fallback operator signal + retire (FD0 contracts).
 *
 * Intended: under T2CODE_SCM_FABRIC_DEPTH, after dual-run-exit emit
 * `g10.softFallback=active|retired` per S1–S7. Default active whether or not
 * inversionArmed. Retire only after arm-inversion + census sole-landers real.
 * When retired, bridge must not soft-fall to live on manifold failure.
 * Rollback / restore re-emits active. Home-bus / S0 / S8 omit the field.
 *
 * Observed: bookkeeping on G10SliceCutoverState.softFallback + signal sink.
 * Does not resize radius. Does not invent G11.
 */
import { assertSoleLandersRealForSlice } from "./fabricDepthCensusGate.ts";
import { isFabricDepthEnabled } from "./fabricDepthBootstrap.ts";
import type { G10SubstitutionModel } from "./g10Substitution.ts";
import type { G10FabricSliceId, G10SliceId, SoftFallbackState } from "./g10Types.ts";

/** Structured log / receipt field name (ops/soft-fallback-signal.md). */
export const SOFT_FALLBACK_FIELD = "g10.softFallback" as const;

/** Slices that may carry soft-fallback signal (activatable fabric only). */
const FABRIC_SOFT_FALLBACK_SLICES: readonly G10FabricSliceId[] = [
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
] as const;

/** Optional test / ops sink for emitted signals. */
let softFallbackSignalSink: ((line: string) => void) | undefined;

/**
 * Install a sink for soft-fallback signal lines (tests / evidence capture).
 */
export const setSoftFallbackSignalSink = (sink: ((line: string) => void) | undefined): void => {
  softFallbackSignalSink = sink;
};

/**
 * Format operator-visible signal line.
 *
 * Parameters
 * ----------
 * slice : G10FabricSliceId
 *     Fabric slice id.
 * state : "active" | "retired"
 *     Soft-recovery state.
 */
export const formatSoftFallbackSignal = (
  slice: G10FabricSliceId,
  state: Exclude<SoftFallbackState, null>,
): string => `${SOFT_FALLBACK_FIELD}=${state} slice=${slice}`;

/**
 * Emit signal when FD enabled and state is non-null. No-op when FD off or omit.
 */
export const emitSoftFallbackSignal = (
  slice: G10FabricSliceId,
  state: SoftFallbackState,
  env: NodeJS.ProcessEnv = process.env,
): void => {
  if (!isFabricDepthEnabled(env)) return;
  if (state === null) return;
  const line = formatSoftFallbackSignal(slice, state);
  softFallbackSignalSink?.(line);
};

/**
 * Read soft-fallback state for a slice (null ⇒ omit field).
 */
export const softFallbackForSlice = (
  model: G10SubstitutionModel,
  slice: G10SliceId,
): SoftFallbackState => model.sliceStates.get(slice)?.softFallback ?? null;

/**
 * True when soft live recovery is retired for this slice under FD.
 */
export const isSoftFallbackRetired = (model: G10SubstitutionModel, slice: G10SliceId): boolean =>
  softFallbackForSlice(model, slice) === "retired";

/**
 * After dual-run-exit: set active when FD enabled (whether or not inverted).
 *
 * Agent: called from recordOrderedProofStep dual-run-exit path.
 */
export const markSoftFallbackActiveAfterExit = (
  model: G10SubstitutionModel,
  slice: G10FabricSliceId,
  env: NodeJS.ProcessEnv = process.env,
): void => {
  if (!isFabricDepthEnabled(env)) return;
  const state = model.sliceStates.get(slice);
  if (state === undefined) return;
  state.softFallback = "active";
  emitSoftFallbackSignal(slice, "active", env);
};

/**
 * Rollback / restore: re-emit active when slice had a soft-fallback value.
 *
 * Agent: contract requires active re-emit for every restored slice — not omit.
 */
export const reemitSoftFallbackActiveOnRestore = (
  model: G10SubstitutionModel,
  slice: G10FabricSliceId,
  env: NodeJS.ProcessEnv = process.env,
): void => {
  if (!isFabricDepthEnabled(env)) return;
  const state = model.sliceStates.get(slice);
  if (state === undefined) return;
  if (state.softFallback === null) return;
  state.softFallback = "active";
  emitSoftFallbackSignal(slice, "active", env);
};

/**
 * Retire soft-fallback for a slice after Ordered depth through arm-inversion.
 *
 * Parameters
 * ----------
 * model : G10SubstitutionModel
 *     Slice state owner.
 * slice : G10FabricSliceId
 *     Slice to retire.
 * censusPath : string
 *     Absolute path to manifold-io-census.json (sole-lander gate).
 *
 * Throws
 * ------
 * Error
 *     When FD off, arm-inversion incomplete, or sole-lander census not real.
 */
export const recordSoftFallbackRetire = (
  model: G10SubstitutionModel,
  slice: G10FabricSliceId,
  censusPath: string,
  env: NodeJS.ProcessEnv = process.env,
): { readonly slice: G10FabricSliceId; readonly softFallback: "retired" } => {
  if (!isFabricDepthEnabled(env)) {
    throw new Error(
      `Fabric-depth soft-fallback retire refused on ${slice}: T2CODE_SCM_FABRIC_DEPTH not enabled`,
    );
  }
  const state = model.sliceStates.get(slice);
  if (state === undefined) {
    throw new Error(`Fabric-depth soft-fallback retire: missing slice state for ${slice}`);
  }
  if (state.inversionArmed !== true || !state.completedProofSteps.includes("arm-inversion")) {
    throw new Error(
      `Fabric-depth soft-fallback retire refused on ${slice}: requires arm-inversion GREEN first`,
    );
  }
  assertSoleLandersRealForSlice(censusPath, slice);
  state.softFallback = "retired";
  emitSoftFallbackSignal(slice, "retired", env);
  return { slice, softFallback: "retired" };
};

/**
 * Campaign helper: re-emit active for every fabric slice that had a signal.
 */
export const reemitAllSoftFallbackActiveOnCampaignRestore = (
  model: G10SubstitutionModel,
  env: NodeJS.ProcessEnv = process.env,
): void => {
  for (const slice of FABRIC_SOFT_FALLBACK_SLICES) {
    reemitSoftFallbackActiveOnRestore(model, slice, env);
  }
};

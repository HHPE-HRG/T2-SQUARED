/**
 * G10 Effect-friendly seam bridge (S1+ fabric cutover path selector).
 *
 * Intended: given substitution model + slice + commId + liveEffect +
 * manifoldEffect, select authority per install state:
 *   - not replaced → liveEffect only (today’s live unchanged)
 *   - replaced && authority live (dual-run / rehearsal) → liveEffect
 *     authoritative; optionally run manifoldObserveEffect beside without
 *     failing live (inversion armed pre-exit is N/A — refuse)
 *   - authority manifold (post dual-run-exit) → manifoldEffect authoritative;
 *     if inversionArmed and manifold fails → fail the user op; if not
 *     inverted → soft live fallback (pre-inversion safety per decisions.md)
 *
 * Observed: pure Effect selector over G10SubstitutionModel bookkeeping.
 * Does not call markDualRunExited. Does not resize radius. Does not touch
 * G9 capture — callers keep capture-beside on the live/manifold I/O they pass.
 * Inversion armed while authority still live throws (illegal Ordered state).
 */
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { isInversionArmed } from "./g10Inversion.ts";
import { authorityForSlice, type G10SubstitutionModel } from "./g10Substitution.ts";
import type { G10FabricSliceId } from "./g10Types.ts";

/** Inputs for one seam invocation through the cutover bridge. */
export type G10SeamBridgeArgs<A, E, R> = {
  readonly model: G10SubstitutionModel;
  readonly slice: G10FabricSliceId;
  /** Inventory `comm_id` for this seam (logged; not used for radius mutate). */
  readonly commId: string;
  /** Today’s live path (always the sole path when replace not installed). */
  readonly liveEffect: Effect.Effect<A, E, R>;
  /**
   * Manifold authority path — must perform real I/O when selected as authority.
   * Agent: do not pass a record-only stub here if post-exit authority is active.
   */
  readonly manifoldEffect: Effect.Effect<A, E, R>;
  /**
   * Dual-run observe-beside (live still authoritative). Must NOT duplicate
   * live I/O (no second publish/offer). Defaults to Effect.void.
   * Failures are isolated — they must not fail live.
   */
  readonly manifoldObserveEffect?: Effect.Effect<unknown, never, R>;
};

/**
 * Run live vs manifold per G10 cutover phase / authority.
 *
 * Parameters
 * ----------
 * args : G10SeamBridgeArgs
 *     Model + slice + effects. See type comments for intended roles.
 *
 * Returns
 * -------
 * Effect&lt;A, E, R&gt;
 *     Live or manifold result per authority; observe failures never surface
 *     while live is authoritative.
 *
 * Throws (Effect fail / sync Error)
 * ---------------------------------
 * Error
 *     When inversionArmed while authority is still live (illegal pre-exit).
 */
export const runG10SeamBridge = <A, E, R>(
  args: G10SeamBridgeArgs<A, E, R>,
): Effect.Effect<A, E, R> => {
  const { model, slice, liveEffect, manifoldEffect } = args;
  const install = model.installs.get(slice);
  const replaced = install?.replaceInstalled === true;
  const authority = authorityForSlice(model, slice);
  const inverted = isInversionArmed(model, slice);

  // Illegal: Ordered proof must exit before arming inversion.
  if (inverted && authority === "live") {
    return Effect.die(
      new Error(
        `G10 seam bridge: inversion armed on ${slice} while authority still live (commId=${args.commId}) — N/A pre-exit`,
      ),
    );
  }

  // Not replaced → today’s live only (no observe-beside cutover traffic).
  if (!replaced) {
    return liveEffect;
  }

  // Dual-run / rehearsal: live authoritative; manifold observe-beside.
  if (authority === "live") {
    const observe = args.manifoldObserveEffect ?? Effect.void;
    return Effect.gen(function* () {
      const liveResult = yield* liveEffect;
      // Isolate observe failures — G9-style noninterference pre-exit.
      yield* observe.pipe(Effect.exit, Effect.asVoid);
      return liveResult;
    });
  }

  // Post dual-run-exit: manifold authoritative.
  // Intended: inversionArmed ⇒ manifold fail fails user op.
  // Observed safe behavior when !inverted: soft-fallback to liveEffect so
  // user ops do not fail until Ordered proof arms inversion (decisions.md).
  if (inverted) {
    return manifoldEffect;
  }

  return Effect.gen(function* () {
    const manifoldExit = yield* Effect.exit(manifoldEffect);
    if (Exit.isSuccess(manifoldExit)) {
      return manifoldExit.value;
    }
    // Pre-inversion safety net: live still callable for soft recovery.
    return yield* liveEffect;
  });
};

/**
 * Predicate: bridge would select live as the authority path right now.
 *
 * Agent: useful for Engine short-circuit when controller present but not
 * replaced yet (identical to absent cutover for that call).
 */
export const bridgeUsesLiveAuthority = (
  model: G10SubstitutionModel,
  slice: G10FabricSliceId,
): boolean => {
  const install = model.installs.get(slice);
  if (install?.replaceInstalled !== true) return true;
  return authorityForSlice(model, slice) === "live";
};

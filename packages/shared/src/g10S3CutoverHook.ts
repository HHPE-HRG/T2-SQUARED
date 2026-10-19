/**
 * Shared-package G10 S3 cutover hook (no apps/server import).
 *
 * Intended: packages/shared (relayClient, Net) and packages/tailscale select
 * live vs manifold via a runner installed by apps/server g10SliceS3. Absent
 * runner / not replaced ⇒ live Effect unchanged (noninterference).
 *
 * Observed: Context.Service key + process-global fallback mirror G9
 * RelayClientOptionalG9Capture. Does not import scm/g10* from server.
 * Does not flip g9toG10Authorized. S8 lander-reopen may route
 * FLAG-CLOUDFLARED through this runner (S7→S3 handoff; not historical
 * S3 exit (a)).
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

/** Ledger-bounded projection A for S3 shared-package seams (no payloads). */
export type G10S3SharedProjection = {
  readonly [key: string]: unknown;
};

/**
 * Minimal runner shape installed by server g10SliceS3.
 *
 * Agent: runWiredSeam must reuse live I/O on manifold authority so spawn/net
 * still happen; recording is the cutover traffic, not a fake stub path.
 */
export type G10S3SharedSeamRunner = {
  readonly isReplaceInstalled: () => boolean;
  readonly runWiredSeam: <A, E, R>(args: {
    readonly commId: string;
    readonly phase: string;
    readonly projection: G10S3SharedProjection;
    readonly liveEffect: Effect.Effect<A, E, R>;
  }) => Effect.Effect<A, E, R>;
};

/** Must match server Layer key consumers resolve via serviceOption. */
const G10_S3_SHARED_SEAM_RUNNER_KEY = "t3/scm/g10SliceS3/G10S3SharedSeamRunner";

/**
 * Optional Context tag for shared-package S3 cutover (Layer.succeed from server).
 */
export class G10S3SharedSeamRunnerService extends Context.Service<
  G10S3SharedSeamRunnerService,
  G10S3SharedSeamRunner
>()(G10_S3_SHARED_SEAM_RUNNER_KEY) {}

/** Process-global fallback when Effect Layer is absent (tests / early boot). */
let processGlobalRunner: G10S3SharedSeamRunner | undefined;

/**
 * Install or clear the process-global shared S3 seam runner.
 *
 * Intended: g10SliceS3.installProcessGlobalG10S3 sets this beside the server
 * controller. Observed: module singleton; absent ⇒ live passthrough.
 */
export const installG10S3SharedSeamRunner = (runner: G10S3SharedSeamRunner | undefined): void => {
  processGlobalRunner = runner;
};

/** Read process-global shared S3 runner (undefined when absent). */
export const getG10S3SharedSeamRunner = (): G10S3SharedSeamRunner | undefined =>
  processGlobalRunner;

/**
 * Resolve optional shared S3 runner: Effect.serviceOption first, then global.
 */
export const resolveOptionalG10S3SharedSeamRunner = (): Effect.Effect<
  Option.Option<G10S3SharedSeamRunner>
> =>
  Effect.gen(function* () {
    const fromService = yield* Effect.serviceOption(G10S3SharedSeamRunnerService);
    if (Option.isSome(fromService)) return fromService;
    return processGlobalRunner === undefined ? Option.none() : Option.some(processGlobalRunner);
  });

/**
 * Run live I/O through optional shared S3 cutover when replaced.
 *
 * Parameters
 * ----------
 * commId / phase / projection : inventory seam identity + equality A
 * liveEffect : today’s live path (also reused as manifold I/O carrier)
 */
export const runViaOptionalG10S3SharedSeam = <A, E, R>(
  commId: string,
  phase: string,
  projection: G10S3SharedProjection,
  liveEffect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S3SharedSeamRunner();
    if (Option.isNone(opt) || !opt.value.isReplaceInstalled()) {
      return yield* liveEffect;
    }
    return yield* opt.value.runWiredSeam({
      commId,
      phase,
      projection,
      liveEffect,
    });
  });

// @effect-diagnostics nodeBuiltinImport:off
/**
 * G9 WP7 bootstrap composition (WP7-Bootstrap-Owner / W7-BOOT).
 *
 * Intended: one optional G9ShadowStackLayer that loads G9Package, builds the
 * ten-bus roster coordinator, observation, fault controller + supervisor sink,
 * G9-private SharedFundamentalClock + G9Waker (armed under forkScoped), and
 * G9LiveSafeCaptureLayer as the sole production G9CaptureService provider.
 * RFC-003 A: env opt-in (T2CODE_SCM_G9_SHADOW); default absent = today's live.
 * RFC-009 A: opt-in + package load failure ⇒ fail-fast (plain Error throw).
 * RFC-008 A: server merges this into RuntimeDependenciesLive; WP6 hook Layers
 * already land on ws / McpHttpServer / Observability consumers and activate
 * when G9CaptureService is present (no third merged-but-unwired mode).
 *
 * Supervisor sink tag: G9SupervisorLogFaultSink — delivers latched
 * G9InvariantFault to Effect.logError (same-process evidence). G9 does not
 * freeze/halt/stop the wider live stack (design Faults law).
 *
 * Observed: g9ShadowStackLayerFromEnv short-circuits before loadG9Package when
 * the gate is off. Present mode arms the waker and ticks on
 * process_interval_wake_ms. Does not instantiate the G6 home-bus link fabric
 * (roster uses only InProcessOpenLoopBus). Does not flip g9toG10Authorized.
 * Does not authorize G10. Does not re-own WP2–WP4 module bodies.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  loadG8FramingParameters,
  SharedFundamentalClock,
  type G8FramingParameters,
} from "./g8SharedClock.ts";
import { DipMuteStore } from "./g6DipMute.ts";
import { G9RosterCoordinator } from "./g9Coordinator.ts";
import { G9FaultController } from "./g9Fault.ts";
import { G9LiveSafeCaptureLayer } from "./g9OrchQueueCapture.ts";
import type { G9CaptureService } from "./g9OrchQueueCapture.ts";
import type { G9FaultSink, G9InvariantFault } from "./g9Occurrence.ts";
import { makeG9Observation, type G9Observation } from "./g9Observation.ts";
import { loadG9Package, type G9Package } from "./g9Package.ts";
import { G9Waker } from "./g9Waker.ts";

/**
 * RFC-003 A production opt-in env key.
 *
 * Agent: truthy "1" / "true" / "yes" (case-insensitive) ⇒ present mode.
 * Unset / other ⇒ absent (no package load, no waker, no shadow buses).
 */
export const G9_SHADOW_PARITY_ENV = "T2CODE_SCM_G9_SHADOW" as const;

/** Options for building the present-mode shadow stack. */
export type G9ShadowStackOptions = {
  /** Absolute monorepo root (ledger / runtime-parameters). Defaults to resolveG9RepoRoot(). */
  readonly repoRoot?: string;
  /** Override supervisor sink (tests). Default: G9SupervisorLogFaultSink. */
  readonly sink?: G9FaultSink;
};

/**
 * Built present-mode stack handles for WP8 / tests (same wiring as production).
 *
 * Agent: reuse this factory — do not duplicate coordinator/waker construction.
 */
export type G9ShadowStack = {
  readonly pkg: G9Package;
  readonly coordinator: G9RosterCoordinator;
  readonly waker: G9Waker;
  readonly faults: G9FaultController;
  /** Provides G9CaptureService + scoped armed waker fiber. */
  readonly layer: Layer.Layer<G9CaptureService>;
};

/**
 * Resolve T2-SQUARED repo root from this module's location.
 *
 * Intended: apps/server/src/scm → four parents → monorepo root (docs/scm/g9).
 * Observed: matches g9VerticalSlice.test.ts / loadG9Package callers.
 */
export const resolveG9RepoRoot = (): string =>
  join(dirname(fileURLToPath(import.meta.url)), "../../../..");

/**
 * RFC-003 A gate: is G9 shadow stack opted in for this process?
 *
 * Parameters
 * ----------
 * env : NodeJS.ProcessEnv
 *     Defaults to process.env. Pass a plain object in unit tests.
 *
 * Returns
 * -------
 * boolean
 *     true only for 1 / true / yes (case-insensitive).
 */
export const isG9ShadowParityEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const raw = env[G9_SHADOW_PARITY_ENV];
  if (raw === undefined) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

/**
 * Production supervisor fault sink (module header tag: G9SupervisorLogFaultSink).
 *
 * Intended: latched G9InvariantFault reaches process logs; error channel never.
 * Observed: Effect.logError + catchCause → void. Does not freeze/halt live SCM.
 */
export const makeG9SupervisorLogFaultSink = (): G9FaultSink => ({
  deliver: (fault: G9InvariantFault) =>
    Effect.logError("G9 invariant fault latched (supervisor sink)", {
      fault_code: fault.code,
      message: fault.message,
    }).pipe(
      Effect.catchCause(() => Effect.void),
      Effect.asVoid,
    ),
});

/**
 * Construct the full present-mode G9 shadow stack (fail-fast on package load).
 *
 * Agent: call only when the RFC-003 gate is on, or from tests/WP8 drivers.
 * Arms waker inside a Layer.effectDiscard forkScoped loop at process_interval_wake_ms.
 * Wiring matches Task 12 vertical slice (deferred waker → faults → coordinator → clock).
 *
 * Parameters
 * ----------
 * options : G9ShadowStackOptions
 *     Optional repoRoot / sink overrides.
 *
 * Returns
 * -------
 * G9ShadowStack
 *     Coordinator (exactly ten bus keys), waker, faults, capture Layer.
 *
 * Throws
 * ------
 * Error
 *     loadG9Package init mismatch (RFC-009 fail-fast when opt-in).
 */
export const buildG9ShadowStack = (options: G9ShadowStackOptions = {}): G9ShadowStack => {
  const repoRoot = options.repoRoot ?? resolveG9RepoRoot();
  // Init-time load: throws plain Error on mismatch (never G9InvariantFault).
  const pkg = loadG9Package(repoRoot);
  const store = new DipMuteStore(pkg.governed);
  const observation = makeG9Observation();
  const sink = options.sink ?? makeG9SupervisorLogFaultSink();
  const framing = loadG8FramingParameters(repoRoot);
  return assembleG9ShadowStack(pkg, store, observation, sink, framing);
};

/**
 * Layer factory for present mode (throws if package load fails).
 *
 * Agent: prefer g9ShadowStackLayerFromEnv for production server merge.
 */
export const makeG9ShadowStackLayer = (
  options: G9ShadowStackOptions = {},
): Layer.Layer<G9CaptureService> => buildG9ShadowStack(options).layer;

/**
 * RFC-003 A gated Layer: absent ⇒ Layer.empty (no loadG9Package side effect);
 * present ⇒ makeG9ShadowStackLayer (fail-fast on bad package).
 *
 * Parameters
 * ----------
 * env : NodeJS.ProcessEnv
 *     Gate source (default process.env).
 * options : G9ShadowStackOptions
 *     Passed through only when the gate is on.
 *
 * Returns
 * -------
 * Layer.Layer&lt;G9CaptureService&gt;
 *     Empty when absent; capture + armed waker when present.
 */
export const g9ShadowStackLayerFromEnv = (
  env: NodeJS.ProcessEnv = process.env,
  options: G9ShadowStackOptions = {},
): Layer.Layer<G9CaptureService> => {
  if (!isG9ShadowParityEnabled(env)) {
    // Absent path: do not call loadG9Package / allocate buses / arm waker.
    return Layer.empty;
  }
  return makeG9ShadowStackLayer(options);
};

/**
 * Single-pass stack assembly (Task 12 vertical-slice order).
 *
 * Agent: faults close over deferred waker; coordinator uses those faults;
 * SharedFundamentalClock targets coordinator; G9Waker assigned last before Layer.
 */
const assembleG9ShadowStack = (
  pkg: G9Package,
  store: DipMuteStore,
  observation: G9Observation,
  sink: G9FaultSink,
  framing: G8FramingParameters,
): G9ShadowStack => {
  let waker!: G9Waker;
  const faults = new G9FaultController(
    observation,
    sink,
    () => waker.disarm(),
    () => waker.markFaulted(),
  );
  const coordinator = new G9RosterCoordinator(pkg, store, observation, faults, framing);
  const clock = new SharedFundamentalClock(coordinator);
  waker = new G9Waker(
    clock,
    faults,
    observation,
    pkg.parameters.live_process_interval_fundamental_timesteps,
  );

  const captureLayer = G9LiveSafeCaptureLayer(coordinator, faults, pkg, waker);
  const wakeMs = pkg.parameters.process_interval_wake_ms;

  // Present mode: arm waker and fork supervised tick loop (RFC-018 isolate at tick).
  const wakerLifecycleLayer = Layer.effectDiscard(
    Effect.gen(function* () {
      waker.arm();
      yield* Effect.forkScoped(
        Effect.forever(Effect.sleep(Duration.millis(wakeMs)).pipe(Effect.andThen(waker.tick()))),
      );
    }),
  );

  return {
    pkg,
    coordinator,
    waker,
    faults,
    layer: Layer.merge(captureLayer, wakerLifecycleLayer),
  };
};

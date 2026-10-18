/**
 * G9 public entry re-export (RFC-001 B).
 *
 * Intended: canonical design name `g9ShadowParity.ts` re-exports the modular
 * File Map (`g9Package`, `g9Coordinator`, …) plus WP7 bootstrap composition.
 * Not a second coordinator body — no roster/FIFO/waker logic lives here.
 *
 * Observed: server.ts and WP8 import bootstrap/gate symbols from this module
 * or from g9Bootstrap.ts directly. Does not flip g9toG10Authorized.
 * Does not authorize G10. Does not instantiate BidirectionalHomeBusLink.
 */
export {
  G9_SHADOW_PARITY_ENV,
  buildG9ShadowStack,
  g9ShadowStackLayerFromEnv,
  isG9ShadowParityEnabled,
  makeG9ShadowStackLayer,
  makeG9SupervisorLogFaultSink,
  resolveG9RepoRoot,
  type G9ShadowStack,
  type G9ShadowStackOptions,
} from "./g9Bootstrap.ts";

/** WP6 hook Layers (bodies owned by WP6; re-exported for RFC-001 B public surface). */
export {
  G9McpHttpSessionHooksLayer,
  G9RpcServerRequestHooksLayer,
  G9T3OtlpExportHooksLayer,
} from "./g9FamilyTypedHooks.ts";

export { G9RosterCoordinator } from "./g9Coordinator.ts";
export { G9FaultController } from "./g9Fault.ts";
export {
  G9CaptureService,
  G9LiveSafeCaptureLayer,
  captureIfOfferAccepted,
  commandTypeOf,
} from "./g9OrchQueueCapture.ts";
export { makeG9Observation, sandboxObserve } from "./g9Observation.ts";
export { loadG9Package, parseRuntimeParameters } from "./g9Package.ts";
export { G9Waker, makeG9Waker } from "./g9Waker.ts";
export { hearAs } from "./g9HearAs.ts";

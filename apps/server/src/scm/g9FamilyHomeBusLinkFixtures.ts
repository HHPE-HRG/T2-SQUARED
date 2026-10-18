/**
 * WP5 B6 dormant-home-bus-link fixture helpers (INV-T2-SCM-HOME-BUS-LINK).
 *
 * Intended: fixture/test-only capture for dormant-prototype phase
 * `home-bus-forward-succeeded` (RFC-019). Builds ledger-bounded A and may
 * call `captureOccurrence` under WP8 / family-test coordinator wiring.
 *
 * Observed: constants + buildHomeBusForwardCaptureInput +
 * captureHomeBusForwardSucceeded below. Does not import or construct the G6
 * home-bus-link production class. Does not wire production server / WP7
 * bootstrap / Engine / Effect patch. Zero production-path occurrences.
 *
 * Does not authorize G10. Does not flip g9toG10Authorized.
 */
import type * as Effect from "effect/Effect";

import type { G9HomeBusForwardA } from "./g9EqualityA.generated.ts";
import type { G9CaptureOccurrenceInput, G9CaptureResult } from "./g9Occurrence.ts";

/** Ledger row identity for the sole B6 dormant comm_id. */
export const HOME_BUS_LINK_COMM_ID = "INV-T2-SCM-HOME-BUS-LINK" as const;

/** Sole counted phase for INV-T2-SCM-HOME-BUS-LINK. */
export const HOME_BUS_FORWARD_PHASE_ID = "home-bus-forward-succeeded" as const;

/** G3 home node for the dormant row (ledger node_id). */
export const HOME_BUS_LINK_NODE_ID = "node.scm.home-a" as const;

/** G3 home bus for the dormant row (ledger home_bus_id / origin). */
export const HOME_BUS_LINK_HOME_BUS_ID = "bus.scm.a" as const;

/**
 * Sole request_label / route_id domain member (ledger request_label + A).
 * Agent: finite domain is request_label; A.route_id = request_label.
 */
export const HOME_BUS_FORWARD_ROUTE_ID = "fixture-forward" as const;

/** Ledger fixture_id for the single counted vector on this phase. */
export const HOME_BUS_FORWARD_FIXTURE_ID =
  "fx.INV-T2-SCM-HOME-BUS-LINK.home-bus-forward-succeeded.fixture-forward__succeeded" as const;

/**
 * Machine identity block for WP8 dormant_prototype_phases drivers.
 * fixture_driver_class is the RFC-019 enqueue gate (allowed under fixtures only).
 */
export const DORMANT_HOME_BUS_LINK_PHASE = {
  comm_id: HOME_BUS_LINK_COMM_ID,
  phase_id: HOME_BUS_FORWARD_PHASE_ID,
  node_id: HOME_BUS_LINK_NODE_ID,
  home_bus_id: HOME_BUS_LINK_HOME_BUS_ID,
  fixture_driver_class: "dormant-prototype",
} as const;

/**
 * Ledger fixture vector projection for WP8 W1 / equality proof.
 * Vector disposition is fixture-fail (not success-path): no production occurrence.
 */
export const HOME_BUS_FORWARD_FIXTURE_VECTOR = {
  fixture_id: HOME_BUS_FORWARD_FIXTURE_ID,
  phase: HOME_BUS_FORWARD_PHASE_ID,
  expected_equality_A: {
    route_id: HOME_BUS_FORWARD_ROUTE_ID,
  } satisfies G9HomeBusForwardA,
  expected_semanticKind: "request" as const,
  expected_request_label: HOME_BUS_FORWARD_ROUTE_ID,
  expected_state_label: "succeeded" as const,
  expected_retention: false as const,
  expected_live_failure_no_capture_disposition:
    "no production occurrence; fixture-fail: no-occurrence" as const,
} as const;

/** Narrow capture input member for the dormant home-bus-link phase. */
export type G9HomeBusForwardCaptureInput = Extract<
  G9CaptureOccurrenceInput,
  { readonly comm_id: typeof HOME_BUS_LINK_COMM_ID }
>;

/**
 * Live-safe capture callback shape (G9CaptureService.captureOccurrence).
 * Agent: families depend on this service; do not import G9RosterCoordinator here.
 */
export type G9FixtureCaptureFn = (
  input: G9CaptureOccurrenceInput,
) => Effect.Effect<G9CaptureResult | undefined, never>;

/**
 * Build the sole legal capture input for home-bus-forward-succeeded.
 *
 * Intended: one closed A { route_id: "fixture-forward" }. Observed: typed
 * G9HomeBusForwardCaptureInput matching generated union member.
 *
 * Returns
 * -------
 * G9HomeBusForwardCaptureInput
 *     Ready for captureOccurrence under fixture/test wiring only.
 */
export const buildHomeBusForwardCaptureInput = (): G9HomeBusForwardCaptureInput => ({
  comm_id: HOME_BUS_LINK_COMM_ID,
  phase: HOME_BUS_FORWARD_PHASE_ID,
  input: { route_id: HOME_BUS_FORWARD_ROUTE_ID },
});

/**
 * Expected public equality A for the dormant forward vector.
 *
 * Returns
 * -------
 * G9HomeBusForwardA
 *     { route_id: "fixture-forward" }.
 */
export const expectedHomeBusForwardEqualityA = (): G9HomeBusForwardA => ({
  route_id: HOME_BUS_FORWARD_ROUTE_ID,
});

/**
 * Fixture-only enqueue of INV-T2-SCM-HOME-BUS-LINK / home-bus-forward-succeeded.
 *
 * Intended: WP8 / B6 tests call this after wiring a test capture service (or
 * live-safe layer over a test coordinator). Forbidden from production bootstrap
 * and from any live G6 home-bus-link forward re-bridge.
 *
 * Parameters
 * ----------
 * capture : G9FixtureCaptureFn
 *     G9CaptureService.captureOccurrence (error channel never).
 *
 * Returns
 * -------
 * Effect&lt;G9CaptureResult | undefined, never&gt;
 *     Capture outcome from the supplied service.
 */
export const captureHomeBusForwardSucceeded = (
  capture: G9FixtureCaptureFn,
): Effect.Effect<G9CaptureResult | undefined, never> => capture(buildHomeBusForwardCaptureInput());

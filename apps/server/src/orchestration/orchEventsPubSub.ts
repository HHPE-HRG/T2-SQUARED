/**
 * INV-T2-ORCH-EVENTS publish surface (WP5 B1 W5c lander).
 *
 * Intended: wrap PubSub.publish for OrchestrationEvent so a true offer yields
 * one captureOccurrence with A.member_id = event.type only. False publish →
 * zero capture. Absent G9CaptureService → publish behavior unchanged.
 *
 * Observed: ledger capture_module is apps/server/src/orchestration (directory),
 * capture_symbol eventPubSub.publish. The only production publishers sit in
 * OrchestrationEngine.ts (~129 reconcile, ~222 commit). B1 must not edit
 * Engine (RFC-023). Slice-Foundation-Owner lands the two-site swap via
 * docs/scm/g9/wp5/handoffs/B1-ORCH-EVENTS-slice.md + G9_B1_ORCH_EVENTS_SLICE_HANDOFF.
 *
 * Does not flip g9toG10Authorized. Does not authorize G10. No ORCH-QUEUE /
 * ORCH-LIVE ownership here.
 */
import type { OrchestrationEvent } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as PubSub from "effect/PubSub";

import {
  captureOrchEventsIfPublished,
  captureWhenG9Present,
  isOrchEventsMember,
} from "../scm/g9FamilyQueuePubSubCallback.ts";

/**
 * Handoff notes for INV-T2-ORCH-EVENTS → Slice Engine lander.
 *
 * Agent: B1 authors helper + this note only. Do not edit Engine in WP5-B1.
 * Slice replaces both raw PubSub.publish(eventPubSub, …) calls with
 * publishOrchestrationEventWithCapture. See B1-ORCH-EVENTS-slice.md.
 */
export const G9_B1_ORCH_EVENTS_SLICE_HANDOFF = {
  lander: "Slice-Foundation-Owner",
  live_file: "apps/server/src/orchestration/Layers/OrchestrationEngine.ts",
  planning_owner: "WP5-B1",
  helper: "publishOrchestrationEventWithCapture",
  helper_module: "apps/server/src/orchestration/orchEventsPubSub.ts",
  handoff_doc: "docs/scm/g9/wp5/handoffs/B1-ORCH-EVENTS-slice.md",
  phases: [
    {
      comm_id: "INV-T2-ORCH-EVENTS",
      phase: "pubsub-published",
      live_sites: [
        "processEnvelope reconcile PubSub.publish(eventPubSub, persistedEvent) ~129",
        "processEnvelope commit PubSub.publish(eventPubSub, event) ~222",
      ],
      input_domain: "OrchestrationEventType as member_id",
      success_predicate:
        "publish returns true; member_id = event.type only. Not ORCH-QUEUE / ORCH-LIVE.",
      false_offer: "no captureOccurrence call",
      equality_A_fields: ["member_id"] as const,
      forbidden_in_A: [
        "payload_bytes",
        "event",
        "raw_json_bag",
        "sql_text",
        "secret_material",
        "token",
      ],
    },
  ],
  forbidden_for_b1: [
    "apps/server/src/orchestration/Layers/OrchestrationEngine.ts commits",
    "apps/server/src/ws.ts commits",
    "inventing a second domain-event publisher to avoid Slice handoff",
  ],
} as const;

/**
 * Publish an orchestration domain event and capture ORCH-EVENTS on true offer.
 *
 * Parameters
 * ----------
 * eventPubSub : PubSub.PubSub&lt;OrchestrationEvent&gt;
 *     Unbounded (or test) domain-event bus.
 * event : OrchestrationEvent
 *     Event already persisted/decided; type projects to member_id.
 *
 * Returns
 * -------
 * Effect&lt;boolean, never&gt;
 *     PubSub.publish result. Capture runs only when true and type is a ledger
 *     member_id. Unknown type → publish still returns; no capture.
 */
export const publishOrchestrationEventWithCapture = (
  eventPubSub: PubSub.PubSub<OrchestrationEvent>,
  event: OrchestrationEvent,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const published = yield* PubSub.publish(eventPubSub, event);
    if (!published || !isOrchEventsMember(event.type)) {
      return published;
    }
    yield* captureWhenG9Present((capture) =>
      captureOrchEventsIfPublished(capture, published, event.type),
    );
    return published;
  });

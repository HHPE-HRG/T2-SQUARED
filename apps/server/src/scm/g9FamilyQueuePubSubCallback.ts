/**
 * WP5 B1 queue-pubsub-callback family helpers (Mode B Wave W5a/W5c).
 *
 * Intended: project ledger-bounded equality A for B1 rows, then call only
 * G9CaptureService.captureOccurrence. One live success → one occurrence.
 * No FIFO, clock, tracer, meter, enqueue, or publish ownership. No payload
 * bytes in A. ORCH-QUEUE classification reuses foundation commandTypeOf; this
 * module does not re-own g9OrchQueueCapture.ts or OrchestrationEngine.ts.
 *
 * Observed: private captureB1Occurrence is the sole capture path for ORCH-LIVE,
 * ORCH-QUEUE, and the other B1 queue/pubsub/callback rows below. ORCH-EVENTS
 * live publish surface is apps/server/src/orchestration/orchEventsPubSub.ts
 * (ledger capture_module apps/server/src/orchestration), not Engine.
 * ORCH-LIVE live-file land is B1→WP6 handoff on ws.ts
 * (see G9_B1_ORCH_LIVE_WS_HANDOFF + docs handoff).
 *
 * W5c lander: serverSettings.ts + orchestration/** pub/sub (not Engine) +
 * this module. No ws.ts / Engine / provider/** / Manager.ts / Effect patch /
 * server.ts. Does not flip g9toG10Authorized. Does not authorize G10.
 */
import type { OrchestrationCommand } from "@t3tools/contracts";
import { OrchestrationEventType } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import type { G9CaptureServiceShape } from "./g9OrchQueueCapture.ts";
import { commandTypeOf, G9CaptureService } from "./g9OrchQueueCapture.ts";
import type { G9CaptureOccurrenceInput } from "./g9Occurrence.ts";

const isOrchestrationEventType = Schema.is(OrchestrationEventType);

/**
 * Ledger comm_ids owned by bundle B1 (plan § B1). Eight rows, eleven phases.
 * Provider queue/pubsub rows are B4, not B1.
 */
export const B1_QUEUE_PUBSUB_CALLBACK_COMM_IDS = [
  "INV-T2-LIFECYCLE-EVENTS",
  "INV-T2-ORCH-EVENTS",
  "INV-T2-ORCH-LIVE",
  "INV-T2-ORCH-QUEUE",
  "INV-T2-PREVIEW-AUTO",
  "INV-T2-PROJECT-QUEUE",
  "INV-T2-SETTINGS-EVENTS",
  "INV-T2-VCS-EVENTS",
] as const;

export type G9B1CommId = (typeof B1_QUEUE_PUBSUB_CALLBACK_COMM_IDS)[number];

/**
 * B1-callable capture inputs (Task 14 generated union, narrowed to B1 rows).
 * Agent: every phase under these comm_ids is in-scope for W5a helpers.
 */
export type G9B1CaptureOccurrenceInput = Extract<
  G9CaptureOccurrenceInput,
  { readonly comm_id: G9B1CommId }
>;

/** Live-safe capture function (error channel never). */
export type G9B1CaptureFn = G9CaptureServiceShape["captureOccurrence"];

type ExtractB1<C extends G9B1CommId, P extends string> = Extract<
  G9B1CaptureOccurrenceInput,
  { readonly comm_id: C; readonly phase: P }
>;

export type G9B1OrchLiveKind = ExtractB1<
  "INV-T2-ORCH-LIVE",
  "live-buffer-offered"
>["input"]["kind"];
export type G9B1OrchEventsMember = ExtractB1<
  "INV-T2-ORCH-EVENTS",
  "pubsub-published"
>["input"]["member_id"];
export type G9B1OrchQueueCommandType = ExtractB1<
  "INV-T2-ORCH-QUEUE",
  "queue-offered"
>["input"]["command_type"];

/**
 * Narrow an event type string to ledger ORCH-EVENTS member_id.
 * Agent: reject unknown types at the pub/sub boundary; never invent labels.
 */
export const isOrchEventsMember = (member_id: string): member_id is G9B1OrchEventsMember =>
  isOrchestrationEventType(member_id);

/**
 * Run a B1 capture body only when G9CaptureService is in the environment.
 *
 * Intended: absent service ⇒ Effect.void (live path unchanged). Present ⇒
 * invoke run with captureOccurrence. Never fails the live caller.
 * Name matches B4 `captureWhenG9Present` so landers share one vocabulary.
 *
 * Parameters
 * ----------
 * run : (capture) => Effect&lt;void, never&gt;
 *     Family capture helper call (already never-failing).
 */
export const captureWhenG9Present = (
  run: (capture: G9B1CaptureFn) => Effect.Effect<void, never>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const capture = yield* Effect.serviceOption(G9CaptureService);
    if (Option.isNone(capture)) return;
    yield* run((input) => capture.value.captureOccurrence(input));
  });

/**
 * Handoff notes for INV-T2-ORCH-LIVE → WP6 ws.ts sole lander.
 *
 * Agent: W5a authors helpers + this note only. Do not edit ws.ts in this wave.
 * WP6-Consumer-Owner lands capture after liveBuffer Queue.offer returns true,
 * projecting A.kind only (event | synchronized). No event payload in A.
 */
export const G9_B1_ORCH_LIVE_WS_HANDOFF = {
  lander: "WP6-Consumer-Owner",
  live_file: "apps/server/src/ws.ts",
  planning_owner: "WP5-B1",
  helper: "captureOrchLiveIfOfferAccepted",
  phases: [
    {
      comm_id: "INV-T2-ORCH-LIVE",
      phase: "live-buffer-offered",
      live_sites: [
        "subscribeShell liveBuffer Queue.offer (kind: event | synchronized)",
        "subscribeThreadDetail liveBuffer Queue.offer (kind: event | synchronized)",
      ],
      input_domain: ["event", "synchronized"] as const,
      success_predicate:
        "liveBuffer Queue.offer returns true; kind event or synchronized only. Not ORCH-QUEUE.",
      false_offer: "no captureOccurrence call",
      equality_A_fields: ["kind"] as const,
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
  forbidden_in_w5a: [
    "apps/server/src/ws.ts commits",
    "apps/server/src/orchestration/Layers/OrchestrationEngine.ts commits",
    "re-own g9OrchQueueCapture.ts / G9LiveSafeCaptureLayer",
    "provider/** commits",
    "Effect patch / server.ts bootstrap",
  ],
} as const;

/**
 * Shared private capture path for all B1 rows (ORCH-LIVE + ORCH-QUEUE + others).
 *
 * Parameters
 * ----------
 * capture : G9B1CaptureFn
 *     Live-safe captureOccurrence (never-failing error channel).
 * input : G9B1CaptureOccurrenceInput
 *     Ledger (comm_id, phase, input) already projected to bounded A.
 *
 * Returns
 * -------
 * Effect&lt;void, never&gt;
 *     Discards capture result; live caller stays void.
 */
const captureB1Occurrence = (
  capture: G9B1CaptureFn,
  input: G9B1CaptureOccurrenceInput,
): Effect.Effect<void, never> => capture(input).pipe(Effect.asVoid);

/** Build INV-T2-ORCH-LIVE / live-buffer-offered input (kind only). */
export const buildOrchLiveCaptureInput = (
  kind: G9B1OrchLiveKind,
): ExtractB1<"INV-T2-ORCH-LIVE", "live-buffer-offered"> => ({
  comm_id: "INV-T2-ORCH-LIVE",
  phase: "live-buffer-offered",
  input: { kind },
});

/** Build INV-T2-ORCH-QUEUE / queue-offered input (command_type only). */
export const buildOrchQueueCaptureInput = (
  command_type: G9B1OrchQueueCommandType,
): ExtractB1<"INV-T2-ORCH-QUEUE", "queue-offered"> => ({
  comm_id: "INV-T2-ORCH-QUEUE",
  phase: "queue-offered",
  input: { command_type },
});

/** Build INV-T2-ORCH-EVENTS / pubsub-published input (member_id only). */
export const buildOrchEventsCaptureInput = (
  member_id: G9B1OrchEventsMember,
): ExtractB1<"INV-T2-ORCH-EVENTS", "pubsub-published"> => ({
  comm_id: "INV-T2-ORCH-EVENTS",
  phase: "pubsub-published",
  input: { member_id },
});

/** Build INV-T2-PROJECT-QUEUE / projection-event-succeeded input. */
export const buildProjectQueueCaptureInput = (): ExtractB1<
  "INV-T2-PROJECT-QUEUE",
  "projection-event-succeeded"
> => ({
  comm_id: "INV-T2-PROJECT-QUEUE",
  phase: "projection-event-succeeded",
  input: { kind: "projection-event-succeeded" },
});

/** Build INV-T2-SETTINGS-EVENTS / pubsub-published input (emitChange site). */
export const buildSettingsEmitCaptureInput = (): ExtractB1<
  "INV-T2-SETTINGS-EVENTS",
  "pubsub-published"
> => ({
  comm_id: "INV-T2-SETTINGS-EVENTS",
  phase: "pubsub-published",
  input: { site: "emitChange" },
});

/** Build INV-T2-SETTINGS-EVENTS / settings-subscription-established input. */
export const buildSettingsSubscriptionCaptureInput = (): ExtractB1<
  "INV-T2-SETTINGS-EVENTS",
  "settings-subscription-established"
> => ({
  comm_id: "INV-T2-SETTINGS-EVENTS",
  phase: "settings-subscription-established",
  input: { site: "subscribed" },
});

/** Build INV-T2-LIFECYCLE-EVENTS / pubsub-published presence A. */
export const buildLifecycleEventsCaptureInput = (): ExtractB1<
  "INV-T2-LIFECYCLE-EVENTS",
  "pubsub-published"
> => ({
  comm_id: "INV-T2-LIFECYCLE-EVENTS",
  phase: "pubsub-published",
  input: { comm_id: "present" },
});

/** Build INV-T2-VCS-EVENTS / pubsub-published presence A. */
export const buildVcsEventsCaptureInput = (): ExtractB1<
  "INV-T2-VCS-EVENTS",
  "pubsub-published"
> => ({
  comm_id: "INV-T2-VCS-EVENTS",
  phase: "pubsub-published",
  input: { comm_id: "present" },
});

/** Build INV-T2-PREVIEW-AUTO / preview-auto-routed input. */
export const buildPreviewAutoRoutedCaptureInput = (): ExtractB1<
  "INV-T2-PREVIEW-AUTO",
  "preview-auto-routed"
> => ({
  comm_id: "INV-T2-PREVIEW-AUTO",
  phase: "preview-auto-routed",
  input: { comm_id: "preview-auto-routed" },
});

/** Build INV-T2-PREVIEW-AUTO / preview-auto-queue-offered presence A. */
export const buildPreviewAutoQueueCaptureInput = (): ExtractB1<
  "INV-T2-PREVIEW-AUTO",
  "preview-auto-queue-offered"
> => ({
  comm_id: "INV-T2-PREVIEW-AUTO",
  phase: "preview-auto-queue-offered",
  input: { comm_id: "present" },
});

/** Build INV-T2-PREVIEW-AUTO / preview-auto-result-succeeded input. */
export const buildPreviewAutoResultCaptureInput = (): ExtractB1<
  "INV-T2-PREVIEW-AUTO",
  "preview-auto-result-succeeded"
> => ({
  comm_id: "INV-T2-PREVIEW-AUTO",
  phase: "preview-auto-result-succeeded",
  input: { comm_id: "preview-auto-result-succeeded" },
});

/**
 * ORCH-LIVE offer gate for WP6 ws.ts lander.
 * False Queue.offer → zero capture calls. True → one occurrence with kind only.
 */
export const captureOrchLiveIfOfferAccepted = (
  capture: G9B1CaptureFn,
  accepted: boolean,
  kind: G9B1OrchLiveKind,
): Effect.Effect<void, never> => {
  if (!accepted) return Effect.void;
  return captureB1Occurrence(capture, buildOrchLiveCaptureInput(kind));
};

/**
 * ORCH-QUEUE offer gate (family-side; does not re-own foundation helper).
 * Uses shared captureB1Occurrence + foundation commandTypeOf.
 * Engine wiring remains Slice-Foundation-Owner (RFC-023).
 */
export const captureOrchQueueIfOfferAccepted = (
  capture: G9B1CaptureFn,
  accepted: boolean,
  command: OrchestrationCommand,
): Effect.Effect<void, never> => {
  if (!accepted) return Effect.void;
  return captureB1Occurrence(capture, buildOrchQueueCaptureInput(commandTypeOf(command)));
};

/**
 * ORCH-EVENTS pub/sub gate (orchestration tree, not Engine).
 * False publish/offer → no occurrence. True → member_id only in A.
 */
export const captureOrchEventsIfPublished = (
  capture: G9B1CaptureFn,
  published: boolean,
  member_id: G9B1OrchEventsMember,
): Effect.Effect<void, never> => {
  if (!published) return Effect.void;
  return captureB1Occurrence(capture, buildOrchEventsCaptureInput(member_id));
};

/**
 * PROJECT-QUEUE callback after ProjectionPipeline.projectEvent succeeds.
 * Agent: call only on success channel; fail → no capture.
 */
export const captureProjectQueueSucceeded = (capture: G9B1CaptureFn): Effect.Effect<void, never> =>
  captureB1Occurrence(capture, buildProjectQueueCaptureInput());

/**
 * SETTINGS emitChange after PubSub.publish Effect succeeds.
 * Ledger: boolean offer result is discarded; capture after Effect succeeds.
 */
export const captureSettingsEmitChange = (capture: G9B1CaptureFn): Effect.Effect<void, never> =>
  captureB1Occurrence(capture, buildSettingsEmitCaptureInput());

/**
 * SETTINGS subscribeChanges after a live listener is established.
 */
export const captureSettingsSubscriptionEstablished = (
  capture: G9B1CaptureFn,
): Effect.Effect<void, never> =>
  captureB1Occurrence(capture, buildSettingsSubscriptionCaptureInput());

/**
 * LIFECYCLE-EVENTS after serverLifecycleEvents PubSub.publish succeeds.
 */
export const captureLifecycleEventsPublished = (
  capture: G9B1CaptureFn,
): Effect.Effect<void, never> => captureB1Occurrence(capture, buildLifecycleEventsCaptureInput());

/**
 * VCS-EVENTS after VcsStatusBroadcaster PubSub.publish succeeds.
 */
export const captureVcsEventsPublished = (capture: G9B1CaptureFn): Effect.Effect<void, never> =>
  captureB1Occurrence(capture, buildVcsEventsCaptureInput());

/**
 * PREVIEW-AUTO routed callback success (PreviewAutomationBroker).
 */
export const capturePreviewAutoRouted = (capture: G9B1CaptureFn): Effect.Effect<void, never> =>
  captureB1Occurrence(capture, buildPreviewAutoRoutedCaptureInput());

/**
 * PREVIEW-AUTO queue offer gate. False offer → no capture.
 */
export const capturePreviewAutoQueueIfOfferAccepted = (
  capture: G9B1CaptureFn,
  accepted: boolean,
): Effect.Effect<void, never> => {
  if (!accepted) return Effect.void;
  return captureB1Occurrence(capture, buildPreviewAutoQueueCaptureInput());
};

/**
 * PREVIEW-AUTO result callback success (PreviewAutomationBroker).
 */
export const capturePreviewAutoResultSucceeded = (
  capture: G9B1CaptureFn,
): Effect.Effect<void, never> => captureB1Occurrence(capture, buildPreviewAutoResultCaptureInput());

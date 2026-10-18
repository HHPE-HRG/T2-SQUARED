/**
 * WP5 B1 queue-pubsub-callback family tests (Mode B Wave W5a).
 *
 * Intended: helpers call captureOccurrence once with ledger-bounded input;
 * false offer/publish → zero calls; ORCH-LIVE handoff notes target WP6 ws.ts;
 * A never carries payload bytes. Shared private captureB1Occurrence is exercised
 * through all public helpers (ORCH-LIVE + ORCH-QUEUE + other B1 rows).
 *
 * Observed: assertions below against mocked capture Ref. No ws.ts / Engine
 * wiring. Does not authorize G10.
 */
import {
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  EventId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  type OrchestrationCommand,
} from "@t3tools/contracts";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";

import { G9_LEDGER_PHASE_PAIRS } from "./g9CaptureInput.generated.ts";
import {
  B1_QUEUE_PUBSUB_CALLBACK_COMM_IDS,
  G9_B1_ORCH_LIVE_WS_HANDOFF,
  buildLifecycleEventsCaptureInput,
  buildOrchEventsCaptureInput,
  buildOrchLiveCaptureInput,
  buildOrchQueueCaptureInput,
  buildPreviewAutoQueueCaptureInput,
  buildPreviewAutoResultCaptureInput,
  buildPreviewAutoRoutedCaptureInput,
  buildProjectQueueCaptureInput,
  buildSettingsEmitCaptureInput,
  buildSettingsSubscriptionCaptureInput,
  buildVcsEventsCaptureInput,
  captureLifecycleEventsPublished,
  captureOrchEventsIfPublished,
  captureOrchLiveIfOfferAccepted,
  captureOrchQueueIfOfferAccepted,
  capturePreviewAutoQueueIfOfferAccepted,
  capturePreviewAutoResultSucceeded,
  capturePreviewAutoRouted,
  captureProjectQueueSucceeded,
  captureSettingsEmitChange,
  captureSettingsSubscriptionEstablished,
  captureVcsEventsPublished,
  captureWhenG9Present,
  isOrchEventsMember,
  type G9B1CaptureOccurrenceInput,
} from "./g9FamilyQueuePubSubCallback.ts";
import { G9CaptureService } from "./g9OrchQueueCapture.ts";
import type { G9CaptureOccurrenceInput, G9CaptureResult, G9EqualityA } from "./g9Occurrence.ts";
import * as Layer from "effect/Layer";

/** Test stub: shape only; does not prove coordinator W1 projection. */
const stubEnqueued = (input: G9CaptureOccurrenceInput): G9CaptureResult => ({
  status: "enqueued",
  occurrence: {
    comm_id: input.comm_id,
    phase_id: input.phase,
    node_id: "node.test",
    origin_bus_id: "bus.test",
    attempt_sequence: 0,
    equality_A: input.input as G9EqualityA,
    semanticKind: "request",
    request_label: input.phase,
    state_label: "",
    retainCurrentAfterPublish: false,
  },
});

const clientCmd = (): OrchestrationCommand => ({
  type: "thread.create",
  commandId: CommandId.make("cmd-g9-b1-client"),
  threadId: ThreadId.make("thread-g9-b1-client"),
  projectId: ProjectId.make("project-g9-b1"),
  title: "G9 B1 Client",
  modelSelection: {
    instanceId: ProviderInstanceId.make("codex"),
    model: "gpt-5-codex",
  },
  interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
  runtimeMode: "full-access",
  branch: null,
  worktreePath: null,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const internalCmd = (): OrchestrationCommand => ({
  type: "thread.activity.append",
  commandId: CommandId.make("cmd-g9-b1-internal"),
  threadId: ThreadId.make("thread-g9-b1-internal"),
  activity: {
    id: EventId.make("activity-g9-b1"),
    tone: "info",
    kind: "test",
    summary: "internal",
    payload: null,
    turnId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
});

/** Assert A is schema-bounded: only expected keys, no payload-shaped fields. */
const assertNoPayloadInA = (input: G9CaptureOccurrenceInput): void => {
  const keys = Object.keys(input.input);
  assert.equal(
    keys.some((k) =>
      [
        "payload",
        "payload_bytes",
        "event",
        "raw_json_bag",
        "sql_text",
        "secret_material",
        "token",
        "authorization_header",
      ].includes(k),
    ),
    false,
  );
  assert.equal(keys.length > 0, true);
};

describe("g9FamilyQueuePubSubCallback (WP5 B1)", () => {
  it("B1 comm_id set is eight ledger rows with eleven phases", () => {
    assert.equal(B1_QUEUE_PUBSUB_CALLBACK_COMM_IDS.length, 8);
    const b1Set = new Set<string>(B1_QUEUE_PUBSUB_CALLBACK_COMM_IDS);
    const phases = G9_LEDGER_PHASE_PAIRS.filter((p) => b1Set.has(p.comm_id));
    assert.equal(phases.length, 11);
    assert.equal(
      phases.some((p) => p.comm_id.startsWith("INV-T2-PROVIDER")),
      false,
    );
  });

  it("ORCH-LIVE handoff notes name WP6 ws.ts and live-buffer-offered", () => {
    assert.equal(G9_B1_ORCH_LIVE_WS_HANDOFF.lander, "WP6-Consumer-Owner");
    assert.equal(G9_B1_ORCH_LIVE_WS_HANDOFF.live_file, "apps/server/src/ws.ts");
    assert.equal(G9_B1_ORCH_LIVE_WS_HANDOFF.helper, "captureOrchLiveIfOfferAccepted");
    assert.equal(G9_B1_ORCH_LIVE_WS_HANDOFF.phases.length, 1);
    assert.equal(G9_B1_ORCH_LIVE_WS_HANDOFF.phases[0]?.phase, "live-buffer-offered");
    assert.equal(
      G9_B1_ORCH_LIVE_WS_HANDOFF.forbidden_in_w5a.includes("apps/server/src/ws.ts commits"),
      true,
    );
    assert.equal(
      G9_B1_ORCH_LIVE_WS_HANDOFF.forbidden_in_w5a.includes(
        "apps/server/src/orchestration/Layers/OrchestrationEngine.ts commits",
      ),
      true,
    );
  });

  it.effect("ORCH-LIVE false offer → 0 calls; true → 1 with kind only", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const capture = (input: G9CaptureOccurrenceInput) =>
        Effect.gen(function* () {
          yield* Ref.update(calls, (xs) => [...xs, input]);
          return stubEnqueued(input);
        });

      yield* captureOrchLiveIfOfferAccepted(capture, false, "event");
      assert.equal((yield* Ref.get(calls)).length, 0);

      yield* captureOrchLiveIfOfferAccepted(capture, true, "event");
      yield* captureOrchLiveIfOfferAccepted(capture, true, "synchronized");
      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 2);
      assert.deepEqual(seen[0], buildOrchLiveCaptureInput("event"));
      assert.deepEqual(seen[1], buildOrchLiveCaptureInput("synchronized"));
      for (const call of seen) assertNoPayloadInA(call);
    }),
  );

  it.effect("ORCH-QUEUE false offer → 0; true → command_type via shared path", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const capture = (input: G9CaptureOccurrenceInput) =>
        Effect.gen(function* () {
          yield* Ref.update(calls, (xs) => [...xs, input]);
          return stubEnqueued(input);
        });

      yield* captureOrchQueueIfOfferAccepted(capture, false, clientCmd());
      assert.equal((yield* Ref.get(calls)).length, 0);

      yield* captureOrchQueueIfOfferAccepted(capture, true, clientCmd());
      yield* captureOrchQueueIfOfferAccepted(capture, true, internalCmd());
      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 2);
      assert.deepEqual(seen[0], buildOrchQueueCaptureInput("client"));
      assert.deepEqual(seen[1], buildOrchQueueCaptureInput("internal"));
      for (const call of seen) assertNoPayloadInA(call);
    }),
  );

  it.effect("ORCH-EVENTS false publish → 0; true → member_id only", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const capture = (input: G9CaptureOccurrenceInput) =>
        Effect.gen(function* () {
          yield* Ref.update(calls, (xs) => [...xs, input]);
          return stubEnqueued(input);
        });

      yield* captureOrchEventsIfPublished(capture, false, "thread.created");
      assert.equal((yield* Ref.get(calls)).length, 0);

      yield* captureOrchEventsIfPublished(capture, true, "thread.created");
      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 1);
      assert.deepEqual(seen[0], buildOrchEventsCaptureInput("thread.created"));
      assertNoPayloadInA(seen[0]!);
    }),
  );

  it.effect("PREVIEW-AUTO queue false → 0; true + routed/result each one call", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const capture = (input: G9CaptureOccurrenceInput) =>
        Effect.gen(function* () {
          yield* Ref.update(calls, (xs) => [...xs, input]);
          return stubEnqueued(input);
        });

      yield* capturePreviewAutoQueueIfOfferAccepted(capture, false);
      assert.equal((yield* Ref.get(calls)).length, 0);

      yield* capturePreviewAutoQueueIfOfferAccepted(capture, true);
      yield* capturePreviewAutoRouted(capture);
      yield* capturePreviewAutoResultSucceeded(capture);
      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 3);
      assert.deepEqual(seen[0], buildPreviewAutoQueueCaptureInput());
      assert.deepEqual(seen[1], buildPreviewAutoRoutedCaptureInput());
      assert.deepEqual(seen[2], buildPreviewAutoResultCaptureInput());
    }),
  );

  it.effect("remaining B1 rows each emit one bounded occurrence (shared path)", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const capture = (input: G9CaptureOccurrenceInput) =>
        Effect.gen(function* () {
          yield* Ref.update(calls, (xs) => [...xs, input]);
          return stubEnqueued(input);
        });

      const expected: G9B1CaptureOccurrenceInput[] = [
        buildProjectQueueCaptureInput(),
        buildSettingsEmitCaptureInput(),
        buildSettingsSubscriptionCaptureInput(),
        buildLifecycleEventsCaptureInput(),
        buildVcsEventsCaptureInput(),
      ];

      yield* captureProjectQueueSucceeded(capture);
      yield* captureSettingsEmitChange(capture);
      yield* captureSettingsSubscriptionEstablished(capture);
      yield* captureLifecycleEventsPublished(capture);
      yield* captureVcsEventsPublished(capture);

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, expected.length);
      for (let i = 0; i < expected.length; i++) {
        assert.deepEqual(seen[i], expected[i]);
        assertNoPayloadInA(seen[i]!);
      }
    }),
  );

  it("isOrchEventsMember accepts ledger event types only", () => {
    assert.equal(isOrchEventsMember("thread.created"), true);
    assert.equal(isOrchEventsMember("not.a.real.event"), false);
  });

  it.effect("captureWhenG9Present is no-op when G9CaptureService absent", () =>
    Effect.gen(function* () {
      let ran = false;
      yield* captureWhenG9Present(() =>
        Effect.sync(() => {
          ran = true;
        }),
      );
      assert.equal(ran, false);
    }),
  );

  it.effect("captureWhenG9Present invokes run once when G9CaptureService present", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const layer = Layer.succeed(G9CaptureService, {
        captureOccurrence: (input) =>
          Effect.gen(function* () {
            yield* Ref.update(calls, (xs) => [...xs, input]);
            return stubEnqueued(input);
          }),
      });
      yield* captureWhenG9Present((capture) => captureProjectQueueSucceeded(capture)).pipe(
        Effect.provide(layer),
      );
      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 1);
      assert.deepEqual(seen[0], buildProjectQueueCaptureInput());
    }),
  );
});

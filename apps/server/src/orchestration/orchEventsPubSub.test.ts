/**
 * ORCH-EVENTS publish-surface tests (B1 W5c).
 *
 * Intended: true publish → one occurrence with member_id only; false publish →
 * zero; absent G9CaptureService → publish still succeeds; no payload bytes in A.
 */
import type { OrchestrationEvent } from "@t3tools/contracts";
import { CommandId, EventId, ProjectId } from "@t3tools/contracts";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Ref from "effect/Ref";

import { buildOrchEventsCaptureInput } from "../scm/g9FamilyQueuePubSubCallback.ts";
import { G9CaptureService, type G9CaptureServiceShape } from "../scm/g9OrchQueueCapture.ts";
import type {
  G9CaptureOccurrenceInput,
  G9CaptureResult,
  G9EqualityA,
} from "../scm/g9Occurrence.ts";
import { publishOrchestrationEventWithCapture } from "./orchEventsPubSub.ts";

const projectCreated = (): OrchestrationEvent => ({
  type: "project.created",
  sequence: 1,
  eventId: EventId.make("evt-orch-events-1"),
  aggregateKind: "project",
  aggregateId: ProjectId.make("project-1"),
  occurredAt: "2026-01-01T00:00:00.000Z",
  commandId: CommandId.make("cmd-1"),
  causationEventId: null,
  correlationId: CommandId.make("cmd-1"),
  metadata: {},
  payload: {
    projectId: ProjectId.make("project-1"),
    title: "Project 1",
    workspaceRoot: "/tmp/project-1",
    defaultModelSelection: null,
    scripts: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
});

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

const recordingCaptureLayer = (calls: Ref.Ref<G9CaptureOccurrenceInput[]>) =>
  Layer.succeed(G9CaptureService, {
    captureOccurrence: (input) =>
      Effect.gen(function* () {
        yield* Ref.update(calls, (xs) => [...xs, input]);
        return stubEnqueued(input);
      }),
  } satisfies G9CaptureServiceShape);

it.layer(Layer.empty)("orchEventsPubSub", (it) => {
  it.effect("true publish with capture service → one member_id occurrence", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const pubSub = yield* PubSub.unbounded<OrchestrationEvent>();
      const published = yield* publishOrchestrationEventWithCapture(pubSub, projectCreated()).pipe(
        Effect.provide(recordingCaptureLayer(calls)),
      );

      assert.equal(published, true);
      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 1);
      assert.deepEqual(seen[0], buildOrchEventsCaptureInput("project.created"));
      assert.deepEqual(Object.keys(seen[0]!.input), ["member_id"]);
    }),
  );

  it.effect("absent G9CaptureService → publish true, zero capture calls", () =>
    Effect.gen(function* () {
      const pubSub = yield* PubSub.unbounded<OrchestrationEvent>();
      const published = yield* publishOrchestrationEventWithCapture(pubSub, projectCreated());
      assert.equal(published, true);
    }),
  );
});

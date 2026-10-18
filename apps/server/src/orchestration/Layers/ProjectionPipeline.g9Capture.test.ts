/**
 * PROJECT-QUEUE capture on ProjectionPipeline.projectEvent (B1 W5c).
 *
 * Intended: success → one projection-event-succeeded occurrence; absent
 * G9CaptureService → projectEvent still succeeds; A carries kind only.
 */
import { CommandId, EventId, ProjectId } from "@t3tools/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { OrchestrationEventStoreLive } from "../../persistence/Layers/OrchestrationEventStore.ts";
import { SqlitePersistenceMemory } from "../../persistence/Layers/Sqlite.ts";
import { OrchestrationEventStore } from "../../persistence/Services/OrchestrationEventStore.ts";
import { ServerConfig } from "../../config.ts";
import { buildProjectQueueCaptureInput } from "../../scm/g9FamilyQueuePubSubCallback.ts";
import { G9CaptureService } from "../../scm/g9OrchQueueCapture.ts";
import type {
  G9CaptureOccurrenceInput,
  G9CaptureResult,
  G9EqualityA,
} from "../../scm/g9Occurrence.ts";
import { OrchestrationProjectionPipelineLive } from "./ProjectionPipeline.ts";
import { OrchestrationProjectionPipeline } from "../Services/ProjectionPipeline.ts";

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

const baseLayer = OrchestrationProjectionPipelineLive.pipe(
  Layer.provideMerge(OrchestrationEventStoreLive),
  Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "t3-proj-g9-capture-" })),
  Layer.provideMerge(SqlitePersistenceMemory),
  Layer.provideMerge(NodeServices.layer),
);

it.layer(baseLayer)("ProjectionPipeline G9 PROJECT-QUEUE", (it) => {
  it.effect("projectEvent success captures once; absent service still succeeds", () =>
    Effect.gen(function* () {
      const pipeline = yield* OrchestrationProjectionPipeline;
      const eventStore = yield* OrchestrationEventStore;
      const now = "2026-01-01T00:00:00.000Z";

      // eventStore.append assigns sequence; projectEvent needs that field.
      const first = yield* eventStore.append({
        type: "project.created",
        eventId: EventId.make("evt-g9-proj-1"),
        aggregateKind: "project",
        aggregateId: ProjectId.make("project-g9-1"),
        occurredAt: now,
        commandId: CommandId.make("cmd-g9-proj-1"),
        causationEventId: null,
        correlationId: CommandId.make("cmd-g9-proj-1"),
        metadata: {},
        payload: {
          projectId: ProjectId.make("project-g9-1"),
          title: "G9 Project",
          workspaceRoot: "/tmp/g9-project-1",
          defaultModelSelection: null,
          scripts: [],
          createdAt: now,
          updatedAt: now,
        },
      });

      // Absent capture service: projectEvent must still succeed.
      yield* pipeline.projectEvent(first);

      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const captureLayer = Layer.succeed(G9CaptureService, {
        captureOccurrence: (input) =>
          Effect.gen(function* () {
            yield* Ref.update(calls, (xs) => [...xs, input]);
            return stubEnqueued(input);
          }),
      });

      const second = yield* eventStore.append({
        type: "project.created",
        eventId: EventId.make("evt-g9-proj-2"),
        aggregateKind: "project",
        aggregateId: ProjectId.make("project-g9-2"),
        occurredAt: now,
        commandId: CommandId.make("cmd-g9-proj-2"),
        causationEventId: null,
        correlationId: CommandId.make("cmd-g9-proj-2"),
        metadata: {},
        payload: {
          projectId: ProjectId.make("project-g9-2"),
          title: "G9 Project 2",
          workspaceRoot: "/tmp/g9-project-2",
          defaultModelSelection: null,
          scripts: [],
          createdAt: now,
          updatedAt: now,
        },
      });

      yield* pipeline.projectEvent(second).pipe(Effect.provide(captureLayer));

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 1);
      assert.deepEqual(seen[0], buildProjectQueueCaptureInput());
      assert.deepEqual(Object.keys(seen[0]!.input), ["kind"]);
    }),
  );
});

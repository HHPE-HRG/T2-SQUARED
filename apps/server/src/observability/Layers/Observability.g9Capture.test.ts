/**
 * WP6 consumer tests for Observability.ts G9 landings (T3 OTLP hooks + T3-TRACE).
 *
 * Intended: G9T3OtlpExportHooksLayer maps OtlpTracer/OtlpMetrics labels;
 * B5 T3-TRACE helper projects presence A; absent G9CaptureService ⇒ no-op.
 * Observed: mock capture Ref. Does not flip gates. No Effect patch edits.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as OtlpExporter from "effect/unstable/observability/OtlpExporter";

import { captureT3TracePersistedBatchSucceeded } from "../../scm/g9FamilyTerminalLocalStreams.ts";
import { G9T3OtlpExportHooksLayer, withOptionalG9Capture } from "../../scm/g9FamilyTypedHooks.ts";
import { G9CaptureService } from "../../scm/g9OrchQueueCapture.ts";
import type {
  G9CaptureOccurrenceInput,
  G9CaptureResult,
  G9EqualityA,
} from "../../scm/g9Occurrence.ts";

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

const mockCaptureLayer = (calls: Ref.Ref<G9CaptureOccurrenceInput[]>) =>
  Layer.succeed(G9CaptureService, {
    captureOccurrence: (input) =>
      Ref.update(calls, (xs) => [...xs, input]).pipe(Effect.as(stubEnqueued(input))),
  });

describe("Observability G9 consumer (WP6)", () => {
  it.effect("absent G9CaptureService: T3-TRACE helper is a no-op", () =>
    Effect.gen(function* () {
      yield* withOptionalG9Capture((capture) => captureT3TracePersistedBatchSucceeded(capture));
    }),
  );

  it.effect("present capture: T3-TRACE is presence-only A", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      yield* withOptionalG9Capture((capture) =>
        captureT3TracePersistedBatchSucceeded(capture),
      ).pipe(Effect.provide(mockCaptureLayer(calls)));
      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 1);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-TEL-T3-TRACE",
        phase: "t3-trace-persisted-batch-succeeded",
        input: { comm_id: "present" },
      });
    }),
  );

  it.effect("G9T3OtlpExportHooksLayer maps tracer/metrics labels only", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const env = Layer.merge(G9T3OtlpExportHooksLayer, mockCaptureLayer(calls));
      const hooks = yield* OtlpExporter.ExportHooks.pipe(Effect.provide(env));

      yield* hooks.onExportSucceeded!({ label: "OtlpTracer", batchSize: 2 }).pipe(
        Effect.provide(env),
      );
      yield* hooks.onExportSucceeded!({ label: "OtlpMetrics", batchSize: 3 }).pipe(
        Effect.provide(env),
      );
      yield* hooks.onExportSucceeded!({ label: "OtlpTracer", batchSize: 0 }).pipe(
        Effect.provide(env),
      );

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 2);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-TEL-T3-OTLP",
        phase: "t3-otlp-traces-export-succeeded",
        input: { signal: "t3-otlp-traces-export-succeeded" },
      });
      assert.deepEqual(seen[1], {
        comm_id: "INV-T2-TEL-T3-OTLP",
        phase: "t3-otlp-metrics-export-succeeded",
        input: { signal: "t3-otlp-metrics-export-succeeded" },
      });
    }),
  );
});

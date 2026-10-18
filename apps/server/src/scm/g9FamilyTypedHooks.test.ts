/**
 * G9 WP6 typed-hook family tests (W6-FAMILY).
 *
 * Intended: helpers + Layers call captureOccurrence once with ledger-bounded A
 * (method / site / signal only); absent G9CaptureService ⇒ no-op; unknown
 * RpcServer tags and SCM-only / empty OTLP batches skip capture.
 *
 * Observed: mocked G9CaptureService Ref below. Does not edit Effect patch,
 * server.ts, or consumer files. Does not authorize G10.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as OtlpExporter from "effect/unstable/observability/OtlpExporter";
import * as RpcServer from "effect/unstable/rpc/RpcServer";

import { G9_LEDGER_PHASE_PAIRS } from "./g9CaptureInput.generated.ts";
import {
  G9McpHttpSessionHooksLayer,
  G9RpcServerRequestHooksLayer,
  G9T3OtlpExportHooksLayer,
  G9_T3_OTLP_EXPORTER_LABELS,
  G9_WP6_TYPED_HOOKS_CONSUMER_HANDOFF,
  WP6_TYPED_HOOK_COMM_IDS,
  buildRpcAdmitCaptureInput,
  buildRpcStreamElementCaptureInput,
  buildRpcUnarySuccessCaptureInput,
  captureMcpHttpSessionDeleted,
  captureRpcRequestAdmitted,
  captureRpcStreamElement,
  captureRpcUnarySucceeded,
  captureT2OtlpExportSucceeded,
  captureT3OtlpExportSucceededFromLabel,
  isCapturableOtlpExportBatch,
  withOptionalG9Capture,
} from "./g9FamilyTypedHooks.ts";
import { G9CaptureService } from "./g9OrchQueueCapture.ts";
import type { G9CaptureOccurrenceInput, G9CaptureResult, G9EqualityA } from "./g9Occurrence.ts";

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

const mockCaptureLayer = (calls: Ref.Ref<G9CaptureOccurrenceInput[]>) =>
  Layer.succeed(G9CaptureService, {
    captureOccurrence: (input) =>
      Ref.update(calls, (xs) => [...xs, input]).pipe(Effect.as(stubEnqueued(input))),
  });

describe("g9FamilyTypedHooks (WP6)", () => {
  it("consumer handoff names Layer exports and sole-lander files", () => {
    assert.equal(G9_WP6_TYPED_HOOKS_CONSUMER_HANDOFF.lander, "WP6-Consumer-Owner");
    assert.equal(G9_WP6_TYPED_HOOKS_CONSUMER_HANDOFF.layers.rpc, "G9RpcServerRequestHooksLayer");
    assert.equal(
      G9_WP6_TYPED_HOOKS_CONSUMER_HANDOFF.layers.mcp_session,
      "G9McpHttpSessionHooksLayer",
    );
    assert.equal(G9_WP6_TYPED_HOOKS_CONSUMER_HANDOFF.layers.t3_otlp, "G9T3OtlpExportHooksLayer");
    assert.equal(
      G9_WP6_TYPED_HOOKS_CONSUMER_HANDOFF.helpers.t2_otlp,
      "captureT2OtlpExportSucceeded",
    );
    assert.equal(
      G9_WP6_TYPED_HOOKS_CONSUMER_HANDOFF.b4_mcp_handoff.phases[0]?.helper,
      "captureMcpHttpMessageAdmitted",
    );
    assert.equal(
      G9_WP6_TYPED_HOOKS_CONSUMER_HANDOFF.b1_orch_live_handoff.helper,
      "captureOrchLiveIfOfferAccepted",
    );
  });

  it("WP6 comm_id set covers twenty-one planned_typed_hooks phases plus MCP non-hook pair", () => {
    const wp6Set = new Set<string>(WP6_TYPED_HOOK_COMM_IDS);
    const phases = G9_LEDGER_PHASE_PAIRS.filter((p) => wp6Set.has(p.comm_id));
    // 17 RpcServer + 1 MCP delete + 2 T3 OTLP + 1 T2 OTLP + 2 B4 MCP non-hook = 23
    assert.equal(phases.length, 23);
  });

  it("builders route method tags to ledger partitions without payload fields", () => {
    assert.deepEqual(buildRpcAdmitCaptureInput("server.probe"), {
      comm_id: "INV-T2-RPC-WS",
      phase: "rpc-request-admitted",
      input: { method: "server.probe" },
    });
    assert.deepEqual(buildRpcUnarySuccessCaptureInput("orchestration.dispatchCommand"), {
      comm_id: "INV-T2-ORCH-RPC",
      phase: "rpc-handler-succeeded",
      input: { method: "orchestration.dispatchCommand" },
    });
    assert.deepEqual(buildRpcStreamElementCaptureInput("orchestration.subscribeShell"), {
      comm_id: "INV-T2-RPC-STREAM-ORCH",
      phase: "rpc-stream-element-emitted",
      input: { method: "orchestration.subscribeShell" },
    });
    assert.equal(buildRpcAdmitCaptureInput("not.a.method"), undefined);
    assert.equal(buildRpcUnarySuccessCaptureInput("terminal.attach"), undefined);
    assert.equal(buildRpcStreamElementCaptureInput("server.probe"), undefined);
  });

  it("OTLP eligibility excludes empty and SCM-only batches", () => {
    assert.equal(isCapturableOtlpExportBatch({ batchSize: 1 }), true);
    assert.equal(isCapturableOtlpExportBatch({ batchSize: 0 }), false);
    assert.equal(isCapturableOtlpExportBatch({ batchSize: 2, scmOnlyBatch: true }), false);
  });

  it.effect("absent G9CaptureService: withOptionalG9Capture and helpers are no-ops", () =>
    Effect.gen(function* () {
      let ran = false;
      yield* withOptionalG9Capture(() =>
        Effect.sync(() => {
          ran = true;
        }),
      );
      assert.equal(ran, false);

      yield* captureRpcRequestAdmitted("server.probe");
      yield* captureMcpHttpSessionDeleted();
      yield* captureT2OtlpExportSucceeded({ batchSize: 3 });
      yield* captureT3OtlpExportSucceededFromLabel({
        label: G9_T3_OTLP_EXPORTER_LABELS.traces,
        batchSize: 2,
      });
    }),
  );

  it.effect("present capture: Rpc admit/unary/stream project method-only A once each", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const layer = mockCaptureLayer(calls);

      yield* captureRpcRequestAdmitted("server.probe").pipe(Effect.provide(layer));
      yield* captureRpcUnarySucceeded("server.getConfig").pipe(Effect.provide(layer));
      yield* captureRpcStreamElement("terminal.attach").pipe(Effect.provide(layer));
      // Unknown / wrong-partition tags must not capture.
      yield* captureRpcUnarySucceeded("terminal.attach").pipe(Effect.provide(layer));
      yield* captureRpcRequestAdmitted("totally.unknown").pipe(Effect.provide(layer));

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 3);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-RPC-WS",
        phase: "rpc-request-admitted",
        input: { method: "server.probe" },
      });
      assert.deepEqual(seen[1], {
        comm_id: "INV-T2-RPC-WS",
        phase: "rpc-handler-succeeded",
        input: { method: "server.getConfig" },
      });
      assert.deepEqual(seen[2], {
        comm_id: "INV-T2-RPC-WS",
        phase: "rpc-stream-element-emitted",
        input: { method: "terminal.attach" },
      });
      for (const call of seen) {
        assert.deepEqual(Object.keys(call.input), ["method"]);
      }
    }),
  );

  it.effect("present capture: MCP delete + T2/T3 OTLP signal-only A", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const layer = mockCaptureLayer(calls);

      yield* captureMcpHttpSessionDeleted().pipe(Effect.provide(layer));
      yield* captureT2OtlpExportSucceeded({ batchSize: 4 }).pipe(Effect.provide(layer));
      yield* captureT2OtlpExportSucceeded({ batchSize: 4, scmOnlyBatch: true }).pipe(
        Effect.provide(layer),
      );
      yield* captureT3OtlpExportSucceededFromLabel({
        label: G9_T3_OTLP_EXPORTER_LABELS.traces,
        batchSize: 1,
      }).pipe(Effect.provide(layer));
      yield* captureT3OtlpExportSucceededFromLabel({
        label: G9_T3_OTLP_EXPORTER_LABELS.metrics,
        batchSize: 1,
      }).pipe(Effect.provide(layer));
      yield* captureT3OtlpExportSucceededFromLabel({
        label: "OtlpLogger",
        batchSize: 1,
      }).pipe(Effect.provide(layer));

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 4);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-MCP-HTTP",
        phase: "mcp-http-session-deleted",
        input: { site: "mcp-http-session-deleted" },
      });
      assert.deepEqual(seen[1], {
        comm_id: "INV-T2-TEL-T2-OTLP",
        phase: "t2-otlp-export-succeeded",
        input: { signal: "t2-otlp-export-succeeded" },
      });
      assert.deepEqual(seen[2], {
        comm_id: "INV-T2-TEL-T3-OTLP",
        phase: "t3-otlp-traces-export-succeeded",
        input: { signal: "t3-otlp-traces-export-succeeded" },
      });
      assert.deepEqual(seen[3], {
        comm_id: "INV-T2-TEL-T3-OTLP",
        phase: "t3-otlp-metrics-export-succeeded",
        input: { signal: "t3-otlp-metrics-export-succeeded" },
      });
    }),
  );

  it.effect("G9RpcServerRequestHooksLayer callbacks capture through mock service", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const env = Layer.merge(G9RpcServerRequestHooksLayer, mockCaptureLayer(calls));
      const hooks = yield* RpcServer.RpcServerRequestHooks.pipe(Effect.provide(env));

      // Callbacks resolve G9CaptureService at invoke time — provide env on each run.
      yield* hooks.onRequestAdmitted!({ tag: "subscribeAuthAccess", stream: true }).pipe(
        Effect.provide(env),
      );
      yield* hooks.onUnarySucceeded!({ tag: "orchestration.getTurnDiff" }).pipe(
        Effect.provide(env),
      );
      yield* hooks.onStreamElement!({ tag: "subscribeResourceTelemetry" }).pipe(
        Effect.provide(env),
      );

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 3);
      assert.equal(seen[0]?.comm_id, "INV-T2-RPC-STREAM-AUTH");
      assert.equal(seen[0]?.phase, "rpc-request-admitted");
      assert.equal(seen[1]?.comm_id, "INV-T2-ORCH-RPC");
      assert.equal(seen[1]?.phase, "rpc-handler-succeeded");
      assert.equal(seen[2]?.comm_id, "INV-T2-RPC-STREAM-TEL");
      assert.equal(seen[2]?.phase, "rpc-stream-element-emitted");
    }),
  );

  it.effect("G9McpHttpSessionHooksLayer captures session-deleted site only", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const env = Layer.merge(G9McpHttpSessionHooksLayer, mockCaptureLayer(calls));
      const hooks = yield* McpServer.HttpSessionHooks.pipe(Effect.provide(env));

      yield* hooks.onExistingSessionDeleted!({ site: "mcp-http-session-deleted" }).pipe(
        Effect.provide(env),
      );
      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 1);
      assert.deepEqual(seen[0]?.input, { site: "mcp-http-session-deleted" });
    }),
  );

  it.effect("G9T3OtlpExportHooksLayer maps OtlpTracer/OtlpMetrics labels", () =>
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
      assert.equal(seen[0]?.phase, "t3-otlp-traces-export-succeeded");
      assert.equal(seen[1]?.phase, "t3-otlp-metrics-export-succeeded");
    }),
  );
});

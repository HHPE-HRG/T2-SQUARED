/**
 * T3 server observability layer (logger, local-file tracer, optional OTLP).
 *
 * Agent (G10 S6 sole lander + WP6 consumer): admit/route/replace via
 * g10SeamBridge on this file for TEL-T3-OTLP and S5→S6 TEL-T3-TRACE handoff.
 * Provides G10T3OtlpExportHooksLayer (INV-T2-TEL-T3-OTLP post-success signals).
 * Lands INV-T2-TEL-T3-TRACE after local-file batch persist succeeds (onFlush
 * with count > 0). G9 capture stays observe-beside. Absent G10 controller /
 * G9CaptureService / ExportHooks ⇒ live unchanged. Hook fault must not rewrite
 * live export. Signal / presence A only — no spans.
 */
import { httpHeaderRedactionLayer } from "@t3tools/shared/httpObservability";
import { makeLocalFileTracer, makeTraceSink } from "@t3tools/shared/observability";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as References from "effect/References";
import * as Tracer from "effect/Tracer";
import * as OtlpExporter from "effect/unstable/observability/OtlpExporter";
import * as OtlpMetrics from "effect/unstable/observability/OtlpMetrics";
import * as OtlpSerialization from "effect/unstable/observability/OtlpSerialization";
import * as OtlpTracer from "effect/unstable/observability/OtlpTracer";

import * as ServerConfig from "../../config.ts";
import * as ResourceAttribution from "../../resourceTelemetry/ResourceAttribution.ts";
import { captureT3TracePersistedBatchSucceeded } from "../../scm/g9FamilyTerminalLocalStreams.ts";
import { withOptionalG9Capture } from "../../scm/g9FamilyTypedHooks.ts";
import { G10T3OtlpExportHooksLayer, t3TraceBatchViaG10Bridge } from "../../scm/g10SliceS6.ts";
import { ServerLoggerLive } from "../../serverLogger.ts";
import * as BrowserTraceCollector from "../BrowserTraceCollector.ts";

const otlpSerializationLayer = OtlpSerialization.layerJson;

export const ObservabilityLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ServerConfig.ServerConfig;
    const attribution = yield* ResourceAttribution.ResourceAttribution;

    const traceReferencesLayer = Layer.mergeAll(
      Layer.succeed(Tracer.MinimumTraceLevel, config.traceMinLevel),
      Layer.succeed(References.TracerTimingEnabled, config.traceTimingEnabled),
      httpHeaderRedactionLayer,
    );

    const tracerLayer = Layer.unwrap(
      Effect.gen(function* () {
        const sink = yield* makeTraceSink({
          filePath: config.serverTracePath,
          maxBytes: config.traceMaxBytes,
          maxFiles: config.traceMaxFiles,
          batchWindowMs: config.traceBatchWindowMs,
          onFlush: (stats) =>
            attribution
              .record({
                component: "server-trace",
                operation: "append",
                logicalWriteBytes: stats.logicalWriteBytes,
                count: stats.count,
                durationMs: stats.durationMs,
              })
              .pipe(
                // INV-T2-TEL-T3-TRACE / t3-trace-persisted-batch-succeeded (S5→S6 handoff land).
                // Agent: makeTraceSink already gates count > 0; presence A only.
                Effect.andThen(
                  t3TraceBatchViaG10Bridge(
                    withOptionalG9Capture((capture) =>
                      captureT3TracePersistedBatchSucceeded(capture),
                    ),
                  ),
                ),
              ),
        });
        const delegate =
          config.otlpTracesUrl === undefined
            ? undefined
            : yield* OtlpTracer.make({
                url: config.otlpTracesUrl,
                exportInterval: `${config.otlpExportIntervalMs} millis`,
                resource: {
                  serviceName: config.otlpServiceName,
                  attributes: {
                    "service.runtime": "t3-server",
                    "service.mode": config.mode,
                  },
                },
              });

        const tracer = yield* makeLocalFileTracer({
          filePath: config.serverTracePath,
          maxBytes: config.traceMaxBytes,
          maxFiles: config.traceMaxFiles,
          batchWindowMs: config.traceBatchWindowMs,
          sink,
          ...(delegate ? { delegate } : {}),
        });

        return Layer.mergeAll(
          Layer.succeed(Tracer.Tracer, tracer),
          BrowserTraceCollector.layer(sink),
        );
      }),
    ).pipe(
      Layer.provide(OtlpExporter.layerFlusher),
      Layer.provideMerge(otlpSerializationLayer),
      // Agent (G10 S6): ExportHooks for T3 OTLP post-success (traces path build).
      Layer.provide(G10T3OtlpExportHooksLayer),
    );

    const metricsLayer =
      config.otlpMetricsUrl === undefined
        ? Layer.empty
        : OtlpMetrics.layer({
            url: config.otlpMetricsUrl,
            exportInterval: `${config.otlpExportIntervalMs} millis`,
            resource: {
              serviceName: config.otlpServiceName,
              attributes: {
                "service.runtime": "t3-server",
                "service.mode": config.mode,
              },
            },
          }).pipe(
            Layer.provideMerge(otlpSerializationLayer),
            // Agent (G10 S6): ExportHooks for T3 OTLP post-success (metrics path build).
            Layer.provide(G10T3OtlpExportHooksLayer),
          );

    return Layer.mergeAll(ServerLoggerLive, traceReferencesLayer, tracerLayer, metricsLayer);
  }),
);

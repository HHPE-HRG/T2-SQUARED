/**
 * T3 server observability layer (logger, local-file tracer, optional OTLP).
 *
 * Agent (WP6-Consumer-Owner, RFC-014 A): sole lander for G9 on this file.
 * Provides G9T3OtlpExportHooksLayer (INV-T2-TEL-T3-OTLP post-success signals).
 * Lands B5 INV-T2-TEL-T3-TRACE after local-file batch persist succeeds (onFlush
 * with count > 0). Absent G9CaptureService / ExportHooks ⇒ live unchanged.
 * Hook fault must not rewrite live export. Signal / presence A only — no spans.
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
import { G9T3OtlpExportHooksLayer, withOptionalG9Capture } from "../../scm/g9FamilyTypedHooks.ts";
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
                // INV-T2-TEL-T3-TRACE / t3-trace-persisted-batch-succeeded (B5→WP6).
                // Agent: makeTraceSink already gates count > 0; presence A only.
                Effect.andThen(
                  withOptionalG9Capture((capture) =>
                    captureT3TracePersistedBatchSucceeded(capture),
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
      // Agent (WP6): ExportHooks for T3 OTLP post-success (traces path build).
      Layer.provide(G9T3OtlpExportHooksLayer),
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
            // Agent (WP6): ExportHooks for T3 OTLP post-success (metrics path build).
            Layer.provide(G9T3OtlpExportHooksLayer),
          );

    return Layer.mergeAll(ServerLoggerLive, traceReferencesLayer, tracerLayer, metricsLayer);
  }),
);

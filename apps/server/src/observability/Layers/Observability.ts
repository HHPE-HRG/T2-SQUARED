/**
 * T3 server observability layer (logger, local-file tracer, optional OTLP).
 *
 * Agent (G10 S6 sole lander + Fabric-depth FD6 + WP6 consumer): admit/route/
 * replace via g10SeamBridge on this file for TEL-T3-OTLP and S5→S6 TEL-T3-TRACE
 * handoff. FD6: inventoriable verbs run inside bridged liveIo —
 *   - TEL-T3-TRACE: TraceSink.flush (file persist + onFlush) through bridge
 *   - TEL-T3-OTLP: HttpClient.execute for OTLP URLs through bridge
 * G9 capture stays observe-beside (ExportHooks / onFlush). Absent G10
 * controller / G9CaptureService / ExportHooks ⇒ live unchanged. Hook fault
 * must not rewrite live export. Signal / presence A only — no spans.
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
import { g10T3OtlpHttpClientLayer, t3TraceBatchViaG10Bridge } from "../../scm/g10SliceS6.ts";
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
        // Agent (FD6): raw sink owns file persist; bridged sink.flush reuses that verb.
        const rawSink = yield* makeTraceSink({
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
                // INV-T2-TEL-T3-TRACE G9 capture (observe-beside inside flush liveIo).
                Effect.andThen(
                  withOptionalG9Capture((capture) =>
                    captureT3TracePersistedBatchSucceeded(capture),
                  ),
                ),
              ),
        });
        // INV-T2-TEL-T3-TRACE: whole flush Effect (persist + onFlush) through G10 bridge.
        const sink = {
          filePath: rawSink.filePath,
          push: (record: Parameters<typeof rawSink.push>[0]) => rawSink.push(record),
          flush: t3TraceBatchViaG10Bridge(rawSink.flush),
          close: () => t3TraceBatchViaG10Bridge(rawSink.close()),
        };
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
      // Agent (G9): post-success capture only — G10 real I/O is HttpClient wrap below.
      Layer.provide(G9T3OtlpExportHooksLayer),
      // INV-T2-TEL-T3-OTLP: OTLP HTTP execute through G10 bridge (FD6 real).
      Layer.provide(g10T3OtlpHttpClientLayer(config.otlpTracesUrl, config.otlpMetricsUrl)),
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
            Layer.provide(G9T3OtlpExportHooksLayer),
            Layer.provide(g10T3OtlpHttpClientLayer(config.otlpTracesUrl, config.otlpMetricsUrl)),
          );

    return Layer.mergeAll(ServerLoggerLive, traceReferencesLayer, tracerLayer, metricsLayer);
  }),
);

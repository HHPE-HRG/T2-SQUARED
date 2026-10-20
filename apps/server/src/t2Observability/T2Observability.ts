/**
 * T2 OpenTelemetry bridge (catalog spans + optional OTLP / NDJSON exporters).
 *
 * Agent (G10 S6 sole lander + Fabric-depth FD6 + WP6 consumer): admit/route/
 * replace via g10SeamBridge on this file for FLAG-T2-OTEL, TEL-T2-OTLP, and
 * S5→S6 TEL-NDJSON handoff. FD6: inventoriable verbs (env resolve / NDJSON
 * append / OTLP export) run inside liveIo so manifoldEffect reuses the same
 * verb — not capture-beside-only. G9 capture stays observe-beside inside that
 * liveIo. Absent G10 controller / G9CaptureService ⇒ live exporters unchanged.
 * Hook/capture fault must not rewrite live success. Signal / member / presence
 * A only — no URLs, paths, or span payloads in A.
 */
// @effect-diagnostics nodeBuiltinImport:off
import { AsyncLocalStorage } from "node:async_hooks";
import { join } from "node:path";

import {
  ROOT_CONTEXT,
  SpanStatusCode,
  TraceFlags,
  trace,
  type Attributes,
  type Context as OtelContext,
  type Span,
  type Tracer,
} from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  SimpleSpanProcessor,
  type ReadableSpan,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import type * as TracerModule from "effect/Tracer";

import * as ServerConfig from "../config.ts";
import {
  captureFlagT2OtelResolved,
  type G9T2OtelFlagMember,
  type G9T2OtelFlagState,
} from "../scm/g9FamilyFileDbProcessConfig.ts";
import { captureNdjsonExportSucceeded } from "../scm/g9FamilyTerminalLocalStreams.ts";
import { captureT2OtlpExportSucceeded, withOptionalG9Capture } from "../scm/g9FamilyTypedHooks.ts";
import {
  flagT2OtelViaG10Bridge,
  ndjsonExportViaG10Bridge,
  t2OtlpExportViaG10Bridge,
} from "../scm/g10SliceS6.ts";
import { type T2CatalogBoundary } from "./boundaries.ts";
import { T2NdjsonSpanExporter } from "./ndjsonExporter.ts";

const t2Als = new AsyncLocalStorage<Span | undefined>();

export const T2CurrentOtelSpan = Context.Reference<Span | undefined>(
  "t2/t2Observability/CurrentOtelSpan",
  { defaultValue: () => undefined },
);

export class T2Observability extends Context.Service<
  T2Observability,
  {
    readonly tracer: Tracer;
    readonly filePath: string;
    readonly forceFlush: Effect.Effect<void>;
    readonly withBridge: <A, E, R>(
      boundary: T2CatalogBoundary,
      effect: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E, R>;
    readonly withBridgeStream: <A, E, R>(
      boundary: T2CatalogBoundary,
      stream: Stream.Stream<A, E, R>,
    ) => Stream.Stream<A, E, R>;
    readonly withOwned: <A, E, R>(
      name: string,
      effect: Effect.Effect<A, E, R>,
      attributes?: Attributes,
    ) => Effect.Effect<A, E, R>;
  }
  // Runtime identity is t2/... (WP6 owns capture). Deterministic-key lint wants t3/...; do not rename.
  // @effect-diagnostics-next-line deterministicKeys:off
>()("t2/t2Observability/T2Observability") {}

export interface T2ObservabilityMakeOptions {
  readonly filePath: string;
  readonly exporter?: SpanExporter;
  readonly tracesUrl?: string;
  readonly serviceName?: string;
}

const t3Link = (
  t3Span: Option.Option<TracerModule.AnySpan>,
): Array<{ context: { traceId: string; spanId: string; traceFlags: number } }> => {
  if (Option.isNone(t3Span)) {
    return [];
  }
  return [
    {
      context: {
        traceId: t3Span.value.traceId,
        spanId: t3Span.value.spanId,
        traceFlags: TraceFlags.SAMPLED,
      },
    },
  ];
};

const endSpan = (span: Span, exit: Exit.Exit<unknown, unknown>): void => {
  if (Exit.isFailure(exit)) {
    span.setStatus({ code: SpanStatusCode.ERROR });
  }
  span.end();
};

const withT2Span = <A, E, R>(span: Span, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = t2Als.getStore();
      t2Als.enterWith(span);
      return previous;
    }),
    () => effect.pipe(Effect.provideService(T2CurrentOtelSpan, span)),
    (previous, exit) =>
      Effect.sync(() => {
        endSpan(span, exit);
        t2Als.enterWith(previous);
      }),
  );

type ExportResult = { readonly code: number; readonly error?: Error };

/**
 * Wrap a SpanExporter so inventoriable export I/O runs through a G10 bridge.
 *
 * Intended: liveIo = inner.export + optional G9 capture; viaBridge selects
 * live vs manifold so manifoldEffect reuses the same export verb (FD6 real).
 * Observed: resultCallback fires after the bridged Effect settles (runFork).
 * Failure / empty batch ⇒ no capture. Uses runForkWith(context) from make().
 */
const wrapSpanExporterWithG10RealIo = (
  inner: SpanExporter,
  runFork: (effect: Effect.Effect<void, never>) => void,
  viaBridge: (liveIo: Effect.Effect<ExportResult, never>) => Effect.Effect<ExportResult, never>,
  onSuccessCapture: (batchSize: number) => Effect.Effect<void, never>,
): SpanExporter => ({
  export(spans: Array<ReadableSpan>, resultCallback: (result: ExportResult) => void): void {
    // Agent: export verb inside Effect so manifold authority reuses append/OTLP.
    const liveIo = Effect.callback<ExportResult>((resume) => {
      inner.export(spans, (result) => {
        resume(Effect.succeed(result));
      });
    }).pipe(
      Effect.tap((result) =>
        result.code === 0 && spans.length > 0 ? onSuccessCapture(spans.length) : Effect.void,
      ),
    );
    runFork(
      viaBridge(liveIo).pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            resultCallback(result);
          }),
        ),
        Effect.catchCause(() =>
          Effect.sync(() => {
            resultCallback({
              code: 1,
              error: new Error("T2Observability G10 bridged export failed"),
            });
          }),
        ),
      ),
    );
  },
  shutdown: () => inner.shutdown(),
  forceFlush: () => inner.forceFlush(),
});

/**
 * Resolve FLAG-T2-OTEL state_label for one env member (presence/shape only).
 *
 * Agent: no URL/path values enter A. See b2-to-wp6-t2-observability.md mapping.
 */
export const resolveT2OtelFlagState = (
  member: G9T2OtelFlagMember,
  environment: NodeJS.ProcessEnv = process.env,
): G9T2OtelFlagState => {
  const raw = environment[member];
  const present = raw !== undefined && raw.trim() !== "";
  switch (member) {
    case "T2CODE_TRACE_FILE":
      return present ? "configured" : "defaulted";
    case "T2CODE_OTLP_TRACES_URL":
      return present ? "configured" : "absent";
    case "T2CODE_OTLP_SERVICE_NAME":
      return present ? "configured" : "defaulted";
    default: {
      const _exhaustive: never = member;
      return _exhaustive;
    }
  }
};

/**
 * Capture all three FLAG-T2-OTEL members once at layer construction.
 *
 * Agent: FD6 — env resolve runs inside liveIo so manifoldEffect reuses the
 * flag-resolve verb; G9 capture remains observe-beside inside that Effect.
 */
export const captureT2OtelFlagsResolved = (
  environment: NodeJS.ProcessEnv = process.env,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const members = [
      "T2CODE_TRACE_FILE",
      "T2CODE_OTLP_TRACES_URL",
      "T2CODE_OTLP_SERVICE_NAME",
    ] as const satisfies ReadonlyArray<G9T2OtelFlagMember>;
    for (const member of members) {
      yield* flagT2OtelViaG10Bridge(
        member,
        Effect.gen(function* () {
          // Inventoriable verb: env member resolve (presence/shape only).
          const state_label = resolveT2OtelFlagState(member, environment);
          yield* withOptionalG9Capture((capture) =>
            captureFlagT2OtelResolved(member, state_label, capture).pipe(Effect.asVoid),
          );
          return state_label;
        }),
      );
    }
  });

const make = (options: T2ObservabilityMakeOptions) =>
  Effect.gen(function* () {
    const serviceName = options.serviceName ?? "t2-server";
    // Agent: freeze Effect context at make so SDK export callbacks can
    // serviceOption(G9CaptureService). Absent at make ⇒ capture stays no-op.
    const context = yield* Effect.context<never>();
    const runFork = Effect.runForkWith(context);

    // INV-T2-TEL-NDJSON: NDJSON append inside bridged liveIo (FD6 real).
    const ndjsonExporter = wrapSpanExporterWithG10RealIo(
      new T2NdjsonSpanExporter(options.filePath),
      (effect) => {
        runFork(effect);
      },
      (liveIo) => ndjsonExportViaG10Bridge(liveIo),
      () => withOptionalG9Capture((capture) => captureNdjsonExportSucceeded(capture)),
    );

    const spanProcessors = [
      new SimpleSpanProcessor(ndjsonExporter),
      ...(options.exporter === undefined ? [] : [new SimpleSpanProcessor(options.exporter)]),
      ...(options.tracesUrl === undefined
        ? []
        : [
            new BatchSpanProcessor(
              // INV-T2-TEL-T2-OTLP: OTLP export inside bridged liveIo (FD6 real).
              wrapSpanExporterWithG10RealIo(
                new OTLPTraceExporter({ url: options.tracesUrl }),
                (effect) => {
                  runFork(effect);
                },
                (liveIo) => t2OtlpExportViaG10Bridge(liveIo),
                (batchSize) => captureT2OtlpExportSucceeded({ batchSize }),
              ),
            ),
          ]),
    ];
    const provider = new BasicTracerProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
      }),
      spanProcessors,
    });
    const tracer = provider.getTracer("t2");

    yield* Effect.addFinalizer(() => Effect.promise(() => provider.shutdown()));

    const startBridge = (
      boundary: T2CatalogBoundary,
      t3Span: Option.Option<TracerModule.AnySpan>,
    ) =>
      tracer.startSpan(
        `t2.${boundary}`,
        {
          root: true,
          attributes: {
            "t2.boundary": boundary,
          },
          links: t3Link(t3Span),
        },
        ROOT_CONTEXT,
      );

    const startOwned = (name: string, parent: Span | undefined, attributes?: Attributes) => {
      const context: OtelContext =
        parent === undefined ? ROOT_CONTEXT : trace.setSpan(ROOT_CONTEXT, parent);
      return tracer.startSpan(
        name,
        {
          root: parent === undefined,
          ...(attributes === undefined ? {} : { attributes }),
        },
        context,
      );
    };

    return T2Observability.of({
      tracer,
      filePath: options.filePath,
      forceFlush: Effect.promise(() => provider.forceFlush()),
      withBridge: (boundary, effect) =>
        Effect.flatMap(Effect.currentSpan.pipe(Effect.option), (t3Span) =>
          withT2Span(startBridge(boundary, t3Span), effect),
        ),
      withBridgeStream: (boundary, stream) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const t3Span = yield* Effect.currentSpan.pipe(Effect.option);
            const span = startBridge(boundary, t3Span);
            const previous = t2Als.getStore();
            t2Als.enterWith(span);
            return stream.pipe(
              Stream.provideService(T2CurrentOtelSpan, span),
              Stream.ensuring(
                Effect.sync(() => {
                  span.end();
                  t2Als.enterWith(previous);
                }),
              ),
            );
          }),
        ),
      withOwned: (name, effect, attributes) =>
        Effect.flatMap(T2CurrentOtelSpan, (parent) =>
          withT2Span(startOwned(name, parent, attributes), effect),
        ),
    });
  });

export const layerTest = (options: T2ObservabilityMakeOptions): Layer.Layer<T2Observability> =>
  Layer.effect(T2Observability, make(options));

export const T2ObservabilityLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ServerConfig.ServerConfig;
    const tracesUrl = process.env.T2CODE_OTLP_TRACES_URL;
    // INV-T2-FLAG-T2-OTEL / flag-resolved (B2→WP6): one capture per member at resolve.
    yield* captureT2OtelFlagsResolved(process.env);
    return layerTest({
      filePath: process.env.T2CODE_TRACE_FILE ?? join(config.logsDir, "t2.trace.ndjson"),
      ...(tracesUrl === undefined ? {} : { tracesUrl }),
      serviceName: process.env.T2CODE_OTLP_SERVICE_NAME ?? "t2-server",
    });
  }),
);

export const withCatalogBridge = <A, E, R>(
  boundary: T2CatalogBoundary,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.flatMap(Effect.serviceOption(T2Observability), (t2) =>
    Option.match(t2, {
      onNone: () => effect,
      onSome: (service) => service.withBridge(boundary, effect),
    }),
  );

export const withCatalogBridgeStream = <A, E, R>(
  boundary: T2CatalogBoundary,
  stream: Stream.Stream<A, E, R>,
): Stream.Stream<A, E, R> =>
  Stream.unwrap(
    Effect.flatMap(Effect.serviceOption(T2Observability), (t2) =>
      Option.match(t2, {
        onNone: () => Effect.succeed(stream),
        onSome: (service) => Effect.succeed(service.withBridgeStream(boundary, stream)),
      }),
    ),
  );

export const withOwnedSpan = <A, E, R>(
  name: string,
  effect: Effect.Effect<A, E, R>,
  attributes?: Attributes,
): Effect.Effect<A, E, R> =>
  Effect.flatMap(Effect.serviceOption(T2Observability), (t2) =>
    Option.match(t2, {
      onNone: () => effect,
      onSome: (service) => service.withOwned(name, effect, attributes),
    }),
  );

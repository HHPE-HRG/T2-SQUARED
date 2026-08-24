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

const make = (options: T2ObservabilityMakeOptions) =>
  Effect.gen(function* () {
    const serviceName = options.serviceName ?? "t2-server";
    const ndjsonExporter = new T2NdjsonSpanExporter(options.filePath);
    const spanProcessors = [
      new SimpleSpanProcessor(ndjsonExporter),
      ...(options.exporter === undefined ? [] : [new SimpleSpanProcessor(options.exporter)]),
      ...(options.tracesUrl === undefined
        ? []
        : [new BatchSpanProcessor(new OTLPTraceExporter({ url: options.tracesUrl }))]),
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
          attributes,
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
    return layerTest({
      filePath: process.env.T2CODE_TRACE_FILE ?? join(config.logsDir, "t2.trace.ndjson"),
      tracesUrl: process.env.T2CODE_OTLP_TRACES_URL,
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

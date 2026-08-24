import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assert, describe, it } from "@effect/vitest";
import { context, ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import * as Effect from "effect/Effect";
import * as Tracer from "effect/Tracer";

import { observeRpcEffect } from "../observability/RpcInstrumentation.ts";
import { T2Observability, layerTest, withCatalogBridge, withOwnedSpan } from "./T2Observability.ts";

const makeFilePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "t2-trace-")), "t2.trace.ndjson");

const captureT3Spans = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<{ readonly value: A; readonly spans: ReadonlyArray<Tracer.NativeSpan> }, E, R> =>
  Effect.gen(function* () {
    const spans: Array<Tracer.NativeSpan> = [];
    const tracer = Tracer.make({
      span: (options) => {
        const span = new Tracer.NativeSpan(options);
        const end = span.end.bind(span);
        span.end = (endTime, exit) => {
          end(endTime, exit);
          if (span.sampled) {
            spans.push(span);
          }
        };
        return span;
      },
    });
    const value = yield* effect.pipe(Effect.withTracer(tracer));
    return { value, spans };
  });

describe("T2Observability", () => {
  it.effect("does not register a global tracer provider", () => {
    const exporter = new InMemorySpanExporter();
    const before = trace.getTracerProvider();
    return Effect.gen(function* () {
      yield* withOwnedSpan("t2.admission", Effect.succeed("ok"));
      const t2 = yield* T2Observability;
      yield* t2.forceFlush;
      assert.strictEqual(trace.getTracerProvider(), before);
    }).pipe(Effect.provide(layerTest({ exporter, filePath: makeFilePath() })));
  });

  it.effect("emits a catalog bridge span that links to T3 without sharing a trace id", () => {
    const exporter = new InMemorySpanExporter();
    const filePath = makeFilePath();
    return Effect.gen(function* () {
      const captured = yield* captureT3Spans(
        withCatalogBridge("rpc", Effect.succeed("ok")).pipe(
          Effect.withSpan("ws.rpc.catalog", {
            attributes: {
              "rpc.method": "secret",
              "rpc.system": "effect-rpc",
            },
          }),
        ),
      );
      const t2 = yield* T2Observability;
      yield* t2.forceFlush;

      const t3Span = captured.spans.find((span) => span.name === "ws.rpc.catalog");
      assert.ok(t3Span);
      const t2Spans = exporter.getFinishedSpans();
      const bridge = t2Spans.find((span) => span.name === "t2.rpc");
      assert.ok(bridge);
      assert.equal(t2Spans.filter((span) => span.name === "t2.rpc").length, 1);
      assert.notEqual(bridge.spanContext().traceId, t3Span.traceId);
      assert.equal(bridge.parentSpanContext, undefined);
      assert.equal(bridge.links.length, 1);
      assert.equal(bridge.links[0]?.context.traceId, t3Span.traceId);
      assert.equal(bridge.links[0]?.context.spanId, t3Span.spanId);
      assert.equal(bridge.attributes["rpc.method"], undefined);
      assert.equal(bridge.attributes["rpc.system"], undefined);
      assert.equal(bridge.attributes["t2.boundary"], "rpc");
      assert.equal(bridge.resource.attributes[ATTR_SERVICE_NAME], "t2-server");
      assert.match(t2.filePath, /t2\.trace\.ndjson$/);
      assert.notMatch(t2.filePath, /server\.trace\.ndjson$/);

      const records = readFileSync(filePath, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { readonly name: string });
      assert.equal(
        records.some((record) => record.name === "t2.rpc"),
        true,
      );
    }).pipe(Effect.provide(layerTest({ exporter, filePath })));
  });

  it.effect("mirrors one catalog span when T3 records helper children", () => {
    const exporter = new InMemorySpanExporter();
    return Effect.gen(function* () {
      yield* captureT3Spans(
        observeRpcEffect(
          "catalog.mirror",
          Effect.succeed("ok").pipe(Effect.withSpan("ws.rpc.catalog.mirror.helper")),
        ),
      );
      const t2 = yield* T2Observability;
      yield* t2.forceFlush;
      const t2Spans = exporter.getFinishedSpans();
      const catalogNames = t2Spans
        .filter((span) => span.name.startsWith("t2."))
        .map((span) => span.name);
      assert.equal(catalogNames.length, 1);
      assert.equal(catalogNames[0], "t2.rpc");
    }).pipe(Effect.provide(layerTest({ exporter, filePath: makeFilePath() })));
  });

  it.effect("records a T2-owned span without a T3 link", () => {
    const exporter = new InMemorySpanExporter();
    return Effect.gen(function* () {
      yield* withOwnedSpan("t2.admission", Effect.succeed("ok"), {
        "t2.work": "admission",
      });
      const t2 = yield* T2Observability;
      yield* t2.forceFlush;
      const owned = exporter.getFinishedSpans().find((span) => span.name === "t2.admission");
      assert.ok(owned);
      assert.equal(owned.links.length, 0);
      assert.equal(owned.parentSpanContext, undefined);
      assert.equal(owned.attributes["t2.work"], "admission");
    }).pipe(Effect.provide(layerTest({ exporter, filePath: makeFilePath() })));
  });

  it.effect("nests T2-owned work under the T2 catalog trace", () => {
    const exporter = new InMemorySpanExporter();
    return Effect.gen(function* () {
      yield* withCatalogBridge("rpc", withOwnedSpan("t2.admission", Effect.succeed("ok"))).pipe(
        Effect.withSpan("ws.rpc.catalog"),
      );
      const t2 = yield* T2Observability;
      yield* t2.forceFlush;
      const t2Spans = exporter.getFinishedSpans();
      const bridge = t2Spans.find((span) => span.name === "t2.rpc");
      const owned = t2Spans.find((span) => span.name === "t2.admission");
      assert.ok(bridge);
      assert.ok(owned);
      assert.equal(owned.spanContext().traceId, bridge.spanContext().traceId);
      assert.equal(owned.parentSpanContext?.spanId, bridge.spanContext().spanId);
    }).pipe(Effect.provide(layerTest({ exporter, filePath: makeFilePath() })));
  });
});

describe("T2Observability isolation", () => {
  it("does not parent T2 spans under a foreign OpenTelemetry span", async () => {
    const exporter = new InMemorySpanExporter();
    const filePath = makeFilePath();
    const dummy = trace.getTracer("foreign").startSpan("foreign");
    let owned: ReturnType<InMemorySpanExporter["getFinishedSpans"]>[number] | undefined;
    try {
      await context.with(trace.setSpan(ROOT_CONTEXT, dummy), async () => {
        await Effect.runPromise(
          Effect.gen(function* () {
            yield* withOwnedSpan("t2.admission", Effect.succeed("ok"));
            const t2 = yield* T2Observability;
            yield* t2.forceFlush;
            owned = exporter.getFinishedSpans().find((span) => span.name === "t2.admission");
          }).pipe(Effect.provide(layerTest({ exporter, filePath }))),
        );
      });
    } finally {
      dummy.end();
    }
    assert.ok(owned);
    assert.equal(owned.parentSpanContext, undefined);
    assert.notEqual(owned.spanContext().traceId, dummy.spanContext().traceId);
    assert.notEqual(owned.spanContext().spanId, dummy.spanContext().spanId);
  });
});

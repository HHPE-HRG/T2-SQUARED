// @effect-diagnostics nodeBuiltinImport:off
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assert, describe, it } from "@effect/vitest";
import { context, ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Tracer from "effect/Tracer";

import { observeRpcEffect } from "../observability/RpcInstrumentation.ts";
import { G9CaptureService } from "../scm/g9OrchQueueCapture.ts";
import type {
  G9CaptureOccurrenceInput,
  G9CaptureResult,
  G9EqualityA,
} from "../scm/g9Occurrence.ts";
import {
  T2Observability,
  captureT2OtelFlagsResolved,
  layerTest,
  resolveT2OtelFlagState,
  withCatalogBridge,
  withOwnedSpan,
} from "./T2Observability.ts";

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

describe("T2Observability G9 consumer (WP6)", () => {
  it("resolveT2OtelFlagState maps configured / defaulted / absent without values", () => {
    assert.equal(
      resolveT2OtelFlagState("T2CODE_TRACE_FILE", { T2CODE_TRACE_FILE: "/secret/path" }),
      "configured",
    );
    assert.equal(resolveT2OtelFlagState("T2CODE_TRACE_FILE", {}), "defaulted");
    assert.equal(
      resolveT2OtelFlagState("T2CODE_OTLP_TRACES_URL", { T2CODE_OTLP_TRACES_URL: "http://x" }),
      "configured",
    );
    assert.equal(resolveT2OtelFlagState("T2CODE_OTLP_TRACES_URL", {}), "absent");
    assert.equal(resolveT2OtelFlagState("T2CODE_OTLP_SERVICE_NAME", {}), "defaulted");
  });

  it.effect("absent G9CaptureService: flag capture is a no-op", () =>
    Effect.gen(function* () {
      yield* captureT2OtelFlagsResolved({
        T2CODE_TRACE_FILE: "/tmp/t2.trace.ndjson",
        T2CODE_OTLP_TRACES_URL: "http://127.0.0.1:4318",
        T2CODE_OTLP_SERVICE_NAME: "svc",
      });
    }),
  );

  it.effect("present capture: FLAG-T2-OTEL projects member + state_label only", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const layer = Layer.succeed(G9CaptureService, {
        captureOccurrence: (input) =>
          Ref.update(calls, (xs) => [...xs, input]).pipe(Effect.as(stubEnqueued(input))),
      });

      yield* captureT2OtelFlagsResolved({
        T2CODE_TRACE_FILE: "/tmp/t2.trace.ndjson",
        T2CODE_OTLP_SERVICE_NAME: "svc",
      }).pipe(Effect.provide(layer));

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 3);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-FLAG-T2-OTEL",
        phase: "flag-resolved",
        input: { member: "T2CODE_TRACE_FILE", state_label: "configured" },
      });
      assert.deepEqual(seen[1], {
        comm_id: "INV-T2-FLAG-T2-OTEL",
        phase: "flag-resolved",
        input: { member: "T2CODE_OTLP_TRACES_URL", state_label: "absent" },
      });
      assert.deepEqual(seen[2], {
        comm_id: "INV-T2-FLAG-T2-OTEL",
        phase: "flag-resolved",
        input: { member: "T2CODE_OTLP_SERVICE_NAME", state_label: "configured" },
      });
      for (const call of seen) {
        assert.deepEqual(Object.keys(call.input).sort(), ["member", "state_label"]);
      }
    }),
  );

  it.effect("NDJSON export success captures presence-only TEL-NDJSON when G9 present", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const filePath = makeFilePath();
      const captureService = {
        captureOccurrence: (input: G9CaptureOccurrenceInput) =>
          Ref.update(calls, (xs) => [...xs, input]).pipe(Effect.as(stubEnqueued(input))),
      };

      // Agent: G9 must be in fiber context at make() so runForkWith can see it
      // (same pattern as Manager G9 TERM tests).
      yield* Effect.gen(function* () {
        yield* withOwnedSpan("t2.admission", Effect.succeed("ok"));
        const t2 = yield* T2Observability;
        yield* t2.forceFlush;
        // SDK export callbacks fork capture; drain until the NDJSON row lands.
        for (let i = 0; i < 32; i++) {
          const seen = yield* Ref.get(calls);
          if (
            seen.some(
              (call) =>
                call.comm_id === "INV-T2-TEL-NDJSON" && call.phase === "ndjson-export-succeeded",
            )
          ) {
            break;
          }
          yield* Effect.yieldNow;
        }
      }).pipe(
        Effect.provide(layerTest({ filePath })),
        Effect.provideService(G9CaptureService, captureService),
      );

      const seen = yield* Ref.get(calls);
      const ndjson = seen.filter(
        (call) => call.comm_id === "INV-T2-TEL-NDJSON" && call.phase === "ndjson-export-succeeded",
      );
      assert.equal(ndjson.length, 1);
      assert.deepEqual(ndjson[0]?.input, { comm_id: "present" });
    }),
  );
});

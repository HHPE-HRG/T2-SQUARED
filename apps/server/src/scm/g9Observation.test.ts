// @effect-diagnostics nodeBuiltinImport:off
/**
 * G9 observation catalog + sandbox tests (WP4 / Task 6).
 *
 * Intended: allowlisted span attrs only; dying observer cannot change FIFO depth;
 * fault spans emit required pair or full five keys, never scope / sixth key.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import * as Effect from "effect/Effect";

import { T2Observability, layerTest } from "../t2Observability/T2Observability.ts";
import { G9NodeFifos } from "./g9Fifo.ts";
import type { G9Occurrence } from "./g9Occurrence.ts";
import { makeG9Observation, sandboxObserve } from "./g9Observation.ts";
import { loadG9Package } from "./g9Package.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const fifoMax = loadG9Package(repoRoot).parameters.fifo_max_occurrences_per_node;

const makeOtelFilePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "t2-scm-g9-obs-")), "t2.trace.ndjson");

const buildOcc = (attempt_sequence: number): G9Occurrence => ({
  comm_id: "INV-T2-ORCH-QUEUE",
  phase_id: "queue-offered",
  node_id: "node.orchestration",
  origin_bus_id: "bus.control",
  attempt_sequence,
  equality_A: { command_type: "client" },
  semanticKind: "request",
  request_label: "client",
  state_label: "",
  retainCurrentAfterPublish: false,
});

describe("G9 observation catalog", () => {
  it.effect("overload-start attrs are only allowlisted keys", () => {
    const exporter = new InMemorySpanExporter();
    const obs = makeG9Observation();
    return Effect.gen(function* () {
      yield* obs.overloadStart({
        node_id: "node.orchestration",
        bus_id: "bus.control",
        fifo_depth: fifoMax,
        reason: "capacity",
      });
      const t2 = yield* T2Observability;
      yield* t2.forceFlush;
      const spans = exporter
        .getFinishedSpans()
        .filter((span) => span.name === "t2.scm.shadow.overload.start");
      assert.equal(spans.length, 1);
      const keys = Object.keys(spans[0]?.attributes ?? {}).sort();
      assert.deepEqual(keys, [
        "t2.scm.bus_id",
        "t2.scm.fifo_depth",
        "t2.scm.node_id",
        "t2.scm.reason",
      ]);
      assert.equal(spans[0]?.attributes["command_type"], undefined);
      assert.equal(spans[0]?.attributes["payload"], undefined);
    }).pipe(Effect.provide(layerTest({ exporter, filePath: makeOtelFilePath() })));
  });

  it.effect("dying observer inside sandbox leaves FIFO depth unchanged", () =>
    Effect.gen(function* () {
      const fifos = new G9NodeFifos(fifoMax);
      const admitted = fifos.admit({
        node_id: "node.orchestration",
        bus_id: "bus.control",
        build: buildOcc,
      });
      assert.equal(admitted.result.status, "enqueued");
      assert.equal(admitted.depth, 1);

      yield* sandboxObserve(Effect.die("obs"));
      assert.equal(fifos.depth("node.orchestration"), 1);
    }),
  );

  it.effect("waker-style fault emits only fault_code + waker_state", () => {
    const exporter = new InMemorySpanExporter();
    const obs = makeG9Observation();
    return Effect.gen(function* () {
      yield* obs.fault({
        fault_code: "clock-overlap",
        waker_state: "armed-in-flight",
      });
      const t2 = yield* T2Observability;
      yield* t2.forceFlush;
      const spans = exporter
        .getFinishedSpans()
        .filter((span) => span.name === "t2.scm.shadow.fault");
      assert.equal(spans.length, 1);
      const keys = Object.keys(spans[0]?.attributes ?? {}).sort();
      assert.deepEqual(keys, ["t2.scm.fault_code", "t2.scm.waker_state"]);
      assert.equal(spans[0]?.attributes["t2.scm.scope"], undefined);
      assert.equal(spans[0]?.attributes["scope"], undefined);
    }).pipe(Effect.provide(layerTest({ exporter, filePath: makeOtelFilePath() })));
  });

  it.effect("capture-style fault emits all five allowlisted keys and no sixth", () => {
    const exporter = new InMemorySpanExporter();
    const obs = makeG9Observation();
    return Effect.gen(function* () {
      yield* obs.fault({
        fault_code: "preflight",
        waker_state: "armed-idle",
        comm_id: "INV-T2-ORCH-QUEUE",
        node_id: "node.orchestration",
        bus_id: "bus.control",
      });
      const t2 = yield* T2Observability;
      yield* t2.forceFlush;
      const spans = exporter
        .getFinishedSpans()
        .filter((span) => span.name === "t2.scm.shadow.fault");
      assert.equal(spans.length, 1);
      const keys = Object.keys(spans[0]?.attributes ?? {}).sort();
      assert.deepEqual(keys, [
        "t2.scm.bus_id",
        "t2.scm.comm_id",
        "t2.scm.fault_code",
        "t2.scm.node_id",
        "t2.scm.waker_state",
      ]);
      assert.equal(spans[0]?.attributes["scope"], undefined);
      assert.equal(spans[0]?.attributes["t2.scm.scope"], undefined);
    }).pipe(Effect.provide(layerTest({ exporter, filePath: makeOtelFilePath() })));
  });
});

/**
 * WP5 B5 terminal-local-streams family tests (Mode B Wave W5c).
 *
 * Intended: helpers call captureOccurrence once with ledger-bounded input;
 * withOptionalG9Capture no-ops when G9CaptureService is absent; T3-TRACE /
 * NDJSON handoff notes target WP6 sole landers; TERM A never carries terminal
 * bytes; RES-MONITOR / DESKTOP-IN carry type tags only.
 *
 * Observed: assertions against mocked capture Ref / optional service. Live
 * Manager / Desktop wiring covered in their targeted tests. Does not authorize G10.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { G9_LEDGER_PHASE_PAIRS } from "./g9CaptureInput.generated.ts";
import {
  B5_TERMINAL_LOCAL_STREAMS_COMM_IDS,
  G9_B5_NDJSON_HANDOFF,
  G9_B5_T3_TRACE_HANDOFF,
  buildDesktopMessageDecodedCaptureInput,
  buildMonitorEventDecodedCaptureInput,
  buildMonitorSpawnCaptureInput,
  buildMonitorStdinWriteCaptureInput,
  buildNdjsonExportCaptureInput,
  buildT3TracePersistedBatchCaptureInput,
  buildTermCaptureInput,
  captureDesktopMessageDecoded,
  captureMonitorEventDecoded,
  captureMonitorSpawnSucceeded,
  captureMonitorStdinWriteSucceeded,
  captureNdjsonExportSucceeded,
  captureT3TracePersistedBatchSucceeded,
  captureTermPhase,
  captureTerminalLocalStreamsOccurrence,
  withOptionalG9Capture,
  type G9B5CaptureOccurrenceInput,
  type G9B5TermPhase,
} from "./g9FamilyTerminalLocalStreams.ts";
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

const TERM_PHASES: readonly G9B5TermPhase[] = [
  "pty-spawn-succeeded",
  "pty-exit-succeeded",
  "pty-input-write-succeeded",
  "pty-output-callback-emitted",
  "terminal-session-callback-emitted",
  "terminal-metadata-callback-emitted",
];

describe("g9FamilyTerminalLocalStreams (WP5 B5)", () => {
  it("B5 comm_id set is five ledger rows with twelve phases", () => {
    assert.equal(B5_TERMINAL_LOCAL_STREAMS_COMM_IDS.length, 5);
    const b5Set = new Set<string>(B5_TERMINAL_LOCAL_STREAMS_COMM_IDS);
    const phases = G9_LEDGER_PHASE_PAIRS.filter((p) => b5Set.has(p.comm_id));
    assert.equal(phases.length, 12);
    assert.equal(phases.filter((p) => p.comm_id === "INV-T2-TERM").length, 6);
    assert.equal(phases.filter((p) => p.comm_id === "INV-T2-RES-MONITOR").length, 3);
    assert.equal(phases.filter((p) => p.comm_id === "INV-T2-TEL-DESKTOP-IN").length, 1);
    assert.equal(phases.filter((p) => p.comm_id === "INV-T2-TEL-NDJSON").length, 1);
    assert.equal(phases.filter((p) => p.comm_id === "INV-T2-TEL-T3-TRACE").length, 1);
  });

  it("T3-TRACE handoff notes name WP6 Observability sole lander", () => {
    assert.equal(G9_B5_T3_TRACE_HANDOFF.lander, "WP6-Consumer-Owner");
    assert.equal(
      G9_B5_T3_TRACE_HANDOFF.live_file,
      "apps/server/src/observability/Layers/Observability.ts",
    );
    assert.equal(G9_B5_T3_TRACE_HANDOFF.phases.length, 1);
    assert.equal(G9_B5_T3_TRACE_HANDOFF.phases[0]?.phase, "t3-trace-persisted-batch-succeeded");
    assert.equal(G9_B5_T3_TRACE_HANDOFF.phases[0]?.helper, "captureT3TracePersistedBatchSucceeded");
    assert.deepEqual(G9_B5_T3_TRACE_HANDOFF.phases[0]?.input, { comm_id: "present" });
    assert.equal(
      G9_B5_T3_TRACE_HANDOFF.forbidden_in_w5a.includes(
        "apps/server/src/observability/Layers/Observability.ts commits",
      ),
      true,
    );
  });

  it("NDJSON handoff notes name WP6 T2Observability sole lander", () => {
    assert.equal(G9_B5_NDJSON_HANDOFF.lander, "WP6-Consumer-Owner");
    assert.equal(
      G9_B5_NDJSON_HANDOFF.live_file,
      "apps/server/src/t2Observability/T2Observability.ts",
    );
    assert.equal(G9_B5_NDJSON_HANDOFF.phases[0]?.phase, "ndjson-export-succeeded");
  });

  it("TERM builders emit site-only A for all six phases (no terminal bytes)", () => {
    const expected: Record<G9B5TermPhase, { readonly site: string }> = {
      "pty-spawn-succeeded": { site: "spawned" },
      "pty-exit-succeeded": { site: "exited" },
      "pty-input-write-succeeded": { site: "pty-input-write" },
      "pty-output-callback-emitted": { site: "pty-output-callback" },
      "terminal-session-callback-emitted": { site: "session-callback" },
      "terminal-metadata-callback-emitted": { site: "metadata-callback" },
    };
    for (const phase of TERM_PHASES) {
      const built = buildTermCaptureInput(phase);
      assert.equal(built.comm_id, "INV-T2-TERM");
      assert.equal(built.phase, phase);
      assert.deepEqual(built.input, expected[phase]);
      assert.equal(Object.keys(built.input).length, 1);
      assert.equal("payload" in built.input, false);
      assert.equal("bytes" in built.input, false);
    }
  });

  it.effect("TERM / monitor / desktop / export helpers call captureOccurrence once each", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const capture = (input: G9CaptureOccurrenceInput) =>
        Effect.gen(function* () {
          yield* Ref.update(calls, (xs) => [...xs, input]);
          return stubEnqueued(input);
        });

      yield* captureTermPhase(capture, "pty-spawn-succeeded");
      yield* captureTermPhase(capture, "pty-output-callback-emitted");
      yield* captureMonitorSpawnSucceeded(capture);
      yield* captureMonitorStdinWriteSucceeded(capture, "sampleNow");
      yield* captureMonitorEventDecoded(capture, "snapshot");
      yield* captureDesktopMessageDecoded(capture, "setDiagnosticsDemand");
      yield* captureNdjsonExportSucceeded(capture);
      yield* captureT3TracePersistedBatchSucceeded(capture);

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 8);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-TERM",
        phase: "pty-spawn-succeeded",
        input: { site: "spawned" },
      });
      assert.deepEqual(seen[1], {
        comm_id: "INV-T2-TERM",
        phase: "pty-output-callback-emitted",
        input: { site: "pty-output-callback" },
      });
      assert.deepEqual(seen[2], {
        comm_id: "INV-T2-RES-MONITOR",
        phase: "monitor-spawn-succeeded",
        input: { site: "spawned" },
      });
      assert.deepEqual(seen[3], {
        comm_id: "INV-T2-RES-MONITOR",
        phase: "monitor-stdin-write-succeeded",
        input: { command: "sampleNow" },
      });
      assert.deepEqual(seen[4], {
        comm_id: "INV-T2-RES-MONITOR",
        phase: "monitor-event-decoded",
        input: { event_type: "snapshot" },
      });
      assert.deepEqual(seen[5], {
        comm_id: "INV-T2-TEL-DESKTOP-IN",
        phase: "desktop-message-decoded",
        input: { message_type: "setDiagnosticsDemand" },
      });
      assert.deepEqual(seen[6], {
        comm_id: "INV-T2-TEL-NDJSON",
        phase: "ndjson-export-succeeded",
        input: { comm_id: "present" },
      });
      assert.deepEqual(seen[7], {
        comm_id: "INV-T2-TEL-T3-TRACE",
        phase: "t3-trace-persisted-batch-succeeded",
        input: { comm_id: "present" },
      });

      for (const call of seen) {
        assert.equal(call.comm_id.includes("OTLP"), false);
        const json = JSON.stringify(call.input);
        assert.equal(json.includes("payload"), false);
        assert.equal(json.includes("\\u0000"), false);
      }
    }),
  );

  it.effect("builders + captureTerminalLocalStreamsOccurrence cover the B5 phase set", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const capture = (input: G9CaptureOccurrenceInput) =>
        Effect.gen(function* () {
          yield* Ref.update(calls, (xs) => [...xs, input]);
          return stubEnqueued(input);
        });

      const inputs: G9B5CaptureOccurrenceInput[] = [
        ...TERM_PHASES.map((phase) => buildTermCaptureInput(phase)),
        buildMonitorSpawnCaptureInput(),
        buildMonitorStdinWriteCaptureInput("configure"),
        buildMonitorEventDecodedCaptureInput("hello"),
        buildDesktopMessageDecodedCaptureInput("setHostPowerIntervals"),
        buildNdjsonExportCaptureInput(),
        buildT3TracePersistedBatchCaptureInput(),
      ];

      assert.equal(inputs.length, 12);
      for (const input of inputs) {
        yield* captureTerminalLocalStreamsOccurrence(capture, input);
      }

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 12);
      const b5Set = new Set<string>(B5_TERMINAL_LOCAL_STREAMS_COMM_IDS);
      for (const call of seen) {
        assert.equal(b5Set.has(call.comm_id), true);
      }
    }),
  );

  it.effect("withOptionalG9Capture is a no-op when G9CaptureService is absent", () =>
    Effect.gen(function* () {
      let ran = false;
      yield* withOptionalG9Capture(() =>
        Effect.sync(() => {
          ran = true;
        }),
      );
      assert.equal(ran, false);
    }),
  );

  it.effect("withOptionalG9Capture forwards captureOccurrence when service is present", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      yield* withOptionalG9Capture((capture) =>
        captureTermPhase(capture, "pty-spawn-succeeded"),
      ).pipe(
        Effect.provide(
          Layer.succeed(G9CaptureService, {
            captureOccurrence: (input) =>
              Ref.update(calls, (xs) => [...xs, input]).pipe(Effect.as(stubEnqueued(input))),
          }),
        ),
      );
      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 1);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-TERM",
        phase: "pty-spawn-succeeded",
        input: { site: "spawned" },
      });
    }),
  );
});

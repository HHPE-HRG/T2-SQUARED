/**
 * WP5 B5 terminal-local-streams family helpers (Mode B Wave W5c lander).
 *
 * Intended: project ledger-bounded equality A for B5 rows (TERM, RES-MONITOR,
 * TEL-DESKTOP-IN, TEL-NDJSON, TEL-T3-TRACE), then call only
 * G9CaptureService.captureOccurrence. No FIFO, clock, tracer, meter, enqueue,
 * or publish ownership. No PTY / stream / NDJSON payload bytes in A.
 *
 * Observed: helpers below build G9B5CaptureOccurrenceInput and invoke the
 * live-safe capture channel. W5c sole lander wires Manager.ts (B2 FILE-LOGS /
 * FLAG-TERM-ENV handoff + B5 TERM) and DesktopTelemetryReceiver.ts (B3
 * DESKTOP-CONTROL handoff) via withOptionalG9Capture. Observability T3-TRACE
 * and NDJSON remain WP6 sole-lander handoffs.
 *
 * Does not flip g9toG10Authorized. Does not authorize G10. No Effect patch.
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { G9CaptureService, type G9CaptureServiceShape } from "./g9OrchQueueCapture.ts";
import type { G9CaptureOccurrenceInput, G9CaptureResult } from "./g9Occurrence.ts";

/**
 * Ledger comm_ids owned by bundle B5 (plan § B5). Five rows, twelve phases.
 */
export const B5_TERMINAL_LOCAL_STREAMS_COMM_IDS = [
  "INV-T2-RES-MONITOR",
  "INV-T2-TEL-DESKTOP-IN",
  "INV-T2-TEL-NDJSON",
  "INV-T2-TEL-T3-TRACE",
  "INV-T2-TERM",
] as const;

export type G9B5CommId = (typeof B5_TERMINAL_LOCAL_STREAMS_COMM_IDS)[number];

/** B5-callable capture inputs (all twelve ledger phases for the five rows). */
export type G9B5CaptureOccurrenceInput = Extract<
  G9CaptureOccurrenceInput,
  { readonly comm_id: G9B5CommId }
>;

/** Live-safe capture function (error channel never). */
export type G9B5CaptureFn = G9CaptureServiceShape["captureOccurrence"];

type ExtractB5<C extends G9B5CommId, P extends string> = Extract<
  G9B5CaptureOccurrenceInput,
  { readonly comm_id: C; readonly phase: P }
>;

export type G9B5TermPhase = G9B5CaptureOccurrenceInput extends infer I
  ? I extends { readonly comm_id: "INV-T2-TERM"; readonly phase: infer P }
    ? P
    : never
  : never;

export type G9B5MonitorCommand = ExtractB5<
  "INV-T2-RES-MONITOR",
  "monitor-stdin-write-succeeded"
>["input"]["command"];

export type G9B5MonitorEventType = ExtractB5<
  "INV-T2-RES-MONITOR",
  "monitor-event-decoded"
>["input"]["event_type"];

export type G9B5DesktopMessageType = ExtractB5<
  "INV-T2-TEL-DESKTOP-IN",
  "desktop-message-decoded"
>["input"]["message_type"];

/**
 * Handoff notes for INV-T2-TEL-T3-TRACE → WP6 Observability sole lander.
 *
 * Agent: W5a authors helpers here only. Do not edit Observability.ts in this
 * wave. WP6 integrates capture after local-file tracer batch persist succeeds.
 * Payload / span bodies stay out of A (comm_id present only).
 */
export const G9_B5_T3_TRACE_HANDOFF = {
  lander: "WP6-Consumer-Owner",
  live_file: "apps/server/src/observability/Layers/Observability.ts",
  planning_owner: "WP5-B5",
  rfc: "RFC-014 A",
  phases: [
    {
      comm_id: "INV-T2-TEL-T3-TRACE",
      phase: "t3-trace-persisted-batch-succeeded",
      live_site: "makeLocalFileTracer / batch persist success",
      helper: "captureT3TracePersistedBatchSucceeded",
      input: { comm_id: "present" },
      sensitive_exclusions: ["payload_bytes", "terminal_bytes", "raw_json_bag"],
    },
  ],
  forbidden_in_w5a: [
    "apps/server/src/observability/Layers/Observability.ts commits",
    "apps/server/src/t2Observability/T2Observability.ts commits",
    "apps/server/src/terminal/Manager.ts commits (W5c integrator)",
    "OTLP post-success capture (INV-T2-TEL-T3-OTLP / INV-T2-TEL-T2-OTLP)",
    "PTY / stream byte retention in equality A",
  ],
} as const;

/**
 * Handoff notes for INV-T2-TEL-NDJSON → WP6 T2Observability sole lander.
 *
 * Agent: same wave ownership as T3-TRACE (RFC-005 A). Helpers authored here;
 * WP6 lands the live call after NDJSON export succeeds.
 */
export const G9_B5_NDJSON_HANDOFF = {
  lander: "WP6-Consumer-Owner",
  live_file: "apps/server/src/t2Observability/T2Observability.ts",
  planning_owner: "WP5-B5",
  rfc: "RFC-005 A",
  phases: [
    {
      comm_id: "INV-T2-TEL-NDJSON",
      phase: "ndjson-export-succeeded",
      live_site: "T2NdjsonSpanExporter export success",
      helper: "captureNdjsonExportSucceeded",
      input: { comm_id: "present" },
      sensitive_exclusions: ["payload_bytes", "raw_json_bag"],
    },
  ],
  forbidden_in_w5a: [
    "apps/server/src/t2Observability/T2Observability.ts commits",
    "OTLP post-success capture on the same file (WP6 full-row)",
  ],
} as const;

/**
 * Sole B5 capture path. Projects already-bounded input into live-safe capture.
 *
 * Parameters
 * ----------
 * capture : G9B5CaptureFn
 *     Live-safe captureOccurrence (never-failing error channel).
 * input : G9B5CaptureOccurrenceInput
 *     Ledger (comm_id, phase, input) for a B5 phase.
 *
 * Returns
 * -------
 * Effect&lt;void, never&gt;
 *     Discards capture result; live caller stays void.
 */
export const captureTerminalLocalStreamsOccurrence = (
  capture: G9B5CaptureFn,
  input: G9B5CaptureOccurrenceInput,
): Effect.Effect<void, never> => capture(input).pipe(Effect.asVoid);

/**
 * Optional G9CaptureService gate for W5c live landers (Manager / Desktop).
 *
 * Agent: Effect.serviceOption(G9CaptureService). Absent ⇒ Effect.void (live
 * path unchanged). Present ⇒ `run` receives captureOccurrence only — family
 * helpers own bounded A; never put payload / paths / env keys in A here.
 *
 * Parameters
 * ----------
 * run : (capture: G9B5CaptureFn) => Effect&lt;void, never&gt;
 *     Family helper call (B2 / B3 / B5 capture wrappers share this fn shape).
 */
export const withOptionalG9Capture = (
  run: (capture: G9B5CaptureFn) => Effect.Effect<void, never>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const capture = yield* Effect.serviceOption(G9CaptureService);
    if (Option.isNone(capture)) {
      return;
    }
    yield* run((input) => capture.value.captureOccurrence(input));
  });

/**
 * Build INV-T2-TERM capture input. Site literals are ledger A only — never
 * terminal bytes, command strings, cwd, terminalId, or env.
 */
export const buildTermCaptureInput = (
  phase: G9B5TermPhase,
): Extract<G9B5CaptureOccurrenceInput, { readonly comm_id: "INV-T2-TERM" }> => {
  switch (phase) {
    case "pty-spawn-succeeded":
      return {
        comm_id: "INV-T2-TERM",
        phase: "pty-spawn-succeeded",
        input: { site: "spawned" },
      };
    case "pty-exit-succeeded":
      return {
        comm_id: "INV-T2-TERM",
        phase: "pty-exit-succeeded",
        input: { site: "exited" },
      };
    case "pty-input-write-succeeded":
      return {
        comm_id: "INV-T2-TERM",
        phase: "pty-input-write-succeeded",
        input: { site: "pty-input-write" },
      };
    case "pty-output-callback-emitted":
      return {
        comm_id: "INV-T2-TERM",
        phase: "pty-output-callback-emitted",
        input: { site: "pty-output-callback" },
      };
    case "terminal-session-callback-emitted":
      return {
        comm_id: "INV-T2-TERM",
        phase: "terminal-session-callback-emitted",
        input: { site: "session-callback" },
      };
    case "terminal-metadata-callback-emitted":
      return {
        comm_id: "INV-T2-TERM",
        phase: "terminal-metadata-callback-emitted",
        input: { site: "metadata-callback" },
      };
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
};

/** Build INV-T2-RES-MONITOR monitor-spawn-succeeded (site only). */
export const buildMonitorSpawnCaptureInput = (): ExtractB5<
  "INV-T2-RES-MONITOR",
  "monitor-spawn-succeeded"
> => ({
  comm_id: "INV-T2-RES-MONITOR",
  phase: "monitor-spawn-succeeded",
  input: { site: "spawned" },
});

/** Build INV-T2-RES-MONITOR stdin write success (command type only; no args). */
export const buildMonitorStdinWriteCaptureInput = (
  command: G9B5MonitorCommand,
): ExtractB5<"INV-T2-RES-MONITOR", "monitor-stdin-write-succeeded"> => ({
  comm_id: "INV-T2-RES-MONITOR",
  phase: "monitor-stdin-write-succeeded",
  input: { command },
});

/** Build INV-T2-RES-MONITOR decoded stream element (event_type only). */
export const buildMonitorEventDecodedCaptureInput = (
  event_type: G9B5MonitorEventType,
): ExtractB5<"INV-T2-RES-MONITOR", "monitor-event-decoded"> => ({
  comm_id: "INV-T2-RES-MONITOR",
  phase: "monitor-event-decoded",
  input: { event_type },
});

/** Build INV-T2-TEL-DESKTOP-IN decoded inbound message (message_type only). */
export const buildDesktopMessageDecodedCaptureInput = (
  message_type: G9B5DesktopMessageType,
): ExtractB5<"INV-T2-TEL-DESKTOP-IN", "desktop-message-decoded"> => ({
  comm_id: "INV-T2-TEL-DESKTOP-IN",
  phase: "desktop-message-decoded",
  input: { message_type },
});

/** Build INV-T2-TEL-NDJSON export success (presence only; no NDJSON body). */
export const buildNdjsonExportCaptureInput = (): ExtractB5<
  "INV-T2-TEL-NDJSON",
  "ndjson-export-succeeded"
> => ({
  comm_id: "INV-T2-TEL-NDJSON",
  phase: "ndjson-export-succeeded",
  input: { comm_id: "present" },
});

/** Build INV-T2-TEL-T3-TRACE batch persist success (presence only; no spans). */
export const buildT3TracePersistedBatchCaptureInput = (): ExtractB5<
  "INV-T2-TEL-T3-TRACE",
  "t3-trace-persisted-batch-succeeded"
> => ({
  comm_id: "INV-T2-TEL-T3-TRACE",
  phase: "t3-trace-persisted-batch-succeeded",
  input: { comm_id: "present" },
});

/** Convenience: TERM phase → one captureOccurrence (W5c Manager.ts lander). */
export const captureTermPhase = (
  capture: G9B5CaptureFn,
  phase: G9B5TermPhase,
): Effect.Effect<void, never> =>
  captureTerminalLocalStreamsOccurrence(capture, buildTermCaptureInput(phase));

/** Convenience: monitor spawn → one captureOccurrence. */
export const captureMonitorSpawnSucceeded = (capture: G9B5CaptureFn): Effect.Effect<void, never> =>
  captureTerminalLocalStreamsOccurrence(capture, buildMonitorSpawnCaptureInput());

/** Convenience: monitor stdin command → one captureOccurrence. */
export const captureMonitorStdinWriteSucceeded = (
  capture: G9B5CaptureFn,
  command: G9B5MonitorCommand,
): Effect.Effect<void, never> =>
  captureTerminalLocalStreamsOccurrence(capture, buildMonitorStdinWriteCaptureInput(command));

/** Convenience: monitor stream element → one captureOccurrence. */
export const captureMonitorEventDecoded = (
  capture: G9B5CaptureFn,
  event_type: G9B5MonitorEventType,
): Effect.Effect<void, never> =>
  captureTerminalLocalStreamsOccurrence(capture, buildMonitorEventDecodedCaptureInput(event_type));

/** Convenience: desktop inbound decode → one captureOccurrence. */
export const captureDesktopMessageDecoded = (
  capture: G9B5CaptureFn,
  message_type: G9B5DesktopMessageType,
): Effect.Effect<void, never> =>
  captureTerminalLocalStreamsOccurrence(
    capture,
    buildDesktopMessageDecodedCaptureInput(message_type),
  );

/**
 * NDJSON export handoff helper for WP6 T2Observability lander.
 * Call only after NDJSON export succeeds; never pass export body into A.
 */
export const captureNdjsonExportSucceeded = (capture: G9B5CaptureFn): Effect.Effect<void, never> =>
  captureTerminalLocalStreamsOccurrence(capture, buildNdjsonExportCaptureInput());

/**
 * T3-TRACE batch persist handoff helper for WP6 Observability lander.
 * Call only after local-file tracer batch persist succeeds; never pass spans.
 */
export const captureT3TracePersistedBatchSucceeded = (
  capture: G9B5CaptureFn,
): Effect.Effect<void, never> =>
  captureTerminalLocalStreamsOccurrence(capture, buildT3TracePersistedBatchCaptureInput());

/** Re-export capture result for B5 tests that stub enqueued outcomes. */
export type G9B5CaptureResult = G9CaptureResult;

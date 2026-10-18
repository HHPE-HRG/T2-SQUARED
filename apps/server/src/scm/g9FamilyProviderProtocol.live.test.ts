/**
 * WP5 B4 W5c live-helper tests.
 *
 * Intended: captureWhenG9Present / withHttp* / protocol tryCapture helpers
 * prove absent-service noninterference and one success capture per major surface.
 * Observed: mocked G9CaptureService Ref; no McpHttpServer / ws / Manager edits.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import {
  captureAcpRuntimeSpawn,
  captureCodexProtocolRequestIfKnown,
  captureHttpStaticSelected,
  captureOpenCodeProtocolRequestIfKnown,
  captureProviderClaudePhase,
  captureProviderCodexRuntime,
  captureProviderEventPublishedIfKnown,
  captureProviderListEventsPublished,
  captureProviderPermPhase,
  captureProviderTurnPhase,
  captureWhenG9Present,
  withHttpAuthCapture,
  withHttpMetaCapture,
} from "./g9FamilyProviderProtocol.ts";
import { G9CaptureService } from "./g9OrchQueueCapture.ts";
import type { G9CaptureOccurrenceInput, G9CaptureResult, G9EqualityA } from "./g9Occurrence.ts";

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

const captureLayer = (calls: Ref.Ref<G9CaptureOccurrenceInput[]>) =>
  Layer.succeed(G9CaptureService, {
    captureOccurrence: (input) =>
      Effect.gen(function* () {
        yield* Ref.update(calls, (xs) => [...xs, input]);
        return stubEnqueued(input);
      }),
  });

describe("g9FamilyProviderProtocol live helpers (W5c B4)", () => {
  it.effect("absent G9CaptureService: withHttp* and tryCapture are no-ops", () =>
    Effect.gen(function* () {
      const value = yield* withHttpMetaCapture(Effect.succeed("ok"));
      assert.equal(value, "ok");
      yield* captureProviderTurnPhase("send-turn-admitted");
      yield* captureCodexProtocolRequestIfKnown("turn/start");
      yield* captureWhenG9Present(() => Effect.die("must-not-run"));
    }),
  );

  it.effect("present service: major surface groups each enqueue once", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const layer = captureLayer(calls);

      yield* Effect.gen(function* () {
        yield* withHttpAuthCapture("session", Effect.succeed({ ok: true }));
        yield* withHttpMetaCapture(Effect.succeed("meta"));
        yield* captureHttpStaticSelected("static-file-200-selected");
        yield* captureProviderTurnPhase("send-turn-admitted");
        yield* captureProviderTurnPhase("send-turn-succeeded");
        yield* captureProviderPermPhase("permission-request-admitted");
        yield* captureProviderListEventsPublished();
        yield* captureProviderEventPublishedIfKnown("turn.started");
        yield* captureProviderCodexRuntime("runtime-spawn-succeeded");
        yield* captureCodexProtocolRequestIfKnown("turn/start");
        yield* captureProviderClaudePhase("cli-version-probe-succeeded");
        yield* captureAcpRuntimeSpawn("INV-T2-PROVIDER-CURSOR");
        yield* captureOpenCodeProtocolRequestIfKnown("session.create");
      }).pipe(Effect.provide(layer));

      const seen = yield* Ref.get(calls);
      const byComm = new Map<string, number>();
      for (const call of seen) {
        byComm.set(call.comm_id, (byComm.get(call.comm_id) ?? 0) + 1);
      }
      assert.ok((byComm.get("INV-T2-HTTP-AUTH") ?? 0) >= 2);
      assert.ok((byComm.get("INV-T2-HTTP-META") ?? 0) >= 2);
      assert.ok((byComm.get("INV-T2-HTTP-STATIC") ?? 0) >= 1);
      assert.ok((byComm.get("INV-T2-PROVIDER-TURN") ?? 0) >= 2);
      assert.ok((byComm.get("INV-T2-PROVIDER-PERM") ?? 0) >= 1);
      assert.ok((byComm.get("INV-T2-PROVIDER-LIST-EVENTS") ?? 0) >= 1);
      assert.ok((byComm.get("INV-T2-PROVIDER-EVENTS") ?? 0) >= 1);
      assert.ok((byComm.get("INV-T2-PROVIDER-CODEX") ?? 0) >= 2);
      assert.ok((byComm.get("INV-T2-PROVIDER-CLAUDE") ?? 0) >= 1);
      assert.ok((byComm.get("INV-T2-PROVIDER-CURSOR") ?? 0) >= 1);
      assert.ok((byComm.get("INV-T2-PROVIDER-OPENCODE") ?? 0) >= 1);
      assert.equal(
        seen.some((c) => c.phase === "mcp-http-session-deleted"),
        false,
      );
    }),
  );

  it.effect("unknown protocol labels do not capture", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      yield* captureCodexProtocolRequestIfKnown("not-a-real-method").pipe(
        Effect.provide(captureLayer(calls)),
      );
      assert.equal((yield* Ref.get(calls)).length, 0);
    }),
  );
});

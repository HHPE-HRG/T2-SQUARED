/**
 * WP6 consumer tests for McpHttpServer G9 landings (session hooks + B4 phases).
 *
 * Intended: G9McpHttpSessionHooksLayer captures site-only A on DELETE 204;
 * B4 helpers project site-only A; absent G9CaptureService ⇒ no capture.
 * Observed: mock capture Ref + family helpers. Does not flip gates.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as McpServer from "effect/unstable/ai/McpServer";

import {
  G9McpHttpSessionHooksLayer,
  captureMcpHttpHandlerSucceeded,
  captureMcpHttpMessageAdmitted,
  withOptionalG9Capture,
} from "../scm/g9FamilyTypedHooks.ts";
import { G9CaptureService } from "../scm/g9OrchQueueCapture.ts";
import type {
  G9CaptureOccurrenceInput,
  G9CaptureResult,
  G9EqualityA,
} from "../scm/g9Occurrence.ts";

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

const mockCaptureLayer = (calls: Ref.Ref<G9CaptureOccurrenceInput[]>) =>
  Layer.succeed(G9CaptureService, {
    captureOccurrence: (input) =>
      Ref.update(calls, (xs) => [...xs, input]).pipe(Effect.as(stubEnqueued(input))),
  });

describe("McpHttpServer G9 consumer (WP6)", () => {
  it.effect("absent G9CaptureService: B4 MCP helpers are no-ops", () =>
    Effect.gen(function* () {
      yield* withOptionalG9Capture((capture) => captureMcpHttpMessageAdmitted(capture));
      yield* withOptionalG9Capture((capture) => captureMcpHttpHandlerSucceeded(capture));
    }),
  );

  it.effect("present capture: B4 message-admitted + handler-succeeded are site-only", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const layer = mockCaptureLayer(calls);

      yield* withOptionalG9Capture((capture) => captureMcpHttpMessageAdmitted(capture)).pipe(
        Effect.provide(layer),
      );
      yield* withOptionalG9Capture((capture) => captureMcpHttpHandlerSucceeded(capture)).pipe(
        Effect.provide(layer),
      );

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 2);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-MCP-HTTP",
        phase: "mcp-http-message-admitted",
        input: { site: "mcp-http-message-admitted" },
      });
      assert.deepEqual(seen[1], {
        comm_id: "INV-T2-MCP-HTTP",
        phase: "mcp-http-handler-succeeded",
        input: { site: "mcp-http-handler-succeeded" },
      });
    }),
  );

  it.effect("G9McpHttpSessionHooksLayer captures session-deleted site only", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const env = Layer.merge(G9McpHttpSessionHooksLayer, mockCaptureLayer(calls));
      const hooks = yield* McpServer.HttpSessionHooks.pipe(Effect.provide(env));
      yield* hooks.onExistingSessionDeleted!({ site: "mcp-http-session-deleted" }).pipe(
        Effect.provide(env),
      );
      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 1);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-MCP-HTTP",
        phase: "mcp-http-session-deleted",
        input: { site: "mcp-http-session-deleted" },
      });
    }),
  );
});

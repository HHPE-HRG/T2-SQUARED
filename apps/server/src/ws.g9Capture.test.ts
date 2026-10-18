/**
 * WP6 consumer tests for ws.ts G9 landings (ORCH-LIVE + Rpc hooks layer).
 *
 * Intended: offerOrchLiveBuffer captures kind-only A after true offer; false
 * offer ⇒ zero calls; absent G9CaptureService ⇒ live offer still succeeds.
 * Observed: mock G9CaptureService Ref. Does not flip gates. No Effect patch.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as RpcServer from "effect/unstable/rpc/RpcServer";

import { G9RpcServerRequestHooksLayer } from "./scm/g9FamilyTypedHooks.ts";
import { G9CaptureService } from "./scm/g9OrchQueueCapture.ts";
import type { G9CaptureOccurrenceInput, G9CaptureResult, G9EqualityA } from "./scm/g9Occurrence.ts";
import { offerOrchLiveBuffer } from "./ws.ts";

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

describe("ws.ts G9 consumer (WP6)", () => {
  it.effect("absent G9CaptureService: offer still succeeds with zero capture calls", () =>
    Effect.gen(function* () {
      const liveBuffer = yield* Queue.unbounded<{ readonly kind: "synchronized" }>();
      const accepted = yield* offerOrchLiveBuffer(liveBuffer, { kind: "synchronized" });
      assert.equal(accepted, true);
      const drained = yield* Queue.takeAll(liveBuffer);
      assert.equal(drained.length, 1);
    }),
  );

  it.effect("present G9CaptureService: true offer captures kind-only ORCH-LIVE A", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const liveBuffer = yield* Queue.unbounded<
        | { readonly kind: "event"; readonly event: { readonly seq: number } }
        | { readonly kind: "synchronized" }
      >();

      yield* offerOrchLiveBuffer(liveBuffer, {
        kind: "event",
        event: { seq: 99 },
      }).pipe(Effect.provide(mockCaptureLayer(calls)));
      yield* offerOrchLiveBuffer(liveBuffer, { kind: "synchronized" }).pipe(
        Effect.provide(mockCaptureLayer(calls)),
      );

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 2);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-ORCH-LIVE",
        phase: "live-buffer-offered",
        input: { kind: "event" },
      });
      assert.deepEqual(seen[1], {
        comm_id: "INV-T2-ORCH-LIVE",
        phase: "live-buffer-offered",
        input: { kind: "synchronized" },
      });
      // Agent: event payload must never enter equality A.
      assert.deepEqual(Object.keys(seen[0]!.input), ["kind"]);
    }),
  );

  it.effect("G9RpcServerRequestHooksLayer is providable for RpcServer stack", () =>
    Effect.gen(function* () {
      const hooks = yield* RpcServer.RpcServerRequestHooks.pipe(
        Effect.provide(G9RpcServerRequestHooksLayer),
      );
      assert.ok(hooks.onRequestAdmitted);
      assert.ok(hooks.onUnarySucceeded);
      assert.ok(hooks.onStreamElement);
    }),
  );
});

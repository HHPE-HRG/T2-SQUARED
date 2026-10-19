/**
 * Server lifecycle event pub/sub (welcome/ready stream).
 *
 * G10 S1: INV-T2-LIFECYCLE-EVENTS admit/route/replace via g10SeamBridge at
 * PubSub.publish. Absent G10S1 controller / not replaced ⇒ live publish only.
 * Agent: SETTINGS handoff is S2 — do not wire settings here.
 */
import type { ServerLifecycleStreamEvent } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { publishLifecycleEventsViaG10Bridge } from "./scm/g10SliceS1.ts";

type LifecycleEventInput =
  | Omit<Extract<ServerLifecycleStreamEvent, { type: "welcome" }>, "sequence">
  | Omit<Extract<ServerLifecycleStreamEvent, { type: "ready" }>, "sequence">;

interface SnapshotState {
  readonly sequence: number;
  readonly events: ReadonlyArray<ServerLifecycleStreamEvent>;
}

export class ServerLifecycleEvents extends Context.Service<
  ServerLifecycleEvents,
  {
    readonly publish: (event: LifecycleEventInput) => Effect.Effect<ServerLifecycleStreamEvent>;
    readonly snapshot: Effect.Effect<SnapshotState>;
    readonly stream: Stream.Stream<ServerLifecycleStreamEvent>;
  }
>()("t3/serverLifecycleEvents") {}

const make = Effect.gen(function* () {
  const pubsub = yield* PubSub.unbounded<ServerLifecycleStreamEvent>();
  const state = yield* Ref.make<SnapshotState>({
    sequence: 0,
    events: [],
  });

  return {
    publish: (event) =>
      Ref.modify(state, (current) => {
        const nextSequence = current.sequence + 1;
        const nextEvent = {
          ...event,
          sequence: nextSequence,
        } satisfies ServerLifecycleStreamEvent;
        const nextEvents =
          nextEvent.type === "welcome"
            ? [nextEvent, ...current.events.filter((entry) => entry.type !== "welcome")]
            : [nextEvent, ...current.events.filter((entry) => entry.type !== "ready")];
        return [nextEvent, { sequence: nextSequence, events: nextEvents }] as const;
      }).pipe(
        Effect.flatMap((nextEvent) =>
          // G10 S1: bridge selects live vs manifold; PubSub I/O stays the carrier.
          publishLifecycleEventsViaG10Bridge(
            PubSub.publish(pubsub, nextEvent).pipe(Effect.as(true)),
          ).pipe(Effect.as(nextEvent)),
        ),
      ),
    snapshot: Ref.get(state),
    get stream() {
      return Stream.fromPubSub(pubsub);
    },
  } satisfies ServerLifecycleEvents["Service"];
});

export const layer = Layer.effect(ServerLifecycleEvents, make);

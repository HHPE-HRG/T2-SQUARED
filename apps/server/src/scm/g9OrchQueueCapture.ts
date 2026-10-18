/**
 * G9 ORCH-QUEUE offer-boundary capture helper + live-safe service (Task 11).
 *
 * Intended: classify offered OrchestrationCommand as client|internal via
 * Schema.is(DispatchableClientOrchestrationCommand); capture only when
 * Queue.offer accepted; G9CaptureService error channel is never (Effect.exit →
 * latch → succeed(undefined)). Die → capture-defect (never reuse preflight).
 * Interruption-only does not latch. Missing package row after fail → placement
 * with {comm_id} only (never fabricate 404/authority identities).
 *
 * Observed: see captureIfOfferAccepted / G9LiveSafeCaptureLayer below.
 * Engine wires optional serviceOption after offer (RFC-023: Engine = Slice only).
 * Task 14: ORCH-QUEUE helper only; types widen via G9CaptureOccurrenceInput import.
 * Live-safe layer keeps package-keyed fault context (RFC-018/019).
 * Does not inject G9RosterCoordinator into OrchestrationEngine. Does not authorize G10.
 */
import {
  DispatchableClientOrchestrationCommand,
  type OrchestrationCommand,
} from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import type { G9RosterCoordinator } from "./g9Coordinator.ts";
import type { G9FaultController } from "./g9Fault.ts";
import {
  G9InvariantFault,
  type G9CaptureOccurrenceInput,
  type G9CaptureResult,
  type G9WakerState,
} from "./g9Occurrence.ts";
import type { G9Package } from "./g9Package.ts";

/**
 * Map an offered orchestration command to public equality A.command_type.
 *
 * Parameters
 * ----------
 * command : OrchestrationCommand
 *     Command already accepted by dispatch (post-normalization shape).
 *
 * Returns
 * -------
 * "client" | "internal"
 *     client iff Schema.is(DispatchableClientOrchestrationCommand).
 */
export const commandTypeOf = (command: OrchestrationCommand): "client" | "internal" =>
  Schema.is(DispatchableClientOrchestrationCommand)(command) ? "client" : "internal";

/**
 * Capture ORCH-QUEUE queue-offered only when the live Queue.offer accepted.
 *
 * Intended: false offer → no capture call; true → one capture with command_type.
 * Observed: capture error channel never; caller always gets void.
 *
 * Parameters
 * ----------
 * accepted : boolean
 *     Queue.offer result (false only on dropping/full test queues).
 * command : OrchestrationCommand
 *     Offered command for command_type projection.
 * capture : (input) => Effect&lt;G9CaptureResult | undefined, never&gt;
 *     Live-safe capture (G9CaptureService.captureOccurrence).
 */
export const captureIfOfferAccepted = (
  accepted: boolean,
  command: OrchestrationCommand,
  capture: (input: G9CaptureOccurrenceInput) => Effect.Effect<G9CaptureResult | undefined, never>,
): Effect.Effect<void, never> => {
  if (!accepted) return Effect.void;
  const input: G9CaptureOccurrenceInput = {
    comm_id: "INV-T2-ORCH-QUEUE",
    phase: "queue-offered",
    input: { command_type: commandTypeOf(command) },
  };
  return capture(input).pipe(Effect.asVoid);
};

/** Live-safe capture service shape (error channel never). */
export interface G9CaptureServiceShape {
  readonly captureOccurrence: (
    input: G9CaptureOccurrenceInput,
  ) => Effect.Effect<G9CaptureResult | undefined, never>;
}

/**
 * Optional DI key for Engine.dispatch slice hook.
 * Absent service ⇒ production dispatch unchanged (noninterference).
 */
export class G9CaptureService extends Context.Service<G9CaptureService, G9CaptureServiceShape>()(
  "t3/scm/g9OrchQueueCapture/G9CaptureService",
) {}

/**
 * Isolate coordinator capture failures/defects so live dispatch cannot Fail.
 *
 * Agent: cause-level isolation (RFC-016/018). Typed G9InvariantFault alone is
 * not enough — Die must become capture-defect, never preflight.
 *
 * Parameters
 * ----------
 * coordinator : G9RosterCoordinator
 *     Owns captureOccurrence (typed Fail&lt;G9InvariantFault&gt;).
 * faults : G9FaultController
 *     First-fault latch + sandboxed sink.deliver.
 * pkg : G9Package
 *     Row lookup for identity attrs (omit when row absent).
 * waker : { state: () => G9WakerState }
 *     Latch context waker_state only.
 *
 * Returns
 * -------
 * Layer.Layer&lt;G9CaptureService&gt;
 *     Provides never-failing captureOccurrence.
 */
export const G9LiveSafeCaptureLayer = (
  coordinator: G9RosterCoordinator,
  faults: G9FaultController,
  pkg: G9Package,
  waker: { readonly state: () => G9WakerState },
): Layer.Layer<G9CaptureService> =>
  Layer.succeed(G9CaptureService, {
    captureOccurrence: (input) =>
      coordinator.captureOccurrence(input).pipe(
        Effect.exit,
        Effect.flatMap((exit) => {
          if (Exit.isSuccess(exit)) return Effect.succeed(exit.value);
          // Effect v4: hasInterruptsOnly (plan name isInterruptedOnly).
          if (Cause.hasInterruptsOnly(exit.cause)) {
            // Interruption is not a G9 invariant. Do not latch / do not disarm waker.
            return Effect.interrupt;
          }
          // Effect v4: findErrorOption (plan name failureOption).
          const typed = Cause.findErrorOption(exit.cause);
          const fault = Option.isSome(typed)
            ? typed.value
            : new G9InvariantFault("capture-defect", "G9 capture defect isolated at live boundary");
          const row = pkg.rowsByCommId.get(input.comm_id);
          const resolvedFault =
            row === undefined && fault.code !== "placement"
              ? new G9InvariantFault("placement", "capture input has no package row")
              : fault;
          const ctx =
            row === undefined
              ? { scope: "capture" as const, comm_id: input.comm_id, waker_state: waker.state() }
              : {
                  scope: "capture" as const,
                  comm_id: input.comm_id,
                  node_id: row.node_id,
                  bus_id: row.origin_bus_id,
                  waker_state: waker.state(),
                };
          // Live caller never fails. Task 7 latch sandboxes sink.deliver and emits a metadata-only
          // observation if deliver dies (design Faults #9 - no silent swallow without evidence).
          // Effect v4: as(undefined) replaces plan zipRight(succeed(undefined)).
          return faults.latch(resolvedFault, ctx).pipe(Effect.as(undefined));
        }),
      ),
  });

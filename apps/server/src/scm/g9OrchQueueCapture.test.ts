// @effect-diagnostics nodeBuiltinImport:off
/**
 * G9 ORCH-QUEUE capture helper + live-safe Layer tests (Task 11).
 *
 * Intended: dropping(1) false offer → 0 capture calls; true offer → 1 call with
 * command_type only; placement Fail and Die both latch once without failing the
 * dispatch stub; Die uses capture-defect (not preflight); no reserved-identity
 * attrs on defect latch. Observed: assertions below.
 *
 * Does not authorize G10. Does not edit Engine production Queue constructor.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  EventId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  type OrchestrationCommand,
} from "@t3tools/contracts";
import { assert, describe, it } from "@effect/vitest";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";

import { T2Observability, layerTest } from "../t2Observability/T2Observability.ts";
import type { G9RosterCoordinator } from "./g9Coordinator.ts";
import { G9FaultController } from "./g9Fault.ts";
import {
  G9CaptureService,
  G9LiveSafeCaptureLayer,
  captureIfOfferAccepted,
  commandTypeOf,
} from "./g9OrchQueueCapture.ts";
import {
  G9InvariantFault,
  type G9CaptureOccurrenceInput,
  type G9CaptureResult,
  type G9FaultSink,
  type G9Occurrence,
} from "./g9Occurrence.ts";
import { makeG9Observation } from "./g9Observation.ts";
import { loadG9Package } from "./g9Package.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const makeOtelFilePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "t2-scm-g9-orch-cap-")), "t2.trace.ndjson");

const clientCmd = (): OrchestrationCommand => ({
  type: "thread.create",
  commandId: CommandId.make("cmd-g9-client"),
  threadId: ThreadId.make("thread-g9-client"),
  projectId: ProjectId.make("project-g9"),
  title: "G9 Client",
  modelSelection: {
    instanceId: ProviderInstanceId.make("codex"),
    model: "gpt-5-codex",
  },
  interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
  runtimeMode: "full-access",
  branch: null,
  worktreePath: null,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const internalCmd = (): OrchestrationCommand => ({
  type: "thread.activity.append",
  commandId: CommandId.make("cmd-g9-internal"),
  threadId: ThreadId.make("thread-g9-internal"),
  activity: {
    id: EventId.make("activity-g9"),
    tone: "info",
    kind: "test",
    summary: "internal",
    payload: null,
    turnId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
});

const stubEnqueued = (): G9CaptureResult => {
  const occurrence: G9Occurrence = {
    comm_id: "INV-T2-ORCH-QUEUE",
    phase_id: "queue-offered",
    node_id: "node.orchestration",
    origin_bus_id: "bus.control",
    attempt_sequence: 0,
    equality_A: { command_type: "client" },
    semanticKind: "request",
    request_label: "client",
    state_label: "",
    retainCurrentAfterPublish: false,
  };
  return { status: "enqueued", occurrence };
};

describe("g9OrchQueueCapture", () => {
  it("commandTypeOf maps client vs internal via DispatchableClientOrchestrationCommand", () => {
    assert.equal(commandTypeOf(clientCmd()), "client");
    assert.equal(commandTypeOf(internalCmd()), "internal");
  });

  it.effect("dropping(1) false offer → capture call count 0; true → 1 with command_type only", () =>
    Effect.gen(function* () {
      const q = yield* Queue.dropping<number>(1);
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);

      const first = yield* Queue.offer(q, 1);
      assert.equal(first, true);
      yield* captureIfOfferAccepted(first, clientCmd(), (input) =>
        Effect.gen(function* () {
          yield* Ref.update(calls, (xs) => [...xs, input]);
          return stubEnqueued();
        }),
      );
      assert.equal((yield* Ref.get(calls)).length, 1);
      assert.deepEqual(yield* Ref.get(calls), [
        {
          comm_id: "INV-T2-ORCH-QUEUE",
          phase: "queue-offered",
          input: { command_type: "client" },
        },
      ]);
      // Public A carries only command_type (no envelope keys).
      assert.deepEqual(Object.keys((yield* Ref.get(calls))[0]!.input).sort(), ["command_type"]);

      const second = yield* Queue.offer(q, 2);
      assert.equal(second, false);
      yield* captureIfOfferAccepted(second, internalCmd(), (input) =>
        Effect.gen(function* () {
          yield* Ref.update(calls, (xs) => [...xs, input]);
          return stubEnqueued();
        }),
      );
      assert.equal((yield* Ref.get(calls)).length, 1);
    }),
  );

  it.effect("true offer with internal command projects command_type internal", () =>
    Effect.gen(function* () {
      const seen = yield* Ref.make<string | undefined>(undefined);
      yield* captureIfOfferAccepted(true, internalCmd(), (input) =>
        Effect.gen(function* () {
          // Task 14: input is the full ledger union; ORCH-QUEUE narrows command_type.
          assert.equal(input.comm_id, "INV-T2-ORCH-QUEUE");
          assert.equal(input.phase, "queue-offered");
          if (input.comm_id === "INV-T2-ORCH-QUEUE" && input.phase === "queue-offered") {
            yield* Ref.set(seen, input.input.command_type);
          }
          return stubEnqueued();
        }),
      );
      assert.equal(yield* Ref.get(seen), "internal");
    }),
  );

  it.effect(
    "placement Fail → sink.deliver once; dispatch stub still succeeds; Die → capture-defect",
    () => {
      const exporter = new InMemorySpanExporter();
      const pkg = loadG9Package(repoRoot);
      const observation = makeG9Observation();

      return Effect.gen(function* () {
        const sinkCodes = yield* Ref.make<string[]>([]);
        const sink: G9FaultSink = {
          deliver: (fault) =>
            Effect.gen(function* () {
              yield* Ref.update(sinkCodes, (xs) => [...xs, fault.code]);
            }),
        };
        const faults = new G9FaultController(
          observation,
          sink,
          () => undefined,
          () => undefined,
        );
        const waker = { state: () => "stopped" as const };

        // Placement Fail path.
        const placeCoordinator = {
          captureOccurrence: () => Effect.fail(new G9InvariantFault("placement", "test-placement")),
        } as unknown as G9RosterCoordinator;
        const placeLayer = G9LiveSafeCaptureLayer(placeCoordinator, faults, pkg, waker);

        const placeExit = yield* Effect.gen(function* () {
          const capture = yield* G9CaptureService;
          yield* captureIfOfferAccepted(true, clientCmd(), (input) =>
            capture.captureOccurrence(input),
          );
          return { sequence: 1 };
        }).pipe(Effect.provide(placeLayer), Effect.exit);

        assert.equal(Exit.isSuccess(placeExit), true);
        if (Exit.isSuccess(placeExit)) {
          assert.deepEqual(placeExit.value, { sequence: 1 });
        }
        assert.deepEqual(yield* Ref.get(sinkCodes), ["placement"]);

        // Die / defect path — fresh controller so first-fault latch can fire again.
        const sinkCodes2 = yield* Ref.make<string[]>([]);
        const sink2: G9FaultSink = {
          deliver: (fault) =>
            Effect.gen(function* () {
              yield* Ref.update(sinkCodes2, (xs) => [...xs, fault.code]);
            }),
        };
        const faults2 = new G9FaultController(
          observation,
          sink2,
          () => undefined,
          () => undefined,
        );
        const dieCoordinator = {
          captureOccurrence: () => Effect.die("capture-boom"),
        } as unknown as G9RosterCoordinator;
        const dieLayer = G9LiveSafeCaptureLayer(dieCoordinator, faults2, pkg, waker);

        const dieExit = yield* Effect.gen(function* () {
          const capture = yield* G9CaptureService;
          yield* captureIfOfferAccepted(true, clientCmd(), (input) =>
            capture.captureOccurrence(input),
          );
          return { sequence: 2 };
        }).pipe(Effect.provide(dieLayer), Effect.exit);

        assert.equal(Exit.isSuccess(dieExit), true);
        if (Exit.isSuccess(dieExit)) {
          assert.deepEqual(dieExit.value, { sequence: 2 });
        }
        assert.deepEqual(yield* Ref.get(sinkCodes2), ["capture-defect"]);

        const t2 = yield* T2Observability;
        yield* t2.forceFlush;
        const faultSpans = exporter
          .getFinishedSpans()
          .filter((span) => span.name === "t2.scm.shadow.fault");
        for (const span of faultSpans) {
          const attrs = span.attributes ?? {};
          assert.notEqual(attrs["t2.scm.node_id"], "node.observer.404");
          assert.notEqual(attrs["t2.scm.bus_id"], "bus.scm.authority");
          assert.notEqual(attrs["fault_code"], "preflight");
        }
        const defectSpan = faultSpans.find(
          (span) => span.attributes?.["t2.scm.fault_code"] === "capture-defect",
        );
        assert.ok(defectSpan !== undefined);
        assert.notEqual(defectSpan!.attributes?.["t2.scm.fault_code"], "preflight");
      }).pipe(Effect.provide(layerTest({ exporter, filePath: makeOtelFilePath() })));
    },
  );
});

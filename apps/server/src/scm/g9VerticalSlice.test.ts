// @effect-diagnostics nodeBuiltinImport:off
/**
 * G9 ORCH-QUEUE vertical slice (Task 12).
 *
 * Intended: compose package + store + coordinator + observation + fault + waker;
 * captureIfOfferAccepted(true) → FIFO depth 1; hearAs empty before tick; one
 * waker.tick → bound hearAs sees W1 fundamental_request client|internal;
 * unbound bus undefined; observation attrs have no envelope keys.
 *
 * Observed: assertions below. Not completed G9 — no WP5–WP8, no production
 * timer, no server.ts Layer, no Effect patch. Does not authorize G10.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  type OrchestrationCommand,
} from "@t3tools/contracts";
import { assert, describe, it } from "@effect/vitest";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { T2Observability, layerTest } from "../t2Observability/T2Observability.ts";
import { loadG8FramingParameters, SharedFundamentalClock } from "./g8SharedClock.ts";
import { DipMuteStore } from "./g6DipMute.ts";
import { G9RosterCoordinator } from "./g9Coordinator.ts";
import { G9FaultController } from "./g9Fault.ts";
import { hearAs } from "./g9HearAs.ts";
import {
  G9CaptureService,
  G9LiveSafeCaptureLayer,
  captureIfOfferAccepted,
} from "./g9OrchQueueCapture.ts";
import type { G9FaultSink } from "./g9Occurrence.ts";
import { makeG9Observation } from "./g9Observation.ts";
import { loadG9Package } from "./g9Package.ts";
import { G9Waker } from "./g9Waker.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const ORCH_NODE = "node.orchestration";
const CONTROL_BUS = "bus.control";
const RPC_BUS = "bus.rpc";

const makeOtelFilePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "t2-scm-g9-vslice-")), "t2.trace.ndjson");

const clientCmd = (): OrchestrationCommand => ({
  type: "thread.create",
  commandId: CommandId.make("cmd-g9-vslice-client"),
  threadId: ThreadId.make("thread-g9-vslice"),
  projectId: ProjectId.make("project-g9-vslice"),
  title: "G9 Vertical Slice",
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

/** Envelope / command-body keys that must never appear on G9 observation attrs. */
const ENVELOPE_ATTR_KEYS = [
  "commandId",
  "command_id",
  "type",
  "payload",
  "command_type",
  "title",
  "threadId",
  "projectId",
] as const;

describe("G9 ORCH-QUEUE vertical slice", () => {
  it.effect(
    "capture → fifo → tick → hearAs W1; unbound empty; no envelope observation keys",
    () => {
      const exporter = new InMemorySpanExporter();
      const pkg = loadG9Package(repoRoot);
      const store = new DipMuteStore(pkg.governed);
      const observation = makeG9Observation();
      const sink: G9FaultSink = { deliver: () => Effect.void };

      // Wire shared faults to waker before constructing coordinator (no production timer).
      let waker!: G9Waker;
      const faults = new G9FaultController(
        observation,
        sink,
        () => waker.disarm(),
        () => waker.markFaulted(),
      );
      const framing = loadG8FramingParameters(repoRoot);
      const coordinator = new G9RosterCoordinator(pkg, store, observation, faults, framing);
      const clock = new SharedFundamentalClock(coordinator);
      waker = new G9Waker(
        clock,
        faults,
        observation,
        pkg.parameters.live_process_interval_fundamental_timesteps,
      );

      const captureLayer = G9LiveSafeCaptureLayer(coordinator, faults, pkg, waker);

      return Effect.gen(function* () {
        const capture = yield* G9CaptureService;
        yield* captureIfOfferAccepted(true, clientCmd(), (input) =>
          capture.captureOccurrence(input),
        );

        assert.equal(coordinator.fifo.depth(ORCH_NODE), 1);
        assert.equal(faults.latched(), undefined);

        // Before fundamental advance: bus storage empty → hearAs undefined.
        const before = yield* hearAs(pkg, coordinator, store, {
          receiving_node_id: ORCH_NODE,
          receiving_bus_id: CONTROL_BUS,
          origin_node_id: ORCH_NODE,
        });
        assert.equal(before, undefined);

        waker.arm();
        yield* waker.tick();

        const heard = yield* hearAs(pkg, coordinator, store, {
          receiving_node_id: ORCH_NODE,
          receiving_bus_id: CONTROL_BUS,
          origin_node_id: ORCH_NODE,
        });
        assert.ok(heard !== undefined);
        assert.equal(heard!.node_id, ORCH_NODE);
        assert.equal(heard!.bus_id, CONTROL_BUS);
        assert.ok(
          heard!.fundamental_request === "client" || heard!.fundamental_request === "internal",
        );
        assert.equal(heard!.fundamental_request, "client");
        assert.equal(heard!.fundamental_state, "offered");

        const unbound = yield* hearAs(pkg, coordinator, store, {
          receiving_node_id: ORCH_NODE,
          receiving_bus_id: RPC_BUS,
          origin_node_id: ORCH_NODE,
        });
        assert.equal(unbound, undefined);

        const t2 = yield* T2Observability;
        yield* t2.forceFlush;
        for (const span of exporter.getFinishedSpans()) {
          const attrs = span.attributes ?? {};
          for (const key of ENVELOPE_ATTR_KEYS) {
            assert.equal(attrs[key], undefined, `envelope key ${key} on ${span.name}`);
          }
        }
      }).pipe(
        Effect.provide(
          Layer.mergeAll(captureLayer, layerTest({ exporter, filePath: makeOtelFilePath() })),
        ),
      );
    },
  );
});

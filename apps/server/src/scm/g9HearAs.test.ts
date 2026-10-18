// @effect-diagnostics nodeBuiltinImport:off
/**
 * hearAs binding + mute tests (WP3 / Task 9).
 *
 * Intended: after ORCH-QUEUE commit on control, bound orchestration+control
 * hears; same node on rpc is unbound; other placed node on rpc cannot hear
 * orchestration origin on rpc; invented 404 receiving → undefined; mute-source
 * suppresses; mute-modifiers clears modifiers to length 0.
 * Observed: assertions below with layerTest for T2Observability.
 *
 * Does not authorize G10.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import * as Effect from "effect/Effect";

import { layerTest } from "../t2Observability/T2Observability.ts";
import { checkW1Word } from "./g4Word.ts";
import { loadG8FramingParameters } from "./g8SharedClock.ts";
import { DipMuteStore } from "./g6DipMute.ts";
import { G9RosterCoordinator } from "./g9Coordinator.ts";
import { G9FaultController } from "./g9Fault.ts";
import { hearAs } from "./g9HearAs.ts";
import type { G9FaultSink } from "./g9Occurrence.ts";
import { makeG9Observation } from "./g9Observation.ts";
import { loadG9Package } from "./g9Package.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const ORCH_NODE = "node.orchestration";
const CONTROL_BUS = "bus.control";
const RPC_BUS = "bus.rpc";
const RPC_NODE = "node.rpc";

const makeOtelFilePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "t2-scm-g9-hear-")), "t2.trace.ndjson");

const captureInput = {
  comm_id: "INV-T2-ORCH-QUEUE" as const,
  phase: "queue-offered" as const,
  input: { command_type: "client" as const },
};

const makeHarness = () => {
  const pkg = loadG9Package(repoRoot);
  const store = new DipMuteStore(pkg.governed);
  const observation = makeG9Observation();
  const sink: G9FaultSink = { deliver: () => Effect.void };
  const faults = new G9FaultController(
    observation,
    sink,
    () => undefined,
    () => undefined,
  );
  const framing = loadG8FramingParameters(repoRoot);
  const coordinator = new G9RosterCoordinator(pkg, store, observation, faults, framing);
  return { pkg, store, coordinator };
};

describe("hearAs", () => {
  it.effect("bound control hears ORCH-QUEUE; unbound/cross-bus/404 fail closed; mute paths", () => {
    const exporter = new InMemorySpanExporter();
    const { pkg, store, coordinator } = makeHarness();

    return Effect.gen(function* () {
      const captured = yield* coordinator.captureOccurrence(captureInput);
      assert.equal(captured.status, "enqueued");
      yield* coordinator.advanceFundamentalTimestep();

      // Bound: node.orchestration + bus.control hears origin on control.
      const heard = yield* hearAs(pkg, coordinator, store, {
        receiving_node_id: ORCH_NODE,
        receiving_bus_id: CONTROL_BUS,
        origin_node_id: ORCH_NODE,
      });
      assert.ok(heard !== undefined);
      assert.equal(heard!.node_id, ORCH_NODE);
      assert.equal(heard!.bus_id, CONTROL_BUS);
      assert.equal(heard!.fundamental_request, "client");
      assert.equal(heard!.fundamental_state, "offered");

      // Same node + bus.rpc → unbound (home is control).
      const wrongBus = yield* hearAs(pkg, coordinator, store, {
        receiving_node_id: ORCH_NODE,
        receiving_bus_id: RPC_BUS,
        origin_node_id: ORCH_NODE,
      });
      assert.equal(wrongBus, undefined);

      // Other placed node on rpc cannot hear orchestration origin on rpc
      // (no cross-bus search; rpc storage has no orch word).
      const crossBus = yield* hearAs(pkg, coordinator, store, {
        receiving_node_id: RPC_NODE,
        receiving_bus_id: RPC_BUS,
        origin_node_id: ORCH_NODE,
      });
      assert.equal(crossBus, undefined);

      // Invented 404 receiving → undefined (not placed).
      const reserved = yield* hearAs(pkg, coordinator, store, {
        receiving_node_id: "node.observer.404",
        receiving_bus_id: CONTROL_BUS,
        origin_node_id: ORCH_NODE,
      });
      assert.equal(reserved, undefined);

      // bus.control is A1; node.orchestration is A2 — concrete mute of A2 from A1 is
      // forbidden. Wildcard source on bus.control (A1→A1) is legal and matches orch words.
      const controlClass = pkg.governed.buses.get(CONTROL_BUS)!;

      // mute-source suppresses.
      store.setDip({
        receiving_bus_id: CONTROL_BUS,
        receiving_authority_class: controlClass,
        source_bus_id: CONTROL_BUS,
        source_node_id: "*",
        source_authority_class: controlClass,
        mode: "mute-source",
        steward: "test",
        runtime_mutable: true,
      });
      const muted = yield* hearAs(pkg, coordinator, store, {
        receiving_node_id: ORCH_NODE,
        receiving_bus_id: CONTROL_BUS,
        origin_node_id: ORCH_NODE,
      });
      assert.equal(muted, undefined);

      // mute-modifiers: clear modifiers to []. Switch DIP mode, publish word with mods.
      store.setDip({
        receiving_bus_id: CONTROL_BUS,
        receiving_authority_class: controlClass,
        source_bus_id: CONTROL_BUS,
        source_node_id: "*",
        source_authority_class: controlClass,
        mode: "mute-modifiers",
        steward: "test",
        runtime_mutable: true,
      });

      const bus = coordinator.buses.get(CONTROL_BUS)!;
      const withMods = checkW1Word({
        ...heard!,
        modifiers: ["attn-low"],
      });
      assert.equal(withMods.ok, true);
      if (!withMods.ok) return;
      bus.publish(withMods.word);
      bus.advanceFundamentalTimestep();

      const cleared = yield* hearAs(pkg, coordinator, store, {
        receiving_node_id: ORCH_NODE,
        receiving_bus_id: CONTROL_BUS,
        origin_node_id: ORCH_NODE,
      });
      assert.ok(cleared !== undefined);
      assert.equal(cleared!.modifiers.length, 0);
      assert.deepEqual(bus.read(ORCH_NODE)?.modifiers, ["attn-low"]);
    }).pipe(Effect.provide(layerTest({ exporter, filePath: makeOtelFilePath() })));
  });
});

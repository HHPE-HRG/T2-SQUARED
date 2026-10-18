// @effect-diagnostics nodeBuiltinImport:off
/**
 * G9 package loader tests (WP1 / Task 1).
 *
 * Intended: prove init-time load of runtime-parameters, ten runtime buses,
 * 29 placed nodes, 74-row ledger projection, SHA pins, and ORCH-QUEUE A_field.
 * Observed: assertions below; invalid parameter classes throw plain Error codes.
 *
 * Does not authorize G10. Does not exercise coordinator / FIFO / capture.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";

import { loadG9Package, parseRuntimeParameters } from "./g9Package.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const runtimeParametersPath = join(repoRoot, "docs/scm/g9/runtime-parameters.json");

describe("G9 package loader", () => {
  it("loads runtime parameters, bus/node sets, and ORCH-QUEUE A_field from repo docs", () => {
    const raw = JSON.parse(readFileSync(runtimeParametersPath, "utf8")) as unknown;
    const expected = parseRuntimeParameters(raw);
    const pkg = loadG9Package(repoRoot);

    assert.deepEqual(pkg.parameters, expected);
    assert.equal(pkg.runtimeBusIds.size, 10);
    assert.equal(pkg.placedNodeIds.size, 29);
    assert.equal(pkg.rowsByCommId.size, 74);
    assert.equal(pkg.governed.buses.size, 10);
    assert.equal(pkg.governed.nodes.size, 29);
    assert.equal(pkg.governed.authority_bus_id, "bus.scm.authority");
    assert.equal(pkg.runtimeBusIds.has("bus.scm.authority"), false);
    assert.equal(pkg.placedNodeIds.has("node.scm.authority"), false);
    assert.equal(pkg.placedNodeIds.has("node.observer.404"), false);
    assert.equal(pkg.governed.nodes.has("node.observer.404"), false);
    assert.equal(pkg.governed.buses.has("bus.scm.authority"), false);
    assert.equal(pkg.governed.nodes.has("node.scm.authority"), false);

    const orch = pkg.rowsByCommId.get("INV-T2-ORCH-QUEUE");
    assert.ok(orch !== undefined);
    assert.equal(orch!.node_id, "node.orchestration");
    assert.equal(orch!.origin_bus_id, "bus.control");
    assert.equal(orch!.home_bus_id, "bus.control");
    assert.equal(orch!.phases.length, 1);
    assert.equal(orch!.phases[0]!.phase_id, "queue-offered");
    assert.equal(orch!.phases[0]!.liveToEquality.A_field, "command_type");
    assert.equal(orch!.phases[0]!.semanticKind, "request");
    assert.deepEqual(orch!.phases[0]!.request_label, ["client", "internal"]);
    assert.deepEqual(orch!.phases[0]!.state_label, ["offered"]);
    assert.equal(orch!.phases[0]!.retainCurrentAfterPublish, false);
    assert.equal(orch!.phases[0]!.aggregate_member_or_capture_site_id, "command_type");
    assert.equal(pkg.nodeHomeBus.get("node.orchestration"), "bus.control");
  });

  it("pins ledger header SHAs to recomputed G1B inventory and G3 topology file hashes", () => {
    const pkg = loadG9Package(repoRoot);
    assert.equal(pkg.g1bInventorySha256.length, 64);
    assert.equal(pkg.g3TopologySha256.length, 64);
    assert.match(pkg.g1bInventorySha256, /^[0-9a-f]{64}$/);
    assert.match(pkg.g3TopologySha256, /^[0-9a-f]{64}$/);
  });
});

describe("parseRuntimeParameters", () => {
  const base = {
    schemaVersion: 1,
    fifo_max_occurrences_per_node: 64,
    process_interval_wake_ms: 100,
    live_process_interval_fundamental_timesteps: 1,
  };

  it("accepts schemaVersion 1 with three finite positive integers", () => {
    const parsed = parseRuntimeParameters(base);
    assert.deepEqual(parsed, base);
  });

  it("rejects empty object", () => {
    assert.throws(() => parseRuntimeParameters({}), /g9-runtime-parameters: schemaVersion/);
  });

  it("rejects non-number fifo_max_occurrences_per_node", () => {
    assert.throws(
      () =>
        parseRuntimeParameters({
          ...base,
          fifo_max_occurrences_per_node: "x",
        }),
      /g9-runtime-parameters: fifo_max_occurrences_per_node/,
    );
  });

  it("rejects null process_interval_wake_ms", () => {
    assert.throws(
      () =>
        parseRuntimeParameters({
          ...base,
          process_interval_wake_ms: null,
        }),
      /g9-runtime-parameters: process_interval_wake_ms/,
    );
  });

  it("rejects zero live_process_interval_fundamental_timesteps", () => {
    assert.throws(
      () =>
        parseRuntimeParameters({
          ...base,
          live_process_interval_fundamental_timesteps: 0,
        }),
      /g9-runtime-parameters: live_process_interval_fundamental_timesteps/,
    );
  });

  it("rejects negative fifo_max_occurrences_per_node", () => {
    assert.throws(
      () =>
        parseRuntimeParameters({
          ...base,
          fifo_max_occurrences_per_node: -1,
        }),
      /g9-runtime-parameters: fifo_max_occurrences_per_node/,
    );
  });

  it("rejects non-integer process_interval_wake_ms", () => {
    assert.throws(
      () =>
        parseRuntimeParameters({
          ...base,
          process_interval_wake_ms: 1.5,
        }),
      /g9-runtime-parameters: process_interval_wake_ms/,
    );
  });

  it("rejects schemaVersion other than 1", () => {
    assert.throws(
      () =>
        parseRuntimeParameters({
          ...base,
          schemaVersion: 2,
        }),
      /g9-runtime-parameters: schemaVersion/,
    );
  });

  it("rejects NaN and Infinity integer fields", () => {
    assert.throws(
      () =>
        parseRuntimeParameters({
          ...base,
          fifo_max_occurrences_per_node: Number.NaN,
        }),
      /g9-runtime-parameters: fifo_max_occurrences_per_node/,
    );
    assert.throws(
      () =>
        parseRuntimeParameters({
          ...base,
          process_interval_wake_ms: Number.POSITIVE_INFINITY,
        }),
      /g9-runtime-parameters: process_interval_wake_ms/,
    );
  });
});

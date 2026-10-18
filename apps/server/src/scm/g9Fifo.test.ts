// @effect-diagnostics nodeBuiltinImport:off
/**
 * G9 FIFO admit / sequence / overload tests (WP2 / Task 4).
 *
 * Intended: capacity and sequences from package JSON max; shared sequence across
 * comm_ids on one node; withheld advances sequence; enqueued occurrences frozen;
 * overload-start then overload-recovered after dequeue + successful admit.
 * Observed: assertions below. Capacity literal comes only from loaded JSON.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";

import { G9NodeFifos } from "./g9Fifo.ts";
import type { G9Occurrence, G9OrchQueueEqualityA } from "./g9Occurrence.ts";
import { loadG9Package } from "./g9Package.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const NODE = "node.orchestration";
const BUS = "bus.control";

const buildOcc = (
  attempt_sequence: number,
  overrides: Partial<G9Occurrence> & {
    equality_A?: G9OrchQueueEqualityA;
  } = {},
): G9Occurrence => ({
  comm_id: overrides.comm_id ?? "INV-T2-ORCH-QUEUE",
  phase_id: overrides.phase_id ?? "queue-offered",
  node_id: overrides.node_id ?? NODE,
  origin_bus_id: overrides.origin_bus_id ?? BUS,
  attempt_sequence,
  equality_A: overrides.equality_A ?? { command_type: "client" },
  semanticKind: overrides.semanticKind ?? "request",
  request_label: overrides.request_label ?? "client",
  state_label: overrides.state_label ?? "offered",
  retainCurrentAfterPublish: overrides.retainCurrentAfterPublish ?? false,
});

describe("G9NodeFifos", () => {
  const pkg = loadG9Package(repoRoot);
  const max = pkg.parameters.fifo_max_occurrences_per_node;

  it("loads fifo max from runtime-parameters.json via G9Package", () => {
    assert.equal(typeof max, "number");
    assert.equal(Number.isInteger(max) && max > 0, true);
  });

  it("first success uses attempt_sequence 0 and freezes the occurrence", () => {
    const fifos = new G9NodeFifos(max);
    const out = fifos.admit({
      node_id: NODE,
      bus_id: BUS,
      build: (seq) => buildOcc(seq),
    });
    assert.equal(out.result.status, "enqueued");
    if (out.result.status !== "enqueued") return;
    assert.equal(out.result.occurrence.attempt_sequence, 0);
    assert.equal(Object.isFrozen(out.result.occurrence), true);
    assert.equal(Object.isFrozen(out.result.occurrence.equality_A), true);
    assert.equal(out.overload.kind, "none");
    assert.equal(out.depth, 1);
  });

  it("fills to max, rejects with sequences max and max+1, recovers after dequeue", () => {
    const fifos = new G9NodeFifos(max);

    for (let i = 0; i < max; i++) {
      const out = fifos.admit({
        node_id: NODE,
        bus_id: BUS,
        build: (seq) => buildOcc(seq),
      });
      assert.equal(out.result.status, "enqueued");
      if (out.result.status === "enqueued") {
        assert.equal(out.result.occurrence.attempt_sequence, i);
      }
      assert.equal(out.overload.kind, "none");
    }
    assert.equal(fifos.depth(NODE), max);

    const reject0 = fifos.admit({
      node_id: NODE,
      bus_id: BUS,
      build: (seq) => buildOcc(seq),
    });
    assert.equal(reject0.result.status, "rejected-capacity");
    if (reject0.result.status === "rejected-capacity") {
      assert.equal(reject0.result.attempt_sequence, max);
    }
    assert.equal(reject0.overload.kind, "overload-start");
    if (reject0.overload.kind === "overload-start") {
      assert.equal(reject0.overload.fifo_depth, max);
      assert.equal(reject0.overload.reason, "capacity");
      assert.equal(reject0.overload.node_id, NODE);
      assert.equal(reject0.overload.bus_id, BUS);
    }
    assert.equal(reject0.depth, max);

    const reject1 = fifos.admit({
      node_id: NODE,
      bus_id: BUS,
      build: (seq) => buildOcc(seq),
    });
    assert.equal(reject1.result.status, "rejected-capacity");
    if (reject1.result.status === "rejected-capacity") {
      assert.equal(reject1.result.attempt_sequence, max + 1);
    }
    assert.equal(reject1.overload.kind, "none");

    const dequeued = fifos.dequeueHead(NODE);
    assert.ok(dequeued !== undefined);
    assert.equal(dequeued!.attempt_sequence, 0);
    assert.equal(fifos.depth(NODE), max - 1);

    const recovered = fifos.admit({
      node_id: NODE,
      bus_id: BUS,
      build: (seq) => buildOcc(seq),
    });
    assert.equal(recovered.result.status, "enqueued");
    if (recovered.result.status === "enqueued") {
      assert.equal(recovered.result.occurrence.attempt_sequence, max + 2);
    }
    assert.equal(recovered.overload.kind, "overload-recovered");
    if (recovered.overload.kind === "overload-recovered") {
      assert.equal(recovered.overload.fifo_depth, max);
      assert.equal(recovered.overload.reason, "capacity");
    }
  });

  it("two comm_ids on the same node_id share one sequence space", () => {
    const fifos = new G9NodeFifos(max);
    const a = fifos.admit({
      node_id: NODE,
      bus_id: BUS,
      build: (seq) => buildOcc(seq, { comm_id: "INV-T2-ORCH-QUEUE" }),
    });
    const b = fifos.admit({
      node_id: NODE,
      bus_id: BUS,
      build: (seq) =>
        buildOcc(seq, {
          comm_id: "INV-T2-OTHER-SLICE",
          phase_id: "other-phase",
        }),
    });
    assert.equal(a.result.status, "enqueued");
    assert.equal(b.result.status, "enqueued");
    if (a.result.status === "enqueued" && b.result.status === "enqueued") {
      assert.equal(a.result.occurrence.attempt_sequence, 0);
      assert.equal(b.result.occurrence.attempt_sequence, 1);
    }
  });

  it("recordWithheld advances sequence without enqueue or overload", () => {
    const fifos = new G9NodeFifos(max);
    const withheld = fifos.recordWithheld(NODE);
    assert.equal(withheld.attempt_sequence, 0);
    assert.equal(fifos.depth(NODE), 0);

    const enqueued = fifos.admit({
      node_id: NODE,
      bus_id: BUS,
      build: (seq) => buildOcc(seq),
    });
    assert.equal(enqueued.result.status, "enqueued");
    if (enqueued.result.status === "enqueued") {
      assert.equal(enqueued.result.occurrence.attempt_sequence, 1);
    }
    assert.equal(enqueued.overload.kind, "none");
  });
});

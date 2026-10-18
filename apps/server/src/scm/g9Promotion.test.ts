// @effect-diagnostics nodeBuiltinImport:off
/**
 * G9 promotion / retain / toW1 tests (WP2 / Task 5).
 *
 * Intended: FIFO head beats retained; retain-true repeats with nextAges;
 * retain-false leaves inactive when FIFO empty; toW1 w1-invalid leaves
 * lastPublished untouched. TestRetainOccurrence is test-only (not a live family).
 * Observed: assertions below.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";

import type { W1Word } from "./g4Word.ts";
import { loadG8FramingParameters, nextAges } from "./g8SharedClock.ts";
import { G9NodeFifos } from "./g9Fifo.ts";
import { G9InvariantFault, type G9Occurrence, type G9OrchQueueEqualityA } from "./g9Occurrence.ts";
import { loadG9Package } from "./g9Package.ts";
import { selectPromotion, toW1, type NodeShadowState } from "./g9Promotion.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const NODE = "node.orchestration";
const BUS = "bus.control";

/**
 * Test-only retained declaration shape for retain true/false cases.
 * Not a second live family — Task 5 helper inside this file only.
 */
type TestRetainOccurrence = G9Occurrence & {
  readonly retainCurrentAfterPublish: boolean;
};

const makeOcc = (
  overrides: Partial<G9Occurrence> & {
    equality_A?: G9OrchQueueEqualityA;
    retainCurrentAfterPublish: boolean;
  },
): TestRetainOccurrence => ({
  comm_id: overrides.comm_id ?? "INV-T2-ORCH-QUEUE",
  phase_id: overrides.phase_id ?? "queue-offered",
  node_id: overrides.node_id ?? NODE,
  origin_bus_id: overrides.origin_bus_id ?? BUS,
  attempt_sequence: overrides.attempt_sequence ?? 0,
  equality_A: overrides.equality_A ?? { command_type: "client" },
  semanticKind: overrides.semanticKind ?? "request",
  request_label: overrides.request_label ?? "client",
  state_label: overrides.state_label ?? "offered",
  retainCurrentAfterPublish: overrides.retainCurrentAfterPublish,
});

describe("selectPromotion / toW1", () => {
  const framing = loadG8FramingParameters(repoRoot);
  const pkg = loadG9Package(repoRoot);
  const max = pkg.parameters.fifo_max_occurrences_per_node;

  const emptyState = (): NodeShadowState => ({
    fifo: new G9NodeFifos(max),
    lastPublished: new Map(),
    retained: new Map(),
  });

  it("(a) FIFO head promotes while retained of another comm_id stays in retained", () => {
    const state = emptyState();
    const retained = makeOcc({
      comm_id: "INV-T2-RETAIN-OTHER",
      phase_id: "retain-phase",
      retainCurrentAfterPublish: true,
      request_label: "internal",
      state_label: "offered",
      attempt_sequence: 7,
    });
    state.retained.set(NODE, retained);

    const queued = makeOcc({
      comm_id: "INV-T2-ORCH-QUEUE",
      retainCurrentAfterPublish: false,
      attempt_sequence: 0,
      request_label: "client",
    });
    const admitted = state.fifo.admit({
      node_id: NODE,
      bus_id: BUS,
      build: () => queued,
    });
    assert.equal(admitted.result.status, "enqueued");

    const selected = selectPromotion(NODE, state, framing);
    assert.equal(selected.kind, "fifo");
    if (selected.kind === "fifo") {
      assert.equal(selected.occurrence.comm_id, "INV-T2-ORCH-QUEUE");
      assert.equal(selected.occurrence.attempt_sequence, 0);
    }
    // Retained of the other comm_id is untouched; FIFO still holds the head.
    assert.equal(state.retained.get(NODE)?.comm_id, "INV-T2-RETAIN-OTHER");
    assert.equal(state.fifo.peekHead(NODE)?.comm_id, "INV-T2-ORCH-QUEUE");
  });

  it("(b) after retain-true publish, empty FIFO repeats with incremented ages", () => {
    const state = emptyState();
    const retained = makeOcc({
      retainCurrentAfterPublish: true,
      request_label: "client",
      state_label: "offered",
      attempt_sequence: 3,
    });
    const published = toW1(retained, undefined, framing);
    state.lastPublished.set(NODE, published);
    state.retained.set(NODE, retained);

    const expectedAges = nextAges(
      {
        fundamental_state: published.fundamental_state,
        fundamental_request: published.fundamental_request,
        state_age: published.state_age,
        request_age: published.request_age,
      },
      retained.state_label,
      retained.request_label,
    );

    const selected = selectPromotion(NODE, state, framing);
    assert.equal(selected.kind, "repeat");
    if (selected.kind === "repeat") {
      assert.equal(selected.word.fundamental_request, "client");
      assert.equal(selected.word.fundamental_state, "offered");
      assert.equal(selected.word.state_age, expectedAges.state_age);
      assert.equal(selected.word.request_age, expectedAges.request_age);
      assert.equal(selected.word.state_age, 1);
      assert.equal(selected.word.request_age, 0);
    }
  });

  it("(c) after retain-false, empty FIFO is inactive", () => {
    const state = emptyState();
    // retain-false ⇒ current empty after successful publication (no retained entry).
    const selected = selectPromotion(NODE, state, framing);
    assert.equal(selected.kind, "inactive");
  });

  it("(d) failed checkW1Word throws w1-invalid and leaves lastPublished unchanged", () => {
    const state = emptyState();
    const good = makeOcc({ retainCurrentAfterPublish: false });
    const published = toW1(good, undefined, framing);
    state.lastPublished.set(NODE, published);
    const snapshot: W1Word = { ...published };

    const bad = makeOcc({
      retainCurrentAfterPublish: false,
      // Empty state label fails checkW1Word non-empty slot rule.
      state_label: "",
    });

    try {
      toW1(bad, published, framing);
      assert.fail("expected G9InvariantFault");
    } catch (error) {
      assert.ok(error instanceof G9InvariantFault);
      assert.equal(error.code, "w1-invalid");
    }

    assert.deepEqual(state.lastPublished.get(NODE), snapshot);
  });
});

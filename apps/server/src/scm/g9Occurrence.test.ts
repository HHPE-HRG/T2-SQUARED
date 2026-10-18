/**
 * G9 occurrence freeze + fault class tests (WP2 / Task 3).
 *
 * Intended: prove freeze deep-freezes occurrence and equality_A; mutating
 * throws in strict ESM; G9InvariantFault._tag is stable.
 * Observed: assertions below.
 */
import { assert, describe, it } from "@effect/vitest";

import { freezeOccurrence, G9InvariantFault, type G9Occurrence } from "./g9Occurrence.ts";

const sampleOccurrence = (): G9Occurrence => ({
  comm_id: "INV-T2-ORCH-QUEUE",
  phase_id: "queue-offered",
  node_id: "node.orchestration",
  origin_bus_id: "bus.control",
  attempt_sequence: 0,
  equality_A: { command_type: "client" },
  semanticKind: "request",
  request_label: "client",
  state_label: "offered",
  retainCurrentAfterPublish: false,
});

describe("freezeOccurrence", () => {
  it("freezes the occurrence and equality_A; mutation throws in strict mode", () => {
    const occurrence = sampleOccurrence();
    const frozen = freezeOccurrence(occurrence);

    assert.equal(Object.isFrozen(frozen), true);
    assert.equal(Object.isFrozen(frozen.equality_A), true);
    assert.equal(frozen, occurrence);

    assert.throws(() => {
      (frozen as { attempt_sequence: number }).attempt_sequence = 99;
    }, TypeError);
    assert.throws(() => {
      (frozen.equality_A as { command_type: string }).command_type = "internal";
    }, TypeError);
  });
});

describe("G9InvariantFault", () => {
  it("exposes _tag G9InvariantFault and the given code", () => {
    const fault = new G9InvariantFault("preflight", "x");
    assert.equal(fault._tag, "G9InvariantFault");
    assert.equal(fault.code, "preflight");
    assert.equal(fault.message, "x");
    assert.equal(fault.name, "G9InvariantFault");
  });
});

// @effect-diagnostics nodeBuiltinImport:off
/**
 * WP5 B6 dormant-home-bus-link fixture helper tests.
 *
 * Intended: prove B6 builds ledger-bounded capture input; dormant-prototype
 * enqueues under fixture/test coordinator wiring (RFC-019); fixture module
 * never imports the G6 home-bus-link module; vector disposition stays
 * fixture-fail (not success-path). Observed: assertions below.
 *
 * Does not authorize G10. Does not flip g9toG10Authorized. No production
 * server wiring, WP7 bootstrap, Engine, or Effect patch.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";

import { DipMuteStore } from "./g6DipMute.ts";
import { loadG8FramingParameters } from "./g8SharedClock.ts";
import { G9RosterCoordinator } from "./g9Coordinator.ts";
import { G9FaultController } from "./g9Fault.ts";
import {
  buildHomeBusForwardCaptureInput,
  captureHomeBusForwardSucceeded,
  DORMANT_HOME_BUS_LINK_PHASE,
  expectedHomeBusForwardEqualityA,
  HOME_BUS_FORWARD_FIXTURE_VECTOR,
  HOME_BUS_FORWARD_PHASE_ID,
  HOME_BUS_FORWARD_ROUTE_ID,
  HOME_BUS_LINK_COMM_ID,
  HOME_BUS_LINK_HOME_BUS_ID,
  HOME_BUS_LINK_NODE_ID,
  type G9FixtureCaptureFn,
} from "./g9FamilyHomeBusLinkFixtures.ts";
import { makeG9Observation } from "./g9Observation.ts";
import type { G9CaptureOccurrenceInput, G9FaultSink } from "./g9Occurrence.ts";
import { findRowPhase, loadG9Package } from "./g9Package.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../..");
const fixtureModulePath = join(here, "g9FamilyHomeBusLinkFixtures.ts");

/**
 * Build a test-only roster coordinator for dormant enqueue proof.
 * Agent: fixture/test wiring only — not production bootstrap.
 */
const makeFixtureCoordinator = () => {
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
  return { pkg, coordinator };
};

describe("g9FamilyHomeBusLinkFixtures (WP5 B6)", () => {
  it("exports ledger identities matching dormant_prototype_phases / row placement", () => {
    const pkg = loadG9Package(repoRoot);
    const looked = findRowPhase(pkg, HOME_BUS_LINK_COMM_ID, HOME_BUS_FORWARD_PHASE_ID);
    assert.notEqual(looked, undefined);
    // Package projects dormant via phase.fixture_driver_class (RFC-019); no row.status field.
    assert.equal(looked!.phase.fixture_driver_class, "dormant-prototype");
    assert.equal(looked!.row.placementStatus, "placed");
    assert.equal(looked!.row.node_id, HOME_BUS_LINK_NODE_ID);
    assert.equal(looked!.row.home_bus_id, HOME_BUS_LINK_HOME_BUS_ID);
    assert.equal(DORMANT_HOME_BUS_LINK_PHASE.fixture_driver_class, "dormant-prototype");
    assert.equal(DORMANT_HOME_BUS_LINK_PHASE.comm_id, HOME_BUS_LINK_COMM_ID);
    assert.equal(DORMANT_HOME_BUS_LINK_PHASE.phase_id, HOME_BUS_FORWARD_PHASE_ID);
  });

  it("builds closed capture input + fixture vector equal to ledger W1 A", () => {
    const input = buildHomeBusForwardCaptureInput();
    assert.deepEqual(input, {
      comm_id: "INV-T2-SCM-HOME-BUS-LINK",
      phase: "home-bus-forward-succeeded",
      input: { route_id: "fixture-forward" },
    });
    assert.deepEqual(expectedHomeBusForwardEqualityA(), {
      route_id: HOME_BUS_FORWARD_ROUTE_ID,
    });
    assert.deepEqual(
      HOME_BUS_FORWARD_FIXTURE_VECTOR.expected_equality_A,
      expectedHomeBusForwardEqualityA(),
    );
    assert.equal(HOME_BUS_FORWARD_FIXTURE_VECTOR.expected_request_label, "fixture-forward");
    assert.equal(HOME_BUS_FORWARD_FIXTURE_VECTOR.expected_state_label, "succeeded");
    assert.equal(HOME_BUS_FORWARD_FIXTURE_VECTOR.expected_retention, false);
    assert.equal(HOME_BUS_FORWARD_FIXTURE_VECTOR.expected_semanticKind, "request");
    // WP8: dormant vector disposition is fixture-fail, not success-path.
    assert.equal(
      HOME_BUS_FORWARD_FIXTURE_VECTOR.expected_live_failure_no_capture_disposition,
      "no production occurrence; fixture-fail: no-occurrence",
    );
    assert.notEqual(
      HOME_BUS_FORWARD_FIXTURE_VECTOR.expected_live_failure_no_capture_disposition,
      "success-path",
    );
  });

  it("fixture module source never imports the G6 home-bus-link module", () => {
    const source = readFileSync(fixtureModulePath, "utf8");
    // Law: no production link import / construct — comments may name the law in prose.
    assert.equal(/from\s+["']\.\/g6HomeBusLink/.test(source), false);
    assert.equal(/import\s+[^;]*g6HomeBusLink/.test(source), false);
    assert.equal(/import\s+[^;]*BidirectionalHomeBusLink/.test(source), false);
    assert.equal(/new\s+BidirectionalHomeBusLink/.test(source), false);
  });

  it.effect("captureHomeBusForwardSucceeded invokes live-safe capture once with ledger input", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<G9CaptureOccurrenceInput>>([]);
      const capture: G9FixtureCaptureFn = (input) =>
        Ref.update(calls, (prev) => [...prev, input]).pipe(
          Effect.as({
            status: "enqueued" as const,
            occurrence: {
              comm_id: HOME_BUS_LINK_COMM_ID,
              phase_id: HOME_BUS_FORWARD_PHASE_ID,
              node_id: HOME_BUS_LINK_NODE_ID,
              origin_bus_id: HOME_BUS_LINK_HOME_BUS_ID,
              attempt_sequence: 0,
              equality_A: expectedHomeBusForwardEqualityA(),
              semanticKind: "request" as const,
              request_label: HOME_BUS_FORWARD_ROUTE_ID,
              state_label: "succeeded",
              retainCurrentAfterPublish: false,
            },
          }),
        );

      const result = yield* captureHomeBusForwardSucceeded(capture);
      assert.equal(result?.status, "enqueued");
      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 1);
      assert.deepEqual(seen[0], buildHomeBusForwardCaptureInput());
    }),
  );

  it.effect("dormant-prototype enqueues under fixture/test coordinator wiring", () =>
    Effect.gen(function* () {
      const { coordinator, pkg } = makeFixtureCoordinator();
      const looked = findRowPhase(pkg, HOME_BUS_LINK_COMM_ID, HOME_BUS_FORWARD_PHASE_ID)!;
      assert.equal(looked.phase.fixture_driver_class, "dormant-prototype");

      const input = buildHomeBusForwardCaptureInput();
      const result = yield* coordinator.captureOccurrence(input);
      assert.equal(result.status, "enqueued");
      if (result.status !== "enqueued") return;
      assert.deepEqual(result.occurrence.equality_A, expectedHomeBusForwardEqualityA());
      assert.equal(result.occurrence.request_label, HOME_BUS_FORWARD_ROUTE_ID);
      assert.equal(result.occurrence.state_label, "succeeded");
      assert.equal(result.occurrence.node_id, HOME_BUS_LINK_NODE_ID);
      assert.equal(result.occurrence.origin_bus_id, HOME_BUS_LINK_HOME_BUS_ID);
      assert.equal(result.occurrence.retainCurrentAfterPublish, false);
      assert.equal(coordinator.fifo.depth(HOME_BUS_LINK_NODE_ID), 1);
    }),
  );
});

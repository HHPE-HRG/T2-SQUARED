/**
 * G9 roster coordinator: ten buses, capture, preflight/commit (WP3 / Task 8).
 *
 * Intended: instantiate exactly the ten G3/G9 runtime buses (no authority key,
 * no eleventh bus, no BidirectionalHomeBusLink fabric). captureOccurrence owns
 * attempt sequence + withheld/capacity/enqueue. advanceFundamentalTimestep is
 * snapshot → preflight (plain throws) → synchronous commit on the same fiber.
 * Preflight never calls admitPublish / bus.advance / setBusPosition. Commit
 * yield*s observePublish(admitPublish) then advances only live buses.
 *
 * Observed: see captureOccurrence / preflightShadowPublish / commitShadowPublish /
 * advanceFundamentalTimestep below. Task 14 validates against loaded package for
 * all 184 ledger phases (RFC-017/019 driver-class law).
 *
 * Sole owner of this file: WP2+WP3-Foundation-Owner for Task 14 capture widen.
 * Does not flip g9toG10Authorized. Does not authorize G10.
 */
import * as Effect from "effect/Effect";

import { checkW1Word, type W1Word } from "./g4Word.ts";
import { InProcessOpenLoopBus, observePublish } from "./g5OpenLoop.ts";
import { admitPublish, type DipMuteStore } from "./g6DipMute.ts";
import type { BridgeAdvanceResult } from "./g6HomeBusLink.ts";
import { type FundamentalTimestepTarget, type G8FramingParameters } from "./g8SharedClock.ts";
import { G9NodeFifos } from "./g9Fifo.ts";
import type { G9FaultController } from "./g9Fault.ts";
import {
  G9InvariantFault,
  type G9CaptureOccurrenceInput,
  type G9CaptureResult,
  type G9EqualityA,
  type G9Occurrence,
} from "./g9Occurrence.ts";
import { sandboxObserve, type G9Observation } from "./g9Observation.ts";
import {
  findRowPhase,
  type G9Package,
  type G9PhaseDeclaration,
  type G9RowDeclaration,
} from "./g9Package.ts";
import { selectPromotion, toW1, type NodeShadowState } from "./g9Promotion.ts";

const RESERVED_NODE_ID = "node.observer.404";
const AUTHORITY_NODE_ID = "node.scm.authority";
const AUTHORITY_BUS_ID = "bus.scm.authority";

/**
 * Project capture input onto equality_A + occurrence labels using phase law.
 *
 * Intended: A_field value must be in the finite domain; complementary label is
 * taken from input when that domain has multiple members, else phase singleton.
 * Observed: throws placement on missing / out-of-domain values.
 *
 * Parameters
 * ----------
 * phase : G9PhaseDeclaration
 *     Loaded phase (labels, liveToEquality, semanticKind).
 * inputFields : object
 *     Phase-bounded capture `input` (A field + optional complementary label).
 *
 * Returns
 * -------
 * { equality_A, request_label, state_label }
 *     Values ready for G9Occurrence construction.
 */
const projectCaptureLabels = (
  phase: G9PhaseDeclaration,
  inputFields: G9CaptureOccurrenceInput["input"],
): {
  readonly equality_A: G9EqualityA;
  readonly request_label: string;
  readonly state_label: string;
} => {
  const aField = phase.liveToEquality.A_field;
  const raw = inputFields as Record<string, unknown>;
  const aValue = raw[aField];
  if (typeof aValue !== "string") {
    throw new G9InvariantFault("placement", `missing A field ${aField}`);
  }
  const aDomain =
    phase.liveToEquality.finite_domain === "request_label"
      ? phase.request_label
      : phase.state_label;
  if (!aDomain.includes(aValue)) {
    throw new G9InvariantFault("placement", `${aField}=${aValue}`);
  }

  let request_label: string;
  let state_label: string;
  if (phase.semanticKind === "request") {
    request_label = aValue;
    if (phase.state_label.length === 1) {
      state_label = phase.state_label[0]!;
    } else {
      const st = raw.state_label;
      if (typeof st !== "string" || !phase.state_label.includes(st)) {
        throw new G9InvariantFault("placement", `state_label ${String(st)}`);
      }
      state_label = st;
    }
  } else {
    state_label = aValue;
    if (phase.request_label.length === 1) {
      request_label = phase.request_label[0]!;
    } else {
      const rq = raw.request_label;
      if (typeof rq !== "string" || !phase.request_label.includes(rq)) {
        throw new G9InvariantFault("placement", `request_label ${String(rq)}`);
      }
      request_label = rq;
    }
  }

  const equality_A = { [aField]: aValue } as G9EqualityA;
  return { equality_A, request_label, state_label };
};

/** One preflight-accepted candidate ready for commit admitPublish. */
export type G9ShadowCandidate = {
  readonly node_id: string;
  readonly word: W1Word;
  readonly fromFifo: boolean;
  readonly occurrence: G9Occurrence | undefined;
};

/**
 * Ten-bus G9 roster coordinator implementing FundamentalTimestepTarget&lt;G9InvariantFault&gt;.
 *
 * Parameters
 * ----------
 * pkg : G9Package
 *     Validated runtime sets + ledger rows.
 * store : DipMuteStore
 *     Empty initial DIP; bus positions for withhold / skip-frozen.
 * observation : G9Observation
 *     Catalog emitters (already sandboxed per method).
 * faults : G9FaultController
 *     Latches preflight failures from advanceFundamentalTimestep.
 * framing : G8FramingParameters
 *     Named placeholders for toW1.
 */
export class G9RosterCoordinator implements FundamentalTimestepTarget<G9InvariantFault> {
  /** Runtime bus map keyed by bus_id (exactly ten; never authority). */
  readonly buses: ReadonlyMap<string, InProcessOpenLoopBus>;
  /** Per-node FIFO store (capacity from package parameters). */
  readonly fifo: G9NodeFifos;
  private readonly lastPublished = new Map<string, W1Word>();
  private readonly retained = new Map<string, G9Occurrence>();

  readonly pkg: G9Package;
  readonly store: DipMuteStore;
  private readonly observation: G9Observation;
  private readonly faults: G9FaultController;
  private readonly framing: G8FramingParameters;

  constructor(
    pkg: G9Package,
    store: DipMuteStore,
    observation: G9Observation,
    faults: G9FaultController,
    framing: G8FramingParameters,
  ) {
    this.pkg = pkg;
    this.store = store;
    this.observation = observation;
    this.faults = faults;
    this.framing = framing;
    const buses = new Map<string, InProcessOpenLoopBus>();
    for (const busId of pkg.runtimeBusIds) {
      const id = busId;
      buses.set(
        id,
        new InProcessOpenLoopBus({
          mutationGuard: () => this.store.assertMutable(id),
        }),
      );
    }
    this.buses = buses;
    this.fifo = new G9NodeFifos(pkg.parameters.fifo_max_occurrences_per_node);
  }

  /** Shadow promotion state shared with selectPromotion. */
  private shadowState(): NodeShadowState {
    return {
      fifo: this.fifo,
      lastPublished: this.lastPublished,
      retained: this.retained,
    };
  }

  /**
   * Capture one ledger-projected occurrence (Task 14 full widen).
   *
   * Order: package row/phase lookup → declaration-absence → placement → A/label
   * bounds → withheld if origin frozen/halted (recordWithheld; no overload) →
   * else fifo.admit then overload/capacity/depth observations after mutation.
   *
   * RFC-019 driver-class law: declaration-absence never enqueues (placement).
   * dormant-prototype may enqueue under fixture/test wiring; production bootstrap
   * (WP7) must not invoke those paths.
   *
   * Effect channel: sync G9InvariantFault (placement / sequence-overflow) stays
   * Fail(G9InvariantFault) via Effect.try — never Die (RFC-018 capture-defect).
   */
  captureOccurrence(
    input: G9CaptureOccurrenceInput,
  ): Effect.Effect<G9CaptureResult, G9InvariantFault> {
    const self = this;
    return Effect.gen(function* () {
      const prepared = yield* Effect.try({
        try: () => self.prepareCapture(input),
        catch: (unknown) => {
          if (unknown instanceof G9InvariantFault) return unknown;
          throw unknown;
        },
      });

      if (prepared.kind === "withheld") {
        yield* sandboxObserve(self.observation.incRejectedWithheld());
        yield* sandboxObserve(
          self.observation.setFifoDepth(prepared.node_id, prepared.bus_id, prepared.depth),
        );
        return prepared.result;
      }

      if (prepared.overload.kind === "overload-start") {
        yield* sandboxObserve(
          self.observation.overloadStart({
            node_id: prepared.overload.node_id,
            bus_id: prepared.overload.bus_id,
            fifo_depth: prepared.overload.fifo_depth,
            reason: prepared.overload.reason,
          }),
        );
      } else if (prepared.overload.kind === "overload-recovered") {
        yield* sandboxObserve(
          self.observation.overloadRecovered({
            node_id: prepared.overload.node_id,
            bus_id: prepared.overload.bus_id,
            fifo_depth: prepared.overload.fifo_depth,
            reason: prepared.overload.reason,
          }),
        );
      }

      if (prepared.result.status === "rejected-capacity") {
        yield* sandboxObserve(self.observation.incRejectedCapacity());
      }

      yield* sandboxObserve(
        self.observation.setFifoDepth(prepared.node_id, prepared.bus_id, prepared.depth),
      );
      return prepared.result;
    });
  }

  /**
   * Sync capture body: package-backed validate + FIFO mutate.
   * Observation runs in the Effect wrapper.
   */
  private prepareCapture(input: G9CaptureOccurrenceInput):
    | {
        readonly kind: "withheld";
        readonly result: G9CaptureResult;
        readonly node_id: string;
        readonly bus_id: string;
        readonly depth: number;
      }
    | {
        readonly kind: "admit";
        readonly result: G9CaptureResult;
        readonly overload: ReturnType<G9NodeFifos["admit"]>["overload"];
        readonly node_id: string;
        readonly bus_id: string;
        readonly depth: number;
      } {
    const looked = findRowPhase(this.pkg, input.comm_id, input.phase);
    if (looked === undefined) {
      throw new G9InvariantFault("placement", `${input.comm_id}/${input.phase}`);
    }
    const { row, phase } = looked;

    // RFC-019: declaration-absence never enqueues (WP8 assert-only driver).
    if (phase.fixture_driver_class === "declaration-absence") {
      throw new G9InvariantFault(
        "placement",
        `declaration-absence ${input.comm_id}/${input.phase}`,
      );
    }

    const projected = projectCaptureLabels(phase, input.input);
    const node_id = row.node_id;
    const bus_id = row.origin_bus_id;
    const position = this.store.busPosition(bus_id);

    if (position === "frozen" || position === "halted") {
      const { attempt_sequence } = this.fifo.recordWithheld(node_id);
      return {
        kind: "withheld",
        result: { status: "rejected-bus-withheld", attempt_sequence },
        node_id,
        bus_id,
        depth: this.fifo.depth(node_id),
      };
    }

    const admitted = this.fifo.admit({
      node_id,
      bus_id,
      build: (attempt_sequence) => ({
        comm_id: input.comm_id,
        phase_id: input.phase,
        node_id,
        origin_bus_id: bus_id,
        attempt_sequence,
        equality_A: projected.equality_A,
        semanticKind: phase.semanticKind,
        request_label: projected.request_label,
        state_label: projected.state_label,
        retainCurrentAfterPublish: phase.retainCurrentAfterPublish,
      }),
    });

    return {
      kind: "admit",
      result: admitted.result,
      overload: admitted.overload,
      node_id,
      bus_id,
      depth: admitted.depth,
    };
  }

  /**
   * Ordered admitShadowPublish checks 1–6. Throws G9InvariantFault; no G7 mutation.
   *
   * Parameters
   * ----------
   * word : W1Word
   *     Candidate word about to be published.
   * row : G9RowDeclaration
   *     Ledger row that produced the candidate.
   */
  admitShadowPublish(word: W1Word, row: G9RowDeclaration): void {
    // (1) word.bus_id === row.origin_bus_id === coordinator bus-map key being written
    if (word.bus_id !== row.origin_bus_id) {
      throw new G9InvariantFault("placement", "word.bus_id !== row.origin_bus_id");
    }
    if (!this.buses.has(word.bus_id)) {
      throw new G9InvariantFault("placement", `unknown bus-map key ${word.bus_id}`);
    }

    // (2) word.node_id === row.node_id
    if (word.node_id !== row.node_id) {
      throw new G9InvariantFault("placement", "word.node_id !== row.node_id");
    }

    // (3) G3 node/bus binding matches the row
    const home = this.pkg.nodeHomeBus.get(row.node_id);
    if (home !== row.origin_bus_id || home !== word.bus_id) {
      throw new G9InvariantFault("placement", "G3 binding mismatch");
    }
    if (!this.pkg.placedNodeIds.has(row.node_id)) {
      throw new G9InvariantFault("placement", "row node not placed");
    }

    // (4) placed and non-reserved (404 rejected)
    if (word.node_id === RESERVED_NODE_ID || !this.pkg.placedNodeIds.has(word.node_id)) {
      throw new G9InvariantFault("reserved-identity", word.node_id);
    }

    // (5) not authority parent
    if (word.node_id === AUTHORITY_NODE_ID || word.bus_id === AUTHORITY_BUS_ID) {
      throw new G9InvariantFault("authority-parent", `${word.node_id}/${word.bus_id}`);
    }

    // (6) checkW1Word succeeds (not folded into toW1 for this gate)
    const checked = checkW1Word(word);
    if (!checked.ok) {
      throw new G9InvariantFault("w1-invalid", checked.failures[0]?.message ?? "w1");
    }
  }

  /**
   * Plain-function preflight. Throws G9InvariantFault or returns candidates.
   * Does not call admitPublish, bus.publish, bus.advanceFundamentalTimestep, or setBusPosition.
   */
  preflightShadowPublish(): { readonly candidates: ReadonlyArray<G9ShadowCandidate> } {
    const candidates: G9ShadowCandidate[] = [];
    const state = this.shadowState();

    for (const node_id of this.pkg.placedNodeIds) {
      const originBus = this.pkg.nodeHomeBus.get(node_id);
      if (originBus === undefined) continue;

      // Skip nodes whose origin bus is frozen/halted (stay queued; bus not participating).
      const position = this.store.busPosition(originBus);
      if (position === "frozen" || position === "halted") {
        continue;
      }

      const selected = selectPromotion(node_id, state, this.framing);
      if (selected.kind === "inactive") continue;

      let word: W1Word;
      let fromFifo: boolean;
      let occurrence: G9Occurrence | undefined;
      let row: G9RowDeclaration | undefined;

      if (selected.kind === "fifo") {
        occurrence = selected.occurrence;
        fromFifo = true;
        row = this.pkg.rowsByCommId.get(occurrence.comm_id);
        if (row === undefined) {
          throw new G9InvariantFault("placement", `no row for ${occurrence.comm_id}`);
        }
        word = toW1(occurrence, this.lastPublished.get(node_id), this.framing);
      } else {
        // repeat: word already built via toW1 inside selectPromotion
        word = selected.word;
        fromFifo = false;
        occurrence = this.retained.get(node_id);
        if (occurrence === undefined) {
          throw new G9InvariantFault("preflight", `repeat without retained ${node_id}`);
        }
        row = this.pkg.rowsByCommId.get(occurrence.comm_id);
        if (row === undefined) {
          throw new G9InvariantFault("placement", `no row for retained ${occurrence.comm_id}`);
        }
      }

      this.admitShadowPublish(word, row);
      candidates.push({ node_id, word, fromFifo, occurrence });
    }

    return { candidates };
  }

  /**
   * Commit after preflight accepted every candidate. Same fiber: observePublish+admitPublish
   * per candidate, advance live buses only, dequeue fromFifo heads, update retained/lastPublished.
   * Returns empty BridgeAdvanceResult (no home-bus delivery routing).
   */
  commitShadowPublish(
    candidates: ReadonlyArray<G9ShadowCandidate>,
  ): Effect.Effect<BridgeAdvanceResult, never> {
    const self = this;
    return Effect.gen(function* () {
      for (const candidate of candidates) {
        const bus = self.buses.get(candidate.word.bus_id);
        if (bus === undefined) {
          // Preflight already required bus-map key; this is a defect if reached.
          throw new Error(`commit missing bus ${candidate.word.bus_id}`);
        }
        yield* observePublish(
          candidate.word,
          Effect.sync(() => admitPublish(bus, self.store, candidate.word.bus_id, candidate.word)),
        );

        self.lastPublished.set(candidate.node_id, candidate.word);

        if (candidate.fromFifo) {
          self.fifo.dequeueHead(candidate.node_id);
          if (candidate.occurrence?.retainCurrentAfterPublish === true) {
            self.retained.set(candidate.node_id, candidate.occurrence);
          } else {
            self.retained.delete(candidate.node_id);
          }
        }
        // Repeat path: retained stays; ages already advanced via toW1.
      }

      for (const [busId, bus] of self.buses) {
        const position = self.store.busPosition(busId);
        if (position === "live") {
          bus.advanceFundamentalTimestep();
        }
      }

      return { deliveries: [], failures: [] } satisfies BridgeAdvanceResult;
    });
  }

  /**
   * Fundamental timestep: Effect.try(preflight) → latch+fail on G9InvariantFault;
   * else commit. Non-G9 throws stay defects. Do not Effect.sync the preflight.
   */
  advanceFundamentalTimestep(): Effect.Effect<BridgeAdvanceResult, G9InvariantFault> {
    const self = this;
    return Effect.gen(function* () {
      const preflighted = yield* Effect.try({
        try: () => self.preflightShadowPublish(),
        catch: (unknown) => {
          if (unknown instanceof G9InvariantFault) return unknown;
          throw unknown;
        },
      }).pipe(
        Effect.tapError((fault) =>
          self.faults.latch(fault, {
            waker_state: "armed-in-flight",
            scope: "capture",
          }),
        ),
      );

      return yield* self.commitShadowPublish(preflighted.candidates);
    });
  }
}

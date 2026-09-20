/**
 * G6 DIP store with D12 mute-law validation, hear-path mute, and T2 OTEL.
 *
 * Receivers may mute same-or-lower sources; never a greater class and
 * never the authority parent bus. setDip fails closed and retains prior DIP.
 * hear() applies mute-source / mute-modifiers on the receiving bus only;
 * InProcessOpenLoopBus.read stays unfiltered. observeDipSet / hearObserved
 * emit spans after successful mute decisions; they must not perform mute.
 *
 * G7 bus-level position (live / frozen / halted) lives on this store.
 * Governed buses default live. Observer and node.observer.404 cannot
 * freeze or halt. Frozen/halted buses reject setDip/removeDip and
 * assertMutable; there is no unfreeze/unhalt. observeBusPosition emits
 * freeze/halt spans after a successful set; recommendStop is OTEL only.
 * admitPublish freezes the target bus on unknown node_id or bus_id and
 * does not publish; other buses stay live.
 *
 * Package check is completeness for this DIP-mute slice: legal tuple, gate G6,
 * later-gates locked. No independent-review hash. Does not flip G4/G5
 * g6toG10Authorized and does not authorize G7–G10.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import type { Attributes } from "@opentelemetry/api";
import * as Effect from "effect/Effect";

import { withOwnedSpan, type T2Observability } from "../t2Observability/T2Observability.ts";
import type { W1Word } from "./g4Word.ts";
import { w1WordId, type InProcessOpenLoopBus } from "./g5OpenLoop.ts";

export type AuthorityClass = "A0" | "A1" | "A2" | "observer";
export type DipMode = "hear" | "mute-source" | "mute-modifiers";

/**
 * Bus-level DIP safety position. Intended: one latch per governed bus.
 * Observed: unknown bus_id is not live; callers must use busPosition.
 *
 * Parameters
 * ----------
 * none
 *
 * Returns
 * -------
 * "live" | "frozen" | "halted"
 *     Safety latch for that receiving bus.
 *
 * Example
 * -------
 * const position: DipBusPosition = "frozen";
 */
export type DipBusPosition = "live" | "frozen" | "halted";

/**
 * Actor attempting a DIP bus-position write.
 *
 * Parameters
 * ----------
 * node_id : string
 *     Caller identity (steward.test vs node.observer.404).
 * authority_class : AuthorityClass
 *     Caller class; observer cannot freeze or halt.
 *
 * Returns
 * -------
 * DipActor
 *     Identity used by setBusPosition.
 *
 * Example
 * -------
 * const actor: DipActor = STEWARD_ACTOR;
 */
export interface DipActor {
  readonly node_id: string;
  readonly authority_class: AuthorityClass;
}

/**
 * Steward actor allowed to freeze or halt a governed bus.
 *
 * Parameters
 * ----------
 * none
 *
 * Returns
 * -------
 * DipActor
 *     node_id steward.test, class A2 (not observer).
 *
 * Example
 * -------
 * store.setBusPosition("bus.scm.a", "frozen", STEWARD_ACTOR);
 */
export const STEWARD_ACTOR: DipActor = {
  node_id: "steward.test",
  authority_class: "A2",
};

export interface DipRow {
  readonly receiving_bus_id: string;
  readonly receiving_authority_class: AuthorityClass;
  readonly source_bus_id: string;
  readonly source_node_id: string; // concrete or "*"
  readonly source_authority_class: AuthorityClass;
  readonly mode: DipMode;
  readonly steward: string;
  readonly runtime_mutable: boolean;
}

export interface GovernedClasses {
  readonly buses: ReadonlyMap<string, AuthorityClass>;
  readonly nodes: ReadonlyMap<string, AuthorityClass>;
  readonly authority_bus_id: string; // "bus.scm.authority"
}

/** Fixed D12 order: A0 > A1 > A2 > observer. */
const AUTHORITY_RANK: Readonly<Record<AuthorityClass, number>> = {
  A0: 3,
  A1: 2,
  A2: 1,
  observer: 0,
};

const AUTHORITY_CLASSES = new Set<string>(Object.keys(AUTHORITY_RANK));
const DIP_MODES = new Set<DipMode>(["hear", "mute-source", "mute-modifiers"]);
const SUPPRESSIVE_MODES = new Set<DipMode>(["mute-source", "mute-modifiers"]);

const nonEmpty = (value: string): boolean => value.trim().length > 0;

const isAuthorityClass = (value: string): value is AuthorityClass => AUTHORITY_CLASSES.has(value);

const isDipMode = (value: string): value is DipMode => DIP_MODES.has(value as DipMode);

const dipKey = (receiving_bus_id: string, source_bus_id: string, source_node_id: string): string =>
  `${receiving_bus_id}\0${source_bus_id}\0${source_node_id}`;

/**
 * Fail-closed DIP mutation error. Prior rows stay installed.
 *
 * Parameters
 * ----------
 * message : string
 *     Why setDip/removeDip rejected the mutation.
 *
 * Returns
 * -------
 * DipMuteFailure
 *     Error instance for callers to catch.
 *
 * Example
 * -------
 * throw new DipMuteFailure("source class exceeds receiving class");
 * throw new DipMuteFailure("observer cannot freeze or halt DIP");
 */
export class DipMuteFailure extends Error {
  readonly _tag = "DipMuteFailure";

  constructor(message: string) {
    super(message);
    this.name = "DipMuteFailure";
  }
}

/**
 * In-memory DIP switch set for one governed class table.
 *
 * Parameters
 * ----------
 * governed : GovernedClasses
 *     Injectable bus/node class maps and authority parent bus id.
 *
 * Returns
 * -------
 * DipMuteStore
 *     Validating upsert store, bus-level position, lookup/shouldSuppress.
 *
 * Example
 * -------
 * const store = new DipMuteStore(governed);
 * store.setDip(row);
 * store.setBusPosition("bus.scm.a", "frozen", STEWARD_ACTOR);
 */
export class DipMuteStore {
  private readonly governed: GovernedClasses;
  private readonly rows = new Map<string, DipRow>();
  /** Latched frozen/halted positions; absent governed bus means live. */
  private readonly positions = new Map<string, DipBusPosition>();

  constructor(governed: GovernedClasses) {
    this.governed = governed;
  }

  /**
   * Governed-bus safety position. Unknown bus_id fails closed.
   *
   * Parameters
   * ----------
   * bus_id : string
   *     Must exist in governed.buses.
   *
   * Returns
   * -------
   * DipBusPosition
   *     live until set; else frozen or halted.
   *
   * Example
   * -------
   * store.busPosition("bus.scm.a");
   */
  busPosition(bus_id: string): DipBusPosition {
    this.assertGovernedBus(bus_id);
    return this.positions.get(bus_id) ?? "live";
  }

  /**
   * Latch freeze/halt on a governed bus. No unfreeze/unhalt.
   *
   * Observer class and node.observer.404 cannot set frozen/halted.
   * Same-position writes are idempotent. live → frozen/halted is allowed.
   *
   * Parameters
   * ----------
   * bus_id : string
   *     Governed bus to latch.
   * position : DipBusPosition
   *     Target position.
   * actor : DipActor
   *     Caller identity and class.
   *
   * Returns
   * -------
   * void
   *
   * Example
   * -------
   * store.setBusPosition("bus.scm.a", "halted", STEWARD_ACTOR);
   */
  setBusPosition(bus_id: string, position: DipBusPosition, actor: DipActor): void {
    this.assertGovernedBus(bus_id);
    const current = this.positions.get(bus_id) ?? "live";
    if (position === "frozen" || position === "halted") {
      if (actor.authority_class === "observer" || actor.node_id === "node.observer.404") {
        throw new DipMuteFailure("observer cannot freeze or halt DIP");
      }
    }
    if (current === position) {
      return;
    }
    if (current === "frozen" || current === "halted") {
      throw new DipMuteFailure("DIP bus position cannot be changed after freeze or halt");
    }
    this.positions.set(bus_id, position);
  }

  /**
   * Fail closed when the governed bus is frozen or halted.
   *
   * Parameters
   * ----------
   * bus_id : string
   *     Governed bus that must still accept mutation.
   *
   * Returns
   * -------
   * void
   *
   * Example
   * -------
   * store.assertMutable("bus.scm.a");
   */
  assertMutable(bus_id: string): void {
    const position = this.busPosition(bus_id);
    if (position === "frozen" || position === "halted") {
      throw new DipMuteFailure(`DIP bus ${bus_id} is ${position}`);
    }
  }

  /**
   * Validate then upsert a DIP row by (receiving_bus, source_bus, source_node).
   *
   * Parameters
   * ----------
   * row : DipRow
   *     Steward-authored switch. Mutated only after mute-law checks pass.
   *
   * Returns
   * -------
   * void
   *
   * Example
   * -------
   * store.setDip({ ...peer, mode: "mute-source" });
   */
  setDip(row: DipRow): void {
    this.assertValidRow(row);
    this.assertMutable(row.receiving_bus_id);
    const key = dipKey(row.receiving_bus_id, row.source_bus_id, row.source_node_id);
    const existing = this.rows.get(key);
    if (existing !== undefined && !existing.runtime_mutable) {
      throw new DipMuteFailure("runtime_mutable false row cannot be mutated after install");
    }
    this.rows.set(key, row);
  }

  /**
   * Remove a DIP row by key when the installed row is runtime_mutable.
   *
   * Parameters
   * ----------
   * receiving_bus_id : string
   *     Receiving bus of the row.
   * source_bus_id : string
   *     Source bus of the row.
   * source_node_id : string
   *     Concrete origin or "*".
   *
   * Returns
   * -------
   * void
   *
   * Example
   * -------
   * store.removeDip("bus.scm.a", "bus.scm.b", "node.scm.home-b");
   */
  removeDip(receiving_bus_id: string, source_bus_id: string, source_node_id: string): void {
    if (this.governed.buses.has(receiving_bus_id)) {
      this.assertMutable(receiving_bus_id);
    }
    const key = dipKey(receiving_bus_id, source_bus_id, source_node_id);
    const existing = this.rows.get(key);
    if (existing === undefined) {
      return;
    }
    if (!existing.runtime_mutable) {
      throw new DipMuteFailure("runtime_mutable false row cannot be mutated after install");
    }
    this.rows.delete(key);
  }

  /**
   * List DIP rows installed for one receiving bus.
   *
   * Parameters
   * ----------
   * receiving_bus_id : string
   *     Receiving bus to filter.
   *
   * Returns
   * -------
   * ReadonlyArray<DipRow>
   *     Installed rows for that bus (insertion order of the store map).
   *
   * Example
   * -------
   * const rows = store.listDip("bus.scm.a");
   */
  listDip(receiving_bus_id: string): ReadonlyArray<DipRow> {
    return [...this.rows.values()].filter((row) => row.receiving_bus_id === receiving_bus_id);
  }

  /**
   * Resolve hear mode: concrete source_node_id overrides "*"; else hear.
   *
   * Parameters
   * ----------
   * receiving_bus_id : string
   *     Bus applying DIP.
   * origin_bus_id : string
   *     Word origin bus (preserved through bridge).
   * origin_node_id : string
   *     Word origin node.
   *
   * Returns
   * -------
   * DipMode
   *     Winning row mode, or "hear" when no row matches.
   *
   * Example
   * -------
   * store.resolveMode("bus.scm.a", "bus.scm.b", "node.scm.home-b");
   */
  resolveMode(receiving_bus_id: string, origin_bus_id: string, origin_node_id: string): DipMode {
    return this.lookupRow(receiving_bus_id, origin_bus_id, origin_node_id)?.mode ?? "hear";
  }

  /**
   * Winning DIP row: concrete source_node_id overrides "*"; else undefined.
   *
   * Parameters
   * ----------
   * receiving_bus_id : string
   *     Bus applying DIP.
   * origin_bus_id : string
   *     Word origin bus (preserved through bridge).
   * origin_node_id : string
   *     Word origin node.
   *
   * Returns
   * -------
   * DipRow | undefined
   *     Concrete row, else wildcard, else none.
   *
   * Example
   * -------
   * store.lookupRow("bus.scm.a", "bus.scm.b", "node.scm.home-b");
   */
  lookupRow(
    receiving_bus_id: string,
    origin_bus_id: string,
    origin_node_id: string,
  ): DipRow | undefined {
    const concrete = this.rows.get(dipKey(receiving_bus_id, origin_bus_id, origin_node_id));
    if (concrete !== undefined) {
      return concrete;
    }
    return this.rows.get(dipKey(receiving_bus_id, origin_bus_id, "*"));
  }

  /**
   * Whether hear should apply a suppressive mode for this row.
   *
   * False when mode is hear, or DIP classes disagree with governed
   * (stale mismatch: fail-open hear). True only for mute-source /
   * mute-modifiers whose classes still match governed.
   *
   * Parameters
   * ----------
   * row : DipRow
   *     Winning DIP row for the origin word.
   * governed : GovernedClasses
   *     Class table at hear time (constructor table or options.governed).
   *
   * Returns
   * -------
   * boolean
   *     True only when suppression is legal to apply.
   *
   * Example
   * -------
   * store.shouldSuppress(row, governed);
   */
  shouldSuppress(row: DipRow, governed: GovernedClasses): boolean {
    if (!SUPPRESSIVE_MODES.has(row.mode)) {
      return false;
    }
    return rowClassesMatchGoverned(row, governed);
  }

  /**
   * Constructor governed table for hear when options.governed is omitted.
   *
   * Parameters
   * ----------
   * none
   *
   * Returns
   * -------
   * GovernedClasses
   *     Same maps passed to the constructor.
   *
   * Example
   * -------
   * hear(bus, store, receiving, origin); // uses store.governedClasses()
   */
  governedClasses(): GovernedClasses {
    return this.governed;
  }

  /**
   * Fail closed when bus_id is absent from governed.buses.
   *
   * Parameters
   * ----------
   * bus_id : string
   *     Candidate receiving bus.
   *
   * Returns
   * -------
   * void
   *
   * Example
   * -------
   * this.assertGovernedBus("bus.scm.a");
   */
  private assertGovernedBus(bus_id: string): void {
    if (!this.governed.buses.has(bus_id)) {
      throw new DipMuteFailure(`unknown bus: ${bus_id}`);
    }
  }

  /**
   * Fail closed before any map write. Intended: reject illegal mute.
   * Observed: throws DipMuteFailure; this.rows unchanged.
   */
  private assertValidRow(row: DipRow): void {
    if (
      !nonEmpty(row.receiving_bus_id) ||
      !nonEmpty(row.source_bus_id) ||
      !nonEmpty(row.source_node_id) ||
      !nonEmpty(row.steward)
    ) {
      throw new DipMuteFailure("DIP row ids and steward must be non-empty");
    }
    if (!isDipMode(row.mode)) {
      throw new DipMuteFailure(`unknown DIP mode: ${String(row.mode)}`);
    }
    if (
      !isAuthorityClass(row.receiving_authority_class) ||
      !isAuthorityClass(row.source_authority_class)
    ) {
      throw new DipMuteFailure("authority class must be A0, A1, A2, or observer");
    }

    const receivingGoverned = this.governed.buses.get(row.receiving_bus_id);
    if (receivingGoverned === undefined || receivingGoverned !== row.receiving_authority_class) {
      throw new DipMuteFailure(
        "receiving_authority_class must equal governed class of receiving_bus_id",
      );
    }

    if (row.source_node_id === "*") {
      const sourceBusClass = this.governed.buses.get(row.source_bus_id);
      if (sourceBusClass === undefined || sourceBusClass !== row.source_authority_class) {
        throw new DipMuteFailure(
          "wildcard source_authority_class must equal governed class of source_bus_id",
        );
      }
    } else {
      const sourceNodeClass = this.governed.nodes.get(row.source_node_id);
      if (sourceNodeClass === undefined) {
        throw new DipMuteFailure(`unknown source node: ${row.source_node_id}`);
      }
      if (sourceNodeClass !== row.source_authority_class) {
        throw new DipMuteFailure(
          "source_authority_class must equal governed class of source_node_id",
        );
      }
    }

    const suppressive = SUPPRESSIVE_MODES.has(row.mode);
    if (suppressive && row.source_bus_id === this.governed.authority_bus_id) {
      throw new DipMuteFailure("mute targeting authority_bus_id is forbidden");
    }
    if (
      suppressive &&
      AUTHORITY_RANK[row.source_authority_class] > AUTHORITY_RANK[row.receiving_authority_class]
    ) {
      throw new DipMuteFailure(
        "suppressive DIP forbidden when source class exceeds receiving class",
      );
    }
  }
}

/**
 * DIP row classes still agree with a governed table.
 *
 * Parameters
 * ----------
 * row : DipRow
 *     Installed switch (may be stale vs current governed).
 * governed : GovernedClasses
 *     Hear-time or set-time class maps.
 *
 * Returns
 * -------
 * boolean
 *     True when receiving and source classes match governed ids.
 *
 * Example
 * -------
 * rowClassesMatchGoverned(row, governed);
 */
const rowClassesMatchGoverned = (row: DipRow, governed: GovernedClasses): boolean => {
  const receivingGoverned = governed.buses.get(row.receiving_bus_id);
  if (receivingGoverned === undefined || receivingGoverned !== row.receiving_authority_class) {
    return false;
  }
  if (row.source_node_id === "*") {
    const sourceBusClass = governed.buses.get(row.source_bus_id);
    return sourceBusClass !== undefined && sourceBusClass === row.source_authority_class;
  }
  const sourceNodeClass = governed.nodes.get(row.source_node_id);
  return sourceNodeClass !== undefined && sourceNodeClass === row.source_authority_class;
};

/**
 * DIP-filtered hear beside unfiltered bus.read. Never mutes on a mismatched row.
 *
 * Parameters
 * ----------
 * bus : InProcessOpenLoopBus
 *     Receiving-bus storage (read remains raw).
 * store : DipMuteStore
 *     DIP rows for this receiving bus.
 * receiving_bus_id : string
 *     Bus whose DIP set is applied.
 * origin_node_id : string
 *     Storage key / origin node (process-globally unique in this slice).
 * options : { governed?: GovernedClasses }
 *     Optional hear-time class table; defaults to the store constructor table.
 *
 * Returns
 * -------
 * W1Word | undefined
 *     Stored word, modifiers-cleared word, or absence under mute-source.
 *
 * Example
 * -------
 * const heard = hear(bus, store, "bus.scm.a", "node.scm.home-b");
 */
export const hear = (
  bus: InProcessOpenLoopBus,
  store: DipMuteStore,
  receiving_bus_id: string,
  origin_node_id: string,
  options?: { governed?: GovernedClasses },
): W1Word | undefined => {
  const word = bus.read(origin_node_id);
  if (word === undefined) {
    return undefined;
  }
  const row = store.lookupRow(receiving_bus_id, word.bus_id, word.node_id);
  if (row === undefined) {
    return word;
  }
  const governed = options?.governed ?? store.governedClasses();
  if (!store.shouldSuppress(row, governed)) {
    return word;
  }
  if (row.mode === "mute-source") {
    return undefined;
  }
  if (row.mode === "mute-modifiers") {
    return { ...word, modifiers: [] };
  }
  return word;
};

/**
 * Admit a W1 word onto a DIP-governed bus, or freeze that bus.
 *
 * Unknown node_id or word.bus_id is fail-closed: freeze this bus_id via
 * STEWARD_ACTOR and throw without bus.publish. Other buses are not halted.
 *
 * Parameters
 * ----------
 * bus : InProcessOpenLoopBus
 *     Target writing bus.
 * store : DipMuteStore
 *     DIP positions and governed class tables.
 * bus_id : string
 *     Governed bus being admitted onto; must still be mutable.
 * word : W1Word
 *     Candidate origin identity (node_id and bus_id).
 *
 * Returns
 * -------
 * void
 *
 * Example
 * -------
 * admitPublish(bus, store, "bus.scm.a", word);
 */
export const admitPublish = (
  bus: InProcessOpenLoopBus,
  store: DipMuteStore,
  bus_id: string,
  word: W1Word,
): void => {
  store.assertMutable(bus_id);
  const governed = store.governedClasses();
  if (!governed.nodes.has(word.node_id) || !governed.buses.has(word.bus_id)) {
    store.setBusPosition(bus_id, "frozen", STEWARD_ACTOR);
    throw new DipMuteFailure(
      `unknown publish identity node_id=${word.node_id} bus_id=${word.bus_id}`,
    );
  }
  bus.publish(word);
};

/**
 * Span attributes for a successful DIP set. Intended: identity + mode only.
 * Observed: four t2.scm.* keys; observation never writes the store.
 */
const dipSetAttributes = (row: DipRow): Attributes => ({
  "t2.scm.receiving_bus_id": row.receiving_bus_id,
  "t2.scm.source_bus_id": row.source_bus_id,
  "t2.scm.source_node_id": row.source_node_id,
  "t2.scm.dip.mode": row.mode,
});

/**
 * Span attributes for a mute-source hear suppression. Intended: receiving
 * bus, source, mode, origins, optional word_id. Observed: omits word_id
 * when the caller did not supply one.
 */
const hearMutedAttributes = (attrs: {
  receiving_bus_id: string;
  source_bus_id: string;
  source_node_id: string;
  mode: DipMode;
  word_id?: string;
  origin_node_id: string;
  origin_bus_id: string;
}): Attributes => {
  const attributes: Attributes = {
    "t2.scm.receiving_bus_id": attrs.receiving_bus_id,
    "t2.scm.source_bus_id": attrs.source_bus_id,
    "t2.scm.source_node_id": attrs.source_node_id,
    "t2.scm.dip.mode": attrs.mode,
    "t2.scm.origin_node_id": attrs.origin_node_id,
    "t2.scm.origin_bus_id": attrs.origin_bus_id,
  };
  if (attrs.word_id !== undefined) {
    attributes["t2.scm.word_id"] = attrs.word_id;
  }
  return attributes;
};

/**
 * Observe a DIP set on the existing T2 OTEL plane after the effect succeeds.
 *
 * Observation must not install or mutate DIP. The wrapped effect runs first;
 * t2.scm.dip.set is emitted only on success (mirrors observePublish).
 *
 * Parameters
 * ----------
 * row : DipRow
 *     Row identity used for span attributes (not written by this helper).
 * effect : Effect.Effect
 *     Caller-owned setDip (or other) side effect.
 *
 * Returns
 * -------
 * Effect.Effect
 *     Same result, then `t2.scm.dip.set` when T2 observability is present.
 *
 * Example
 * -------
 * yield* observeDipSet(row, Effect.sync(() => store.setDip(row)));
 */
export const observeDipSet = <A, E, R>(
  row: DipRow,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.flatMap(effect, (result) =>
    withOwnedSpan("t2.scm.dip.set", Effect.succeed(result), dipSetAttributes(row)),
  );

/**
 * Observe mute-source hear suppression after the hear decision succeeds.
 *
 * Observation must not perform mute. Emit `t2.scm.hear.muted` only after
 * the wrapped effect succeeds.
 *
 * Parameters
 * ----------
 * attrs : object
 *     Receiving/source/origin ids, DIP mode, optional word_id.
 * effect : Effect.Effect
 *     Caller-owned hear result (already muted or not).
 *
 * Returns
 * -------
 * Effect.Effect
 *     Same result, then `t2.scm.hear.muted` when T2 observability is present.
 *
 * Example
 * -------
 * yield* observeHearMuted(attrs, Effect.succeed(undefined));
 */
export const observeHearMuted = <A, E, R>(
  attrs: {
    receiving_bus_id: string;
    source_bus_id: string;
    source_node_id: string;
    mode: DipMode;
    word_id?: string;
    origin_node_id: string;
    origin_bus_id: string;
  },
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.flatMap(effect, (result) =>
    withOwnedSpan("t2.scm.hear.muted", Effect.succeed(result), hearMutedAttributes(attrs)),
  );

/**
 * hear() then emit t2.scm.hear.muted when mute-source hid a stored word.
 *
 * Intended: read present + hear undefined → muted span with w1WordId of
 * the stored word. Observed: does not mute; hear() already applied DIP.
 * No span when hear admits or storage is empty.
 *
 * Parameters
 * ----------
 * bus : InProcessOpenLoopBus
 *     Receiving-bus storage (read remains raw).
 * store : DipMuteStore
 *     DIP rows for this receiving bus.
 * receiving_bus_id : string
 *     Bus whose DIP set was applied.
 * origin_node_id : string
 *     Storage key / origin node.
 * options : { governed?: GovernedClasses }
 *     Optional hear-time class table; defaults to the store constructor table.
 *
 * Returns
 * -------
 * Effect.Effect<W1Word | undefined, never, T2Observability>
 *     Same word as hear(); muted span when T2 observability is present.
 *
 * Example
 * -------
 * const heard = yield* hearObserved(bus, store, "bus.scm.a", "node.scm.home-b");
 */
export const hearObserved = (
  bus: InProcessOpenLoopBus,
  store: DipMuteStore,
  receiving_bus_id: string,
  origin_node_id: string,
  options?: { governed?: GovernedClasses },
): Effect.Effect<W1Word | undefined, never, T2Observability> => {
  const stored = bus.read(origin_node_id);
  const heard = hear(bus, store, receiving_bus_id, origin_node_id, options);
  if (stored === undefined || heard !== undefined) {
    return Effect.succeed(heard);
  }
  const row = store.lookupRow(receiving_bus_id, stored.bus_id, stored.node_id);
  return observeHearMuted(
    {
      receiving_bus_id,
      source_bus_id: stored.bus_id,
      source_node_id: stored.node_id,
      mode: row?.mode ?? "mute-source",
      word_id: w1WordId(stored),
      origin_node_id,
      origin_bus_id: stored.bus_id,
    },
    Effect.succeed(heard),
  );
};

/**
 * Span attributes for freeze/halt/recommend-stop observation.
 * Intended: bus + actor identity only. Observed: never writes DIP.
 */
const busPositionAttributes = (attrs: {
  bus_id: string;
  position: DipBusPosition;
  reason: string;
  node_id: string;
}): Attributes => ({
  "t2.scm.bus_id": attrs.bus_id,
  "t2.scm.position": attrs.position,
  "t2.scm.reason": attrs.reason,
  "t2.scm.node_id": attrs.node_id,
});

/**
 * Observe a DIP bus-position latch after the wrapped effect succeeds.
 *
 * Observation must not freeze or halt. Span name is t2.scm.freeze when
 * position is frozen, t2.scm.halt when halted. live emits no span.
 *
 * Parameters
 * ----------
 * attrs : object
 *     bus_id, target position, reason, actor node_id.
 * effect : Effect.Effect
 *     Caller-owned setBusPosition (or other) side effect.
 *
 * Returns
 * -------
 * Effect.Effect
 *     Same result, then freeze/halt span when T2 observability is present.
 *
 * Example
 * -------
 * yield* observeBusPosition(attrs, Effect.sync(() => store.setBusPosition(...)));
 */
export const observeBusPosition = <A, E, R>(
  attrs: { bus_id: string; position: DipBusPosition; reason: string; node_id: string },
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.flatMap(effect, (result) => {
    if (attrs.position === "frozen") {
      return withOwnedSpan("t2.scm.freeze", Effect.succeed(result), busPositionAttributes(attrs));
    }
    if (attrs.position === "halted") {
      return withOwnedSpan("t2.scm.halt", Effect.succeed(result), busPositionAttributes(attrs));
    }
    return Effect.succeed(result);
  });

/**
 * Emit t2.scm.recommend_stop only. Must not call setBusPosition.
 *
 * 404 / observer recommend-stop is observational. DIP stays live unless
 * a steward later latches freeze/halt.
 *
 * Parameters
 * ----------
 * from_node_id : string
 *     Recommending node (typically node.observer.404).
 * reason : string
 *     Why stop was recommended.
 *
 * Returns
 * -------
 * Effect.Effect<void, never, T2Observability>
 *     Void; t2.scm.recommend_stop when T2 observability is present.
 *
 * Example
 * -------
 * yield* recommendStop("node.observer.404", "404 recommend-stop");
 */
export const recommendStop = (
  from_node_id: string,
  reason: string,
): Effect.Effect<void, never, T2Observability> =>
  withOwnedSpan("t2.scm.recommend_stop", Effect.void, {
    "t2.scm.node_id": from_node_id,
    "t2.scm.reason": reason,
  });

const MANIFEST_STATUSES = new Set(["authorized", "in-progress", "completed"]);

export interface G6Authorization {
  identity: string;
  scope: string;
  note: string;
}

/**
 * G6 DIP-mute package manifest. No review hash field: completed means
 * proof-matrix package completeness, not independent Codex review or A7.
 */
export interface G6Manifest {
  schemaVersion: 1;
  gate: "G6";
  status: "authorized" | "in-progress" | "completed";
  authorized: boolean;
  completed: boolean;
  doesNotAuthorizeLaterGates: true;
  g7toG10Authorized: false;
  plan: string;
  authorization: G6Authorization;
}

export interface G6Package {
  repoRoot: string;
  manifest: G6Manifest;
}

export interface G6Failure {
  readonly code: string;
  readonly message: string;
}

export type G6CheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failures: ReadonlyArray<G6Failure> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Legal (status, authorized, completed) combinations for G6.
 *
 * Parameters
 * ----------
 * manifest : G6Manifest
 *     Parsed G6 manifest.
 *
 * Returns
 * -------
 * boolean
 *     True when the tuple matches authorized/in-progress vs completed.
 *
 * Example
 * -------
 * legalManifestTuple(pkg.manifest)
 */
const legalManifestTuple = (manifest: G6Manifest): boolean => {
  if (!MANIFEST_STATUSES.has(manifest.status)) {
    return false;
  }
  if (manifest.status === "authorized" || manifest.status === "in-progress") {
    return manifest.authorized === true && manifest.completed === false;
  }
  return manifest.authorized === true && manifest.completed === true;
};

/**
 * Load the G6 DIP-mute package.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     T2-SQUARED repository root.
 *
 * Returns
 * -------
 * G6Package
 *     Manifest only. README is explanatory and is not a reviewed digest.
 *
 * Example
 * -------
 * const pkg = loadG6Package(repoRoot);
 */
export const loadG6Package = (repoRoot: string): G6Package => ({
  repoRoot,
  manifest: JSON.parse(
    NodeFS.readFileSync(NodePath.join(repoRoot, "docs/scm/g6/manifest.json"), "utf8"),
  ) as G6Manifest,
});

/**
 * Check G6 DIP-mute package completeness.
 *
 * Legal tuple, gate G6, and later-gate barrier only. Completed does not
 * require an independent review hash. G7–G10 stay locked.
 *
 * Parameters
 * ----------
 * pkg : G6Package
 *     Loaded G6 package.
 *
 * Returns
 * -------
 * G6CheckResult
 *     `ok: true` when the legal tuple and later-gate barrier hold.
 *
 * Example
 * -------
 * const result = checkG6(loadG6Package(repoRoot));
 */
export const checkG6 = (pkg: G6Package): G6CheckResult => {
  const failures: G6Failure[] = [];
  const push = (code: string, message: string) => {
    failures.push({ code, message });
  };
  if (!isRecord(pkg.manifest) || pkg.manifest.gate !== "G6") {
    push("manifest-gate", "expected G6 package");
  }
  if (!legalManifestTuple(pkg.manifest)) {
    push(
      "manifest-tuple",
      `illegal tuple status=${pkg.manifest.status} authorized=${String(pkg.manifest.authorized)} completed=${String(pkg.manifest.completed)}`,
    );
  }
  if (!pkg.manifest.doesNotAuthorizeLaterGates || pkg.manifest.g7toG10Authorized) {
    push("later-gates", "G6 must keep doesNotAuthorizeLaterGates true and g7toG10Authorized false");
  }
  if (failures.length > 0) {
    return { ok: false, failures };
  }
  return { ok: true };
};

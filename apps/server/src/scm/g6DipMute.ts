/**
 * G6 DIP store with D12 mute-law validation and hear-path mute.
 *
 * Receivers may mute same-or-lower sources; never a greater class and
 * never the authority parent bus. setDip fails closed and retains prior DIP.
 * hear() applies mute-source / mute-modifiers on the receiving bus only;
 * InProcessOpenLoopBus.read stays unfiltered. OTEL is a later task.
 */
import type { W1Word } from "./g4Word.ts";
import type { InProcessOpenLoopBus } from "./g5OpenLoop.ts";

export type AuthorityClass = "A0" | "A1" | "A2" | "observer";
export type DipMode = "hear" | "mute-source" | "mute-modifiers";

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
 *     Validating upsert store plus lookup/shouldSuppress for hear().
 *
 * Example
 * -------
 * const store = new DipMuteStore(governed);
 * store.setDip(row);
 */
export class DipMuteStore {
  private readonly governed: GovernedClasses;
  private readonly rows = new Map<string, DipRow>();

  constructor(governed: GovernedClasses) {
    this.governed = governed;
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

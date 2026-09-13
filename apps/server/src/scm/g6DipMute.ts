/**
 * G6 DIP store with D12 mute-law validation at set time.
 *
 * Receivers may mute same-or-lower sources; never a greater class and
 * never the authority parent bus. Mute is not applied here — later
 * tasks add hear() and OTEL. Validation fails closed and retains prior DIP.
 */
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
 *     Validating upsert store. Hear projection is a later task.
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
    const concrete = this.rows.get(dipKey(receiving_bus_id, origin_bus_id, origin_node_id));
    if (concrete !== undefined) {
      return concrete.mode;
    }
    const wildcard = this.rows.get(dipKey(receiving_bus_id, origin_bus_id, "*"));
    if (wildcard !== undefined) {
      return wildcard.mode;
    }
    return "hear";
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

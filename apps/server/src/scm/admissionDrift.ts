/**
 * Catalog snapshot compare for admission reconcile.
 *
 * Intended: a refreshed tools/list, skill script, or harness tool that changes
 * schema, digest, effect, or destination becomes a pending delta. The previous
 * `admitted` state is not kept. Removal of an admitted endpoint revokes it.
 * Rediscovery does not clear an explicit revoke. Identical rediscovery keeps
 * the admitted state.
 *
 * Observed: pure compare. Does not write a snapshot, does not call MCP, and
 * does not treat work-registry schema drift or codec fixture drift as this
 * compare. Does not invent G11.
 */
import type { AdmissionState, CapabilityRecord } from "./admissionCatalog.ts";

export type DriftKind =
  | "unchanged"
  | "new"
  | "schema"
  | "digest"
  | "effect"
  | "destination"
  | "removed";

/** One capability's compare result. `pending` blocks dispatch until re-admit. */
export type DriftDelta = {
  readonly capability_id: string;
  readonly pending: boolean;
  readonly kind: DriftKind;
  readonly changedFields: readonly string[];
  readonly admission_state: AdmissionState;
};

export type DriftCompareResult = {
  readonly records: readonly CapabilityRecord[];
  readonly deltas: readonly DriftDelta[];
};

const effectKey = (record: CapabilityRecord): string => record.effect_classes.join(",");
const destinationKey = (record: CapabilityRecord): string => record.allowed_destinations.join(",");

const assertUnique = (records: readonly CapabilityRecord[], label: string): void => {
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.capability_id)) {
      throw new Error(
        `admission reconcile: duplicate capability_id in ${label}: ${record.capability_id}`,
      );
    }
    seen.add(record.capability_id);
  }
};

/**
 * Stable document of the fields that constitute authority. Admission state is
 * included so a revoke is visible. Key order is fixed.
 */
export const canonicalCatalog = (records: readonly CapabilityRecord[]): string => {
  const sorted = [...records].sort((left, right) =>
    left.capability_id < right.capability_id
      ? -1
      : left.capability_id > right.capability_id
        ? 1
        : 0,
  );
  return JSON.stringify(
    sorted.map((record) => ({
      capability_id: record.capability_id,
      node_id: record.node_id,
      node_type: record.node_type,
      operation: record.operation,
      bus_type: record.bus_type,
      home_bus_id: record.home_bus_id,
      class_id: record.class_id,
      effect_classes: [...record.effect_classes],
      boundary: record.boundary,
      adapter_type: record.adapter_type,
      implementation_digest: record.implementation_digest,
      input_schema: record.input_schema,
      output_schema: record.output_schema,
      allowed_destinations: [...record.allowed_destinations],
      admission_state: record.admission_state,
      nomenclature_version: record.nomenclature_version,
    })),
  );
};

type ClassifiedChange = {
  readonly kind: Exclude<DriftKind, "unchanged" | "new" | "removed">;
  readonly changedFields: readonly string[];
};

/**
 * Name the first contract group that changed. Schema wins over digest, then
 * effect, then destination, so a mixed edit still fail-closes as pending drift.
 */
const classifyChange = (
  previous: CapabilityRecord,
  next: CapabilityRecord,
): ClassifiedChange | null => {
  const schemaFields: string[] = [];
  if (previous.input_schema !== next.input_schema) schemaFields.push("input_schema");
  if (previous.output_schema !== next.output_schema) schemaFields.push("output_schema");
  const digestFields =
    previous.implementation_digest === next.implementation_digest ? [] : ["implementation_digest"];
  const effectFields: string[] = [];
  if (previous.class_id !== next.class_id) effectFields.push("class_id");
  if (effectKey(previous) !== effectKey(next)) effectFields.push("effect_classes");
  if (previous.boundary !== next.boundary) effectFields.push("boundary");
  if (previous.operation !== next.operation) effectFields.push("operation");
  if (previous.node_id !== next.node_id) effectFields.push("node_id");
  if (previous.node_type !== next.node_type) effectFields.push("node_type");
  if (previous.adapter_type !== next.adapter_type) effectFields.push("adapter_type");
  const destinationFields =
    destinationKey(previous) === destinationKey(next) ? [] : ["allowed_destinations"];
  const changedFields = [...schemaFields, ...digestFields, ...effectFields, ...destinationFields];
  if (changedFields.length === 0) return null;
  const kind: ClassifiedChange["kind"] =
    schemaFields.length > 0
      ? "schema"
      : digestFields.length > 0
        ? "digest"
        : effectFields.length > 0
          ? "effect"
          : "destination";
  return { kind, changedFields };
};

const withState = (
  record: CapabilityRecord,
  admission_state: AdmissionState,
): CapabilityRecord => ({
  ...record,
  admission_state,
  home_bus_id: "unknown",
  bus_type: "unknown",
});

/**
 * Compare the last admitted snapshot to a newly verified catalog.
 * Discovered admission_state is ignored. Authority comes only from `admitted`.
 */
export const compareCatalog = (
  admitted: readonly CapabilityRecord[],
  discovered: readonly CapabilityRecord[],
): DriftCompareResult => {
  assertUnique(admitted, "admitted snapshot");
  assertUnique(discovered, "discovered catalog");
  const previousById = new Map(admitted.map((record) => [record.capability_id, record]));
  const records: CapabilityRecord[] = [];
  const deltas: DriftDelta[] = [];

  for (const discoveredRecord of discovered) {
    const previous = previousById.get(discoveredRecord.capability_id);
    if (previous === undefined) {
      const created = withState(discoveredRecord, "proposed");
      records.push(created);
      deltas.push({
        capability_id: created.capability_id,
        pending: true,
        kind: "new",
        changedFields: [],
        admission_state: "proposed",
      });
      continue;
    }
    previousById.delete(discoveredRecord.capability_id);
    if (previous.admission_state === "revoked") {
      records.push(previous);
      deltas.push({
        capability_id: previous.capability_id,
        pending: false,
        kind: "unchanged",
        changedFields: [],
        admission_state: "revoked",
      });
      continue;
    }
    const change = classifyChange(previous, discoveredRecord);
    if (change === null) {
      records.push(previous);
      deltas.push({
        capability_id: previous.capability_id,
        pending: false,
        kind: "unchanged",
        changedFields: [],
        admission_state: previous.admission_state,
      });
      continue;
    }
    const nextState: AdmissionState =
      previous.admission_state === "suspended" ? "suspended" : "proposed";
    const drifted = withState(discoveredRecord, nextState);
    records.push(drifted);
    deltas.push({
      capability_id: previous.capability_id,
      pending: true,
      kind: change.kind,
      changedFields: change.changedFields,
      admission_state: nextState,
    });
  }

  for (const previous of previousById.values()) {
    if (previous.admission_state === "proposed") continue;
    const revoked = withState(previous, "revoked");
    records.push(revoked);
    deltas.push({
      capability_id: previous.capability_id,
      pending: true,
      kind: "removed",
      changedFields: ["endpoint"],
      admission_state: "revoked",
    });
  }

  return { records, deltas };
};

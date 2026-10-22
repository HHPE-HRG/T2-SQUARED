// @effect-diagnostics nodeBuiltinImport:off
/**
 * Admission-reconcile capability records.
 *
 * Intended: a discovered tool starts `proposed`. Only an explicit admit moves
 * it to `admitted`. Drift, revoke, and removal never widen that state.
 * `home_bus_id` and `bus_type` stay `unknown`. C9, C12, and B4 stay outside
 * granular guarantees and cannot be admitted. `canBus` is not an SCM alias.
 * Opaque quoted or whitespace payloads are not machine identifiers.
 *
 * Observed: pure records and judgments. Does not read the preview broker,
 * does not install an env gate, and does not flip authorization flags.
 * Does not resize the G10 radius. Does not activate the home bus.
 */
import { createHash } from "node:crypto";

/** Process env. Default off. Distinct from codec, Equality-IR, fabric-depth, and G10 cutover. */
export const ADMISSION_RECONCILE_ENV = "T2CODE_SCM_ADMISSION_RECONCILE" as const;

/** Nomenclature version for machine identifiers. Not the 21-term ASD-STE100 dictionary. */
export const ADMISSION_NOMENCLATURE_VERSION = "admission-reconcile.machine-id.v1" as const;

/** Home bus stays dormant. Records may store only this id. */
export const HOME_BUS_ID_DORMANT = "unknown" as const;

/** This charter does not activate the home bus. */
export const HOME_BUS_ACTIVATED = false as const;

export const ADMISSION_STATES = ["proposed", "admitted", "suspended", "revoked"] as const;
export type AdmissionState = (typeof ADMISSION_STATES)[number];

export const CLASS_IDS = [
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "C7",
  "C8",
  "C9",
  "C10",
  "C11",
  "C12",
] as const;
export type ClassId = (typeof CLASS_IDS)[number];

export const EFFECT_CLASSES = ["E0", "E1", "E2", "E3", "E4", "E5", "E6"] as const;
export type EffectClass = (typeof EFFECT_CLASSES)[number];

export const BOUNDARIES = ["B0", "B1", "B2", "B3", "B4"] as const;
export type Boundary = (typeof BOUNDARIES)[number];

export const MACHINE_ID_KINDS = ["capability_id", "node_type", "operation", "bus_type"] as const;
export type MachineIdKind = (typeof MACHINE_ID_KINDS)[number];

/** Product-token spellings that must not grant an SCM capability. */
export const CAN_BUS_ALIAS_TOKENS = ["canBus", "can-bus", "CAN_BUS"] as const;

const CAN_BUS_ALIASES = new Set<string>(CAN_BUS_ALIAS_TOKENS);
const CLASS_ID_SET = new Set<string>(CLASS_IDS);
const EFFECT_SET = new Set<string>(EFFECT_CLASSES);
const BOUNDARY_SET = new Set<string>(BOUNDARIES);
const STATE_SET = new Set<string>(ADMISSION_STATES);

/**
 * One callable capability. Discovery fills this shape. Admission state is
 * separate from the fact that a catalog listed the tool.
 */
export type CapabilityRecord = {
  readonly capability_id: string;
  readonly node_id: string;
  readonly node_type: ClassId;
  readonly operation: string;
  readonly bus_type: typeof HOME_BUS_ID_DORMANT;
  readonly home_bus_id: typeof HOME_BUS_ID_DORMANT;
  readonly class_id: ClassId;
  readonly effect_classes: readonly EffectClass[];
  readonly boundary: Boundary;
  readonly adapter_type: string;
  readonly implementation_digest: string;
  readonly input_schema: string;
  readonly output_schema: string;
  readonly allowed_destinations: readonly string[];
  readonly admission_state: AdmissionState;
  readonly nomenclature_version: typeof ADMISSION_NOMENCLATURE_VERSION;
};

export type CapabilityDraft = {
  readonly capability_id: string;
  readonly node_id: string;
  readonly operation: string;
  readonly class_id: ClassId;
  readonly effect_classes: readonly EffectClass[];
  readonly boundary: Boundary;
  readonly adapter_type: string;
  readonly implementation_digest: string;
  readonly input_schema: string;
  readonly output_schema: string;
  readonly allowed_destinations?: readonly string[];
  readonly admission_state?: AdmissionState;
  readonly node_type?: ClassId;
  readonly home_bus_id?: string;
  readonly bus_type?: string;
};

export type MachineIdJudgment =
  | { readonly disposition: "opaque-exempt" }
  | { readonly disposition: "known" }
  | { readonly disposition: "unknown"; readonly kind: MachineIdKind }
  | { readonly disposition: "canBus-alias" };

/**
 * SHA-256 of a catalog field. Callers supply the canonical text. This is an
 * implementation digest, not an orchestration receipt.
 */
export const digestCanonical = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

/**
 * Quoted text and any value containing whitespace are payloads. They are not
 * checked for lexicon membership.
 */
export const isOpaquePayload = (value: string): boolean => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) return true;
  return /\s/.test(trimmed);
};

/** True when the token is a canBus product spelling, not an SCM capability. */
export const isCanBusAlias = (value: string): boolean => CAN_BUS_ALIASES.has(value);

/**
 * Judge one structured identifier against an explicit vocabulary.
 * Opaque payloads are exempt. canBus aliases are rejected even when the
 * vocabulary lists them. Unknown machine ids are not exempt.
 */
export const judgeMachineIdentifier = (
  kind: MachineIdKind,
  value: string,
  vocabulary: ReadonlySet<string>,
): MachineIdJudgment => {
  if (isOpaquePayload(value)) return { disposition: "opaque-exempt" };
  if (isCanBusAlias(value)) return { disposition: "canBus-alias" };
  if (!vocabulary.has(value)) return { disposition: "unknown", kind };
  return { disposition: "known" };
};

/** C9, C12, and provider-hosted B4 cannot be given granular admit. */
export const isOutsideGranularGuarantees = (
  record: Pick<CapabilityRecord, "class_id" | "boundary">,
): boolean => record.class_id === "C9" || record.class_id === "C12" || record.boundary === "B4";

const assertMember = (label: string, value: string, allowed: ReadonlySet<string>): void => {
  if (!allowed.has(value)) {
    throw new Error(`admission reconcile: unknown ${label}: ${value}`);
  }
};

const sortEffects = (effects: readonly EffectClass[]): readonly EffectClass[] => {
  const unique = [...new Set(effects)];
  if (unique.length === 0) {
    throw new Error("admission reconcile: effect_classes must name at least one effect");
  }
  return Object.freeze(
    unique.sort((left, right) => EFFECT_CLASSES.indexOf(left) - EFFECT_CLASSES.indexOf(right)),
  );
};

/**
 * Build one record. Refuses a live home-bus id, a canBus capability id, an
 * empty effect list, and an opaque capability id. Default state is proposed.
 */
export const createCapabilityRecord = (draft: CapabilityDraft): CapabilityRecord => {
  const homeBus = draft.home_bus_id ?? HOME_BUS_ID_DORMANT;
  const busType = draft.bus_type ?? HOME_BUS_ID_DORMANT;
  if (homeBus !== HOME_BUS_ID_DORMANT || busType !== HOME_BUS_ID_DORMANT) {
    throw new Error(
      "admission reconcile: home bus stays dormant; home_bus_id and bus_type must be unknown",
    );
  }
  if (isCanBusAlias(draft.capability_id) || isCanBusAlias(draft.operation)) {
    throw new Error("admission reconcile: canBus is not an SCM capability alias");
  }
  if (isOpaquePayload(draft.capability_id)) {
    throw new Error("admission reconcile: capability_id must be a machine identifier");
  }
  assertMember("class_id", draft.class_id, CLASS_ID_SET);
  assertMember("boundary", draft.boundary, BOUNDARY_SET);
  const state = draft.admission_state ?? "proposed";
  assertMember("admission_state", state, STATE_SET);
  const nodeType = draft.node_type ?? draft.class_id;
  assertMember("node_type", nodeType, CLASS_ID_SET);
  for (const effect of draft.effect_classes) {
    assertMember("effect_class", effect, EFFECT_SET);
  }
  return {
    capability_id: draft.capability_id,
    node_id: draft.node_id,
    node_type: nodeType,
    operation: draft.operation,
    bus_type: HOME_BUS_ID_DORMANT,
    home_bus_id: HOME_BUS_ID_DORMANT,
    class_id: draft.class_id,
    effect_classes: sortEffects(draft.effect_classes),
    boundary: draft.boundary,
    adapter_type: draft.adapter_type,
    implementation_digest: draft.implementation_digest,
    input_schema: draft.input_schema,
    output_schema: draft.output_schema,
    allowed_destinations: Object.freeze([...new Set(draft.allowed_destinations ?? [])].sort()),
    admission_state: state,
    nomenclature_version: ADMISSION_NOMENCLATURE_VERSION,
  };
};

const replaceRecord = (
  records: readonly CapabilityRecord[],
  capabilityId: string,
  next: CapabilityRecord,
): readonly CapabilityRecord[] => {
  let found = false;
  const replaced = records.map((record) => {
    if (record.capability_id !== capabilityId) return record;
    found = true;
    return next;
  });
  if (!found) {
    throw new Error(`admission reconcile: unknown capability_id: ${capabilityId}`);
  }
  return replaced;
};

/**
 * Move `proposed` to `admitted`. Refuses outside-guarantee classes and any
 * other state, so a drifted or revoked row cannot skip re-proposal.
 */
export const admitCapability = (
  records: readonly CapabilityRecord[],
  capabilityId: string,
): readonly CapabilityRecord[] => {
  const current = records.find((record) => record.capability_id === capabilityId);
  if (current === undefined) {
    throw new Error(`admission reconcile: unknown capability_id: ${capabilityId}`);
  }
  if (isOutsideGranularGuarantees(current)) {
    throw new Error("admission reconcile: outside granular guarantees; refusing admit");
  }
  if (current.admission_state !== "proposed") {
    throw new Error(`admission reconcile: cannot admit from ${current.admission_state}`);
  }
  return replaceRecord(records, capabilityId, { ...current, admission_state: "admitted" });
};

/** Explicit credential revoke. Later catalog refresh must not clear this. */
export const revokeCapability = (
  records: readonly CapabilityRecord[],
  capabilityId: string,
): readonly CapabilityRecord[] => {
  const current = records.find((record) => record.capability_id === capabilityId);
  if (current === undefined) {
    throw new Error(`admission reconcile: unknown capability_id: ${capabilityId}`);
  }
  return replaceRecord(records, capabilityId, { ...current, admission_state: "revoked" });
};

/** Suspend an admitted or proposed capability. Revoked rows stay revoked. */
export const suspendCapability = (
  records: readonly CapabilityRecord[],
  capabilityId: string,
): readonly CapabilityRecord[] => {
  const current = records.find((record) => record.capability_id === capabilityId);
  if (current === undefined) {
    throw new Error(`admission reconcile: unknown capability_id: ${capabilityId}`);
  }
  if (current.admission_state === "revoked") {
    throw new Error("admission reconcile: cannot suspend a revoked capability");
  }
  return replaceRecord(records, capabilityId, { ...current, admission_state: "suspended" });
};

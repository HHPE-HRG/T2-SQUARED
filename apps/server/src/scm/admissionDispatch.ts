/**
 * Fail-closed dispatch for admission reconcile.
 *
 * Intended: unknown ids, pending drift, suspension, revocation, removal,
 * canBus aliases, and outside-guarantee classes deny. An unchanged admitted
 * record allows. A missing snapshot denies when the caller asks for a
 * decision. Unset env is compatibility mode: the preview handler does not
 * call this gate. `1`, `true`, `yes`, and `protected` are protected mode.
 *
 * Observed: pure decision plus one process-local snapshot slot used by the
 * preview invoke path. The slot is not an evidence ledger and does not
 * survive restart. Does not mediate provider-native tools. Does not flip
 * authorization flags.
 */
import type { PreviewAutomationOperation } from "@t3tools/contracts";

import { CODEC_ENV } from "./codecBootstrap.ts";
import { EQUALITY_IR_ENV } from "./equalityIrBootstrap.ts";
import { FABRIC_DEPTH_ENV } from "./fabricDepthBootstrap.ts";
import { G10_CUTOVER_ENV } from "./g10Bootstrap.ts";
import {
  ADMISSION_RECONCILE_ENV,
  isCanBusAlias,
  isOpaquePayload,
  isOutsideGranularGuarantees,
  type CapabilityRecord,
} from "./admissionCatalog.ts";
import type { DriftDelta } from "./admissionDrift.ts";
import { previewCapabilityIdForOperation } from "./admissionDiscover.ts";

/** Env change is read at process start. Tests may pass an env object. */
export const ADMISSION_RECONCILE_REQUIRES_RESTART = true as const;

/** This key must not reuse a prior campaign env. */
export const ADMISSION_RECONCILE_ENV_DISTINCT =
  ADMISSION_RECONCILE_ENV !== CODEC_ENV &&
  ADMISSION_RECONCILE_ENV !== EQUALITY_IR_ENV &&
  ADMISSION_RECONCILE_ENV !== FABRIC_DEPTH_ENV &&
  ADMISSION_RECONCILE_ENV !== G10_CUTOVER_ENV &&
  ADMISSION_RECONCILE_ENV !== "T3CODE_CLIENT_OTLP" &&
  ADMISSION_RECONCILE_ENV !== "T3CODE_APPA";

export type DispatchDenyReason =
  | "unknown"
  | "pending-drift"
  | "proposed"
  | "suspended"
  | "revoked"
  | "removed"
  | "missing-snapshot"
  | "canBus-alias"
  | "outside-guarantees";

export type DispatchDecision =
  | { readonly allow: true; readonly capabilityId: string }
  | { readonly allow: false; readonly capabilityId: string; readonly reason: DispatchDenyReason };

export type DispatchInput = {
  readonly capabilityId: string;
  readonly operation?: string;
  readonly records: readonly CapabilityRecord[] | null;
  readonly deltas?: readonly DriftDelta[];
};

type InstalledSnapshot = {
  readonly records: readonly CapabilityRecord[];
  readonly deltas: readonly DriftDelta[];
};

let installedSnapshot: InstalledSnapshot | null = null;

/**
 * Install the snapshot the preview path reads. `null` clears it. When the env
 * is set, a cleared snapshot fail-closes invoke.
 */
export const installAdmittedSnapshot = (
  records: readonly CapabilityRecord[] | null,
  deltas: readonly DriftDelta[] = [],
): void => {
  installedSnapshot =
    records === null
      ? null
      : {
          records: Object.freeze([...records]),
          deltas: Object.freeze([...deltas]),
        };
};

/** Process-local snapshot. Not shared across processes and not a receipt store. */
export const readAdmittedSnapshot = (): InstalledSnapshot | null => installedSnapshot;

/**
 * Compatibility leaves preview invoke on the session credential alone.
 * Protected is the only mode that consults a grant. Neither mode is authority
 * equivalence, and neither mode activates the home bus.
 */
export type MediationMode = "compatibility" | "protected";

/** Unset, blank, `0`, and `compatibility` stay compatibility. */
export const mediationMode = (env: NodeJS.ProcessEnv = process.env): MediationMode =>
  isAdmissionReconcileEnabled(env) ? "protected" : "compatibility";

export const isAdmissionReconcileEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const raw = env[ADMISSION_RECONCILE_ENV];
  if (raw === undefined) return false;
  const normalized = raw.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "protected"
  );
};

const deny = (capabilityId: string, reason: DispatchDenyReason): DispatchDecision => ({
  allow: false,
  capabilityId,
  reason,
});

/**
 * Decide one invoke. Null records mean the snapshot is missing and the answer
 * is deny. Outside-guarantee classes deny even if a snapshot marked them
 * admitted. Pending schema, digest, effect, and destination deltas deny.
 */
export const decideDispatch = (input: DispatchInput): DispatchDecision => {
  const capabilityId = input.capabilityId;
  if (input.records === null) return deny(capabilityId, "missing-snapshot");
  if (
    isCanBusAlias(capabilityId) ||
    (input.operation !== undefined && isCanBusAlias(input.operation))
  ) {
    return deny(capabilityId, "canBus-alias");
  }
  const record = input.records.find((candidate) => candidate.capability_id === capabilityId);
  if (record === undefined) return deny(capabilityId, "unknown");
  if (isOutsideGranularGuarantees(record)) return deny(capabilityId, "outside-guarantees");
  const delta = (input.deltas ?? []).find((candidate) => candidate.capability_id === capabilityId);
  if (delta?.kind === "removed") return deny(capabilityId, "removed");
  if (record.admission_state === "revoked") return deny(capabilityId, "revoked");
  if (record.admission_state === "suspended") return deny(capabilityId, "suspended");
  if (delta?.pending === true && delta.kind !== "new" && delta.kind !== "unchanged") {
    return deny(capabilityId, "pending-drift");
  }
  if (delta?.kind === "new" || record.admission_state === "proposed") {
    return deny(capabilityId, "proposed");
  }
  if (
    input.operation !== undefined &&
    !isOpaquePayload(input.operation) &&
    input.operation !== record.operation
  ) {
    return deny(capabilityId, "unknown");
  }
  if (record.admission_state === "admitted") {
    return { allow: true, capabilityId };
  }
  const _never: never = record.admission_state;
  return _never;
};

/**
 * Preview-handler decision. Uses the installed snapshot. Missing snapshot
 * denies. The caller must skip this when the env is unset.
 */
export const decidePreviewDispatch = (operation: PreviewAutomationOperation): DispatchDecision => {
  const capabilityId = previewCapabilityIdForOperation(operation);
  const snapshot = readAdmittedSnapshot();
  return decideDispatch({
    capabilityId,
    operation,
    records: snapshot === null ? null : snapshot.records,
    deltas: snapshot?.deltas ?? [],
  });
};

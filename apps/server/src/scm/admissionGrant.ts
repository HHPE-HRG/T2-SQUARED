/**
 * Grant check on top of catalog dispatch.
 *
 * Intended: a protected invoke is allowed only when `decideDispatch` allows,
 * the grant still matches the catalog digest and revision, the principal,
 * adapter, edge, and work scope match, the policy hook returns allow, and
 * the capability is not a nested child of a different parent grant. C9, C12,
 * and B4 deny as `unsupported-prohibited` even if a caller forged `admitted`.
 * Allow and deny each write a process-local decision. A later outcome shares
 * `correlation_id`. `completed` exists only when the caller supplies an
 * effect ref. `failed` and `uncertain` stay distinct.
 *
 * Observed: records live in this process. They are not G9 occurrences, N08
 * spans, or a legal ledger. Edges are a caller-supplied list, default empty,
 * and do not set `home_bus_id` or activate a home bus. The policy hook does
 * not evaluate information-flow labels. No Work Registry import. No wrapper
 * around Claude `canUseTool`, process spawn, Git, or SQLite.
 */
import type { PreviewAutomationOperation } from "@t3tools/contracts";

import {
  HOME_BUS_ID_DORMANT,
  isOutsideGranularGuarantees,
  type CapabilityRecord,
  type EffectClass,
} from "./admissionCatalog.ts";
import { previewCapabilityIdForOperation } from "./admissionDiscover.ts";
import {
  decideDispatch,
  installAdmittedSnapshot,
  readAdmittedSnapshot,
  type DispatchDenyReason,
  type MediationMode,
} from "./admissionDispatch.ts";
import { canonicalCatalog, type DriftDelta } from "./admissionDrift.ts";

export type GrantDenyReason =
  | DispatchDenyReason
  | "expired"
  | "stale-grant"
  | "principal-mismatch"
  | "adapter-mismatch"
  | "unauthorized-edge"
  | "work-scope-mismatch"
  | "nested-privilege"
  | "policy-unavailable"
  | "policy-deny"
  | "unsupported-prohibited"
  | "missing-grant";

export type CommunicationEdge = {
  readonly from_node: string;
  readonly to_node: string;
};

/**
 * One issued grant. `record_digest` is `canonicalCatalog` of the records at
 * issue time. Dispatch recomputes that digest and denies `stale-grant` when
 * the catalog changed after issue.
 */
export type CapabilityGrant = {
  readonly grant_id: string;
  readonly catalog_revision: number;
  readonly capability_id: string;
  readonly principal_id: string;
  readonly source_node_id: string;
  readonly target_node_id: string;
  readonly adapter_type: string;
  readonly effect_classes: readonly EffectClass[];
  readonly work_scope_ref: string | null;
  readonly expires_at: number | null;
  readonly record_digest: string;
};

/** Allow, deny, or unavailable. Unavailable is not an allow. */
export type PolicyVerdict = "allow" | "deny" | "unavailable";

/**
 * Protected mode requires this hook. It does not read flow labels and it does
 * not replace the catalog decision.
 */
export type PolicyHook = {
  readonly policy_version: string;
  readonly evaluate: (input: {
    readonly capabilityId: string;
    readonly effectClasses: readonly EffectClass[];
    readonly principalId: string;
  }) => PolicyVerdict;
};

export type DecisionOutcome = "denied" | "admitted";

export type DecisionEvidence = {
  readonly decision_id: string;
  readonly correlation_id: string;
  readonly capability_id: string;
  readonly grant_id: string | null;
  readonly policy_version: string | null;
  readonly outcome: DecisionOutcome;
  readonly reason: GrantDenyReason | null;
};

export type OutcomeStatus = "completed" | "failed" | "uncertain";

export type OutcomeEvidence = {
  readonly correlation_id: string;
  readonly capability_id: string;
  readonly status: OutcomeStatus;
  readonly effect_ref: string | null;
};

export type InvocationRequest = {
  readonly capabilityId: string;
  readonly operation?: string;
  readonly records: readonly CapabilityRecord[] | null;
  readonly deltas?: readonly DriftDelta[];
  readonly catalogRevision: number;
  readonly edges: readonly CommunicationEdge[];
  readonly grants: readonly CapabilityGrant[];
  readonly policy: PolicyHook | null;
  readonly principalId: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly adapterType: string;
  readonly requestedEdge?: CommunicationEdge | null;
  readonly workScopeRef?: string | null;
  readonly parentCapabilityId?: string | null;
  readonly grantId: string;
  readonly now: number;
};

export type AuthorizationResult =
  | {
      readonly allow: true;
      readonly capabilityId: string;
      readonly correlationId: string;
      readonly decision: DecisionEvidence;
    }
  | {
      readonly allow: false;
      readonly capabilityId: string;
      readonly reason: GrantDenyReason;
      readonly correlationId: string;
      readonly decision: DecisionEvidence;
    };

/** Identities the protected preview path presents. Callers must issue against these. */
export const PREVIEW_GRANT_PRINCIPAL = "preview-session";
export const PREVIEW_GRANT_NODE = "mcp.preview";
export const PREVIEW_GRANT_ADAPTER = "preview-mcp";

type AuthorityContext = {
  readonly catalogRevision: number;
  readonly edges: readonly CommunicationEdge[];
  readonly grants: readonly CapabilityGrant[];
  readonly policy: PolicyHook | null;
};

const EMPTY_AUTHORITY: AuthorityContext = {
  catalogRevision: 0,
  edges: [],
  grants: [],
  policy: null,
};

let authority: AuthorityContext = EMPTY_AUTHORITY;
let grantSeq = 0;
let evidenceSeq = 0;
const decisions: DecisionEvidence[] = [];
const outcomes: OutcomeEvidence[] = [];

/**
 * Install the snapshot plus the edge list, grants, revision, and policy hook
 * the preview path reads. `null` clears the snapshot and the authority slot.
 * Edges default to empty. This does not create a home bus.
 */
export const installAuthority = (
  input: {
    readonly records: readonly CapabilityRecord[] | null;
    readonly deltas?: readonly DriftDelta[];
    readonly catalogRevision: number;
    readonly edges?: readonly CommunicationEdge[];
    readonly grants?: readonly CapabilityGrant[];
    readonly policy: PolicyHook | null;
  } | null,
): void => {
  if (input === null) {
    installAdmittedSnapshot(null);
    authority = EMPTY_AUTHORITY;
    return;
  }
  installAdmittedSnapshot(input.records, input.deltas ?? []);
  authority = {
    catalogRevision: input.catalogRevision,
    edges: Object.freeze([...(input.edges ?? [])]),
    grants: Object.freeze([...(input.grants ?? [])]),
    policy: input.policy,
  };
};

/**
 * Issue a grant against one admitted record and one catalog revision.
 * Refuses unknown, non-admitted, and outside-guarantee rows. The digest is
 * the canonical catalog at issue time.
 */
export const issueGrant = (input: {
  readonly records: readonly CapabilityRecord[];
  readonly catalogRevision: number;
  readonly capabilityId: string;
  readonly principalId: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly adapterType: string;
  readonly workScopeRef?: string | null;
  readonly expiresAt?: number | null;
}): CapabilityGrant => {
  const record = input.records.find((row) => row.capability_id === input.capabilityId);
  if (record === undefined) {
    throw new Error("admission reconcile: cannot issue a grant for an unknown capability");
  }
  if (record.admission_state !== "admitted") {
    throw new Error("admission reconcile: cannot issue a grant unless the record is admitted");
  }
  if (isOutsideGranularGuarantees(record)) {
    throw new Error("admission reconcile: cannot issue a grant outside granular guarantees");
  }
  if (record.home_bus_id !== HOME_BUS_ID_DORMANT || record.bus_type !== HOME_BUS_ID_DORMANT) {
    throw new Error("admission reconcile: home bus stays dormant");
  }
  if (input.adapterType !== record.adapter_type) {
    throw new Error("admission reconcile: grant adapter must match the admitted record");
  }
  const workScopeRef = input.workScopeRef ?? null;
  if (
    record.work_scope_required &&
    (workScopeRef === null || workScopeRef !== record.work_scope_ref)
  ) {
    throw new Error("admission reconcile: work scope does not match the admitted record");
  }
  grantSeq += 1;
  return {
    grant_id: `grant-${grantSeq}`,
    catalog_revision: input.catalogRevision,
    capability_id: record.capability_id,
    principal_id: input.principalId,
    source_node_id: input.sourceNodeId,
    target_node_id: input.targetNodeId,
    adapter_type: input.adapterType,
    effect_classes: record.effect_classes,
    work_scope_ref: workScopeRef ?? record.work_scope_ref,
    expires_at: input.expiresAt ?? null,
    record_digest: canonicalCatalog(input.records),
  };
};

const pushDecision = (
  capabilityId: string,
  grantId: string | null,
  policyVersion: string | null,
  outcome: DecisionOutcome,
  reason: GrantDenyReason | null,
): DecisionEvidence => {
  evidenceSeq += 1;
  const decision: DecisionEvidence = {
    decision_id: `decision-${evidenceSeq}`,
    correlation_id: `admission-${evidenceSeq}`,
    capability_id: capabilityId,
    grant_id: grantId,
    policy_version: policyVersion,
    outcome,
    reason,
  };
  decisions.push(decision);
  return decision;
};

const denyResult = (
  capabilityId: string,
  reason: GrantDenyReason,
  grantId: string | null,
  policyVersion: string | null,
): AuthorizationResult => {
  const decision = pushDecision(capabilityId, grantId, policyVersion, "denied", reason);
  return {
    allow: false,
    capabilityId,
    reason,
    correlationId: decision.correlation_id,
    decision,
  };
};

const allowResult = (
  capabilityId: string,
  grantId: string,
  policyVersion: string,
): AuthorizationResult => {
  const decision = pushDecision(capabilityId, grantId, policyVersion, "admitted", null);
  return {
    allow: true,
    capabilityId,
    correlationId: decision.correlation_id,
    decision,
  };
};

const policyVerdict = (verdict: PolicyVerdict): "allow" | "deny" | "unavailable" => {
  switch (verdict) {
    case "allow":
    case "deny":
    case "unavailable":
      return verdict;
    default: {
      const unexpected: never = verdict;
      return unexpected;
    }
  }
};

/**
 * Protected invoke decision. Calls `decideDispatch` first, then the grant.
 * A missing policy hook denies. Does not write an execution outcome.
 */
export const authorizeInvocation = (request: InvocationRequest): AuthorizationResult => {
  const dispatch = decideDispatch({
    capabilityId: request.capabilityId,
    ...(request.operation === undefined ? {} : { operation: request.operation }),
    records: request.records,
    deltas: request.deltas ?? [],
  });
  if (!dispatch.allow) {
    const reason: GrantDenyReason =
      dispatch.reason === "outside-guarantees" ? "unsupported-prohibited" : dispatch.reason;
    return denyResult(dispatch.capabilityId, reason, request.grantId || null, null);
  }

  const record = request.records?.find((row) => row.capability_id === request.capabilityId);
  if (record !== undefined && isOutsideGranularGuarantees(record)) {
    return denyResult(
      request.capabilityId,
      "unsupported-prohibited",
      request.grantId || null,
      null,
    );
  }

  const grant = request.grants.find((row) => row.grant_id === request.grantId);
  if (grant === undefined) {
    return denyResult(request.capabilityId, "missing-grant", null, null);
  }
  if (
    request.parentCapabilityId != null &&
    request.parentCapabilityId !== request.capabilityId &&
    grant.capability_id === request.parentCapabilityId
  ) {
    return denyResult(request.capabilityId, "nested-privilege", grant.grant_id, null);
  }
  if (grant.capability_id !== request.capabilityId) {
    return denyResult(request.capabilityId, "missing-grant", grant.grant_id, null);
  }
  if (grant.principal_id !== request.principalId) {
    return denyResult(request.capabilityId, "principal-mismatch", grant.grant_id, null);
  }
  if (grant.adapter_type !== request.adapterType || record?.adapter_type !== request.adapterType) {
    return denyResult(request.capabilityId, "adapter-mismatch", grant.grant_id, null);
  }
  if (grant.expires_at !== null && request.now >= grant.expires_at) {
    return denyResult(request.capabilityId, "expired", grant.grant_id, null);
  }
  if (
    request.records === null ||
    grant.catalog_revision !== request.catalogRevision ||
    grant.record_digest !== canonicalCatalog(request.records)
  ) {
    return denyResult(request.capabilityId, "stale-grant", grant.grant_id, null);
  }
  if (record?.work_scope_required) {
    const scope = request.workScopeRef ?? null;
    if (scope === null || scope !== record.work_scope_ref || scope !== grant.work_scope_ref) {
      return denyResult(request.capabilityId, "work-scope-mismatch", grant.grant_id, null);
    }
  }
  if (
    request.sourceNodeId !== grant.source_node_id ||
    request.targetNodeId !== grant.target_node_id
  ) {
    return denyResult(request.capabilityId, "unauthorized-edge", grant.grant_id, null);
  }
  if (request.requestedEdge != null) {
    const listed = request.edges.some(
      (edge) =>
        edge.from_node === request.requestedEdge?.from_node &&
        edge.to_node === request.requestedEdge?.to_node,
    );
    if (!listed) {
      return denyResult(request.capabilityId, "unauthorized-edge", grant.grant_id, null);
    }
  }
  if (request.policy === null) {
    return denyResult(request.capabilityId, "policy-unavailable", grant.grant_id, null);
  }
  const verdict = policyVerdict(
    request.policy.evaluate({
      capabilityId: request.capabilityId,
      effectClasses: record?.effect_classes ?? grant.effect_classes,
      principalId: request.principalId,
    }),
  );
  if (verdict === "unavailable") {
    return denyResult(
      request.capabilityId,
      "policy-unavailable",
      grant.grant_id,
      request.policy.policy_version,
    );
  }
  if (verdict === "deny") {
    return denyResult(
      request.capabilityId,
      "policy-deny",
      grant.grant_id,
      request.policy.policy_version,
    );
  }
  return allowResult(request.capabilityId, grant.grant_id, request.policy.policy_version);
};

/**
 * Protected preview path. Compatibility mode must not call this. Uses the
 * installed snapshot and authority slot. Does not invent an effect ref.
 */
export const authorizePreviewOperation = (
  operation: PreviewAutomationOperation,
): AuthorizationResult => {
  const capabilityId = previewCapabilityIdForOperation(operation);
  const snapshot = readAdmittedSnapshot();
  const grant = authority.grants.find((row) => row.capability_id === capabilityId);
  return authorizeInvocation({
    capabilityId,
    operation,
    records: snapshot?.records ?? null,
    deltas: snapshot?.deltas ?? [],
    catalogRevision: authority.catalogRevision,
    edges: authority.edges,
    grants: authority.grants,
    policy: authority.policy,
    principalId: PREVIEW_GRANT_PRINCIPAL,
    sourceNodeId: PREVIEW_GRANT_NODE,
    targetNodeId: PREVIEW_GRANT_NODE,
    adapterType: PREVIEW_GRANT_ADAPTER,
    requestedEdge: null,
    workScopeRef: grant?.work_scope_ref ?? null,
    parentCapabilityId: null,
    grantId: grant?.grant_id ?? "",
    now: Date.now(),
  });
};

/**
 * Record what happened after an allow. `completed` without an effect ref
 * throws. `failed` and `uncertain` are stored as given.
 */
export const recordOutcome = (input: {
  readonly correlationId: string;
  readonly capabilityId: string;
  readonly status: OutcomeStatus;
  readonly effectRef?: string | null;
}): OutcomeEvidence => {
  if (input.status === "completed" && (input.effectRef == null || input.effectRef.length === 0)) {
    throw new Error("admission reconcile: completed outcome requires an effect ref");
  }
  const row: OutcomeEvidence = {
    correlation_id: input.correlationId,
    capability_id: input.capabilityId,
    status: input.status,
    effect_ref: input.effectRef ?? null,
  };
  outcomes.push(row);
  return row;
};

/** Copies. Callers cannot mutate the process-local stores. */
export const readDecisions = (): readonly DecisionEvidence[] => [...decisions];

export const readOutcomes = (): readonly OutcomeEvidence[] => [...outcomes];

/** Test and process reset for the decision and outcome stores. */
export const resetAuthorityEvidence = (): void => {
  decisions.length = 0;
  outcomes.length = 0;
};

export const EXECUTION_CLASS_IDS = [
  "local-function",
  "mcp-preview",
  "sdk-api",
  "database",
  "filesystem-git",
  "browser-web",
  "harness-native",
  "compound",
  "scheduled",
  "opaque-third-party",
] as const;

export type ExecutionClassId = (typeof EXECUTION_CLASS_IDS)[number];

export type ClassVerdict = "mediated" | "unsupported-prohibited" | "compatibility-unmediated";

export type ExecutionClassAccount = {
  readonly id: ExecutionClassId;
  readonly entryPoint: string;
  readonly verdict: ClassVerdict;
};

const EXECUTION_CLASS_ROWS: readonly {
  readonly id: ExecutionClassId;
  readonly entryPoint: string;
}[] = [
  {
    id: "local-function",
    entryPoint:
      "ChildProcessSpawner; skill scripts remain C3 discovery rows in discoverSkillEntries and are not spawned by this gate",
  },
  {
    id: "mcp-preview",
    entryPoint:
      "apps/server/src/mcp/toolkits/preview/handlers.ts invokePreviewOperation; host .mcp.json is not this boundary",
  },
  {
    id: "sdk-api",
    entryPoint: "sourceControl GitHub and GitLab clients; no grant check on those calls",
  },
  {
    id: "database",
    entryPoint: "SQLite server state under the T3 home directory; no grant check on those calls",
  },
  {
    id: "filesystem-git",
    entryPoint: "VcsDriver and Git checkpoint; G10 seam selection is not this gate",
  },
  {
    id: "browser-web",
    entryPoint:
      "provider.web_search from discoverProviderNative; preview navigate is the mcp-preview row",
  },
  {
    id: "harness-native",
    entryPoint: "ClaudeAdapter canUseTool and bypassPermissions; this gate does not wrap them",
  },
  {
    id: "compound",
    entryPoint: "authorizeInvocation nested-privilege; no child-process interceptor is installed",
  },
  {
    id: "scheduled",
    entryPoint: "no scheduler principal in this tree is bound to a grant",
  },
  {
    id: "opaque-third-party",
    entryPoint: "C9, C12, and B4 via isOutsideGranularGuarantees",
  },
];

const verdictFor = (id: ExecutionClassId, mode: MediationMode): ClassVerdict => {
  if (id === "mcp-preview" && mode === "protected") return "mediated";
  if (mode === "protected") return "unsupported-prohibited";
  return "compatibility-unmediated";
};

/**
 * Closed account of the ten execution classes. Only preview MCP tool invoke
 * is `mediated`, and only in protected mode. The other nine are
 * `unsupported-prohibited` in protected mode and `compatibility-unmediated`
 * otherwise.
 */
export const executionClassAccount = (mode: MediationMode): readonly ExecutionClassAccount[] =>
  EXECUTION_CLASS_ROWS.map((row) => ({
    id: row.id,
    entryPoint: row.entryPoint,
    verdict: verdictFor(row.id, mode),
  }));

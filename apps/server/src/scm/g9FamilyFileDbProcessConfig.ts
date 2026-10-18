/**
 * G9 WP5 B2 family helpers: file / SQLite / process-config capture.
 *
 * Intended: adapters at live success boundaries project ledger-bounded A, then
 * call captureOccurrence only. No FIFO, clock, tracer, or meter ownership.
 * Observed: builders below emit Task-14 G9CaptureOccurrenceInput shapes; capture*
 * wrappers forward once to the injected live-safe capture fn.
 *
 * W5a: helpers + tests + handoff docs only. Does not edit provider/**,
 * Manager.ts, T2Observability.ts, serverSettings.ts, VcsDriver.ts, relayClient.ts,
 * ws.ts, or Engine. Does not flip g9toG10Authorized. Does not authorize G10.
 *
 * Handoffs (integrators land live hooks): docs/scm/g9/wp5/handoffs/.
 */
import type * as Effect from "effect/Effect";

import type { G9CaptureOccurrenceInput, G9CaptureResult } from "./g9Occurrence.ts";

/**
 * The 18 ledger comm_ids owned by bundle B2 (plan § B2 file-db-process-config).
 * Agent: keep set-equal to plan Ledger comm_ids list; do not invent rows.
 */
export const G9_B2_COMM_IDS = [
  "INV-T2-FILE-ATTACHMENTS",
  "INV-T2-FILE-CHECKPOINTS",
  "INV-T2-FILE-LOGS",
  "INV-T2-FILE-PROVIDER-SESSION",
  "INV-T2-FILE-RUNTIME-STATE",
  "INV-T2-FILE-SECRETS",
  "INV-T2-FILE-SETTINGS",
  "INV-T2-FILE-USAGE-CACHE",
  "INV-T2-FILE-WORKTREES",
  "INV-T2-FLAG-CLOUDFLARED",
  "INV-T2-FLAG-CODEX-LAUNCH",
  "INV-T2-FLAG-SERVER-CONFIG",
  "INV-T2-FLAG-T2-OTEL",
  "INV-T2-FLAG-T3-OTEL",
  "INV-T2-FLAG-TERM-ENV",
  "INV-T2-PROJECT-READ",
  "INV-T2-PROJECT-SQL",
  "INV-T2-SQLITE",
] as const;

export type G9B2CommId = (typeof G9_B2_COMM_IDS)[number];

/**
 * Live-safe capture callback (error channel never).
 * Agent: same contract as G9CaptureService.captureOccurrence; family never owns FIFO.
 */
export type G9B2CaptureFn = (
  input: G9CaptureOccurrenceInput,
) => Effect.Effect<G9CaptureResult | undefined, never>;

/** FILE-LOGS declaration-absence phase: fixture-only; zero live captureOccurrence. */
export const G9_FILE_LOGS_DECLARATION_ABSENCE_PHASE =
  "serverLogPath-declared-no-live-writer" as const;

/**
 * Ledger-bounded repository field per INV-T2-PROJECT-SQL phase (41).
 * Agent: values are equality A projections from coverage-ledger / generated input
 * union. Do not invent phases. Do not put SQL text in A.
 */
export const G9_PROJECT_SQL_PHASE_INPUTS = {
  "ProjectionCheckpoints-upsert-succeeded": { repository: "upsert" as const },
  "ProjectionCheckpoints-listByThreadId-succeeded": {
    repository: "ProjectionCheckpoints" as const,
  },
  "ProjectionCheckpoints-getByThreadAndTurnCount-succeeded": {
    repository: "ProjectionCheckpoints" as const,
  },
  "ProjectionCheckpoints-deleteByThreadId-succeeded": {
    repository: "deleteByThreadId" as const,
  },
  "ProjectionPendingApprovals-upsert-succeeded": { repository: "upsert" as const },
  "ProjectionPendingApprovals-listByThreadId-succeeded": {
    repository: "ProjectionPendingApprovals" as const,
  },
  "ProjectionPendingApprovals-getByRequestId-succeeded": {
    repository: "ProjectionPendingApprovals" as const,
  },
  "ProjectionPendingApprovals-deleteByRequestId-succeeded": {
    repository: "deleteByRequestId" as const,
  },
  "ProjectionProjects-upsert-succeeded": { repository: "upsert" as const },
  "ProjectionProjects-getById-succeeded": {
    repository: "ProjectionProjects" as const,
  },
  "ProjectionProjects-listAll-succeeded": {
    repository: "ProjectionProjects" as const,
  },
  "ProjectionProjects-deleteById-succeeded": { repository: "deleteById" as const },
  "ProjectionState-upsert-succeeded": { repository: "upsert" as const },
  "ProjectionState-getByProjector-succeeded": {
    repository: "ProjectionState" as const,
  },
  "ProjectionState-listAll-succeeded": { repository: "ProjectionState" as const },
  "ProjectionState-minLastAppliedSequence-succeeded": {
    repository: "minLastAppliedSequence" as const,
  },
  "ProjectionThreadActivities-upsert-succeeded": { repository: "upsert" as const },
  "ProjectionThreadActivities-listByThreadId-succeeded": {
    repository: "ProjectionThreadActivities" as const,
  },
  "ProjectionThreadActivities-deleteByThreadId-succeeded": {
    repository: "deleteByThreadId" as const,
  },
  "ProjectionThreadMessages-upsert-succeeded": { repository: "upsert" as const },
  "ProjectionThreadMessages-getByMessageId-succeeded": {
    repository: "ProjectionThreadMessages" as const,
  },
  "ProjectionThreadMessages-listByThreadId-succeeded": {
    repository: "ProjectionThreadMessages" as const,
  },
  "ProjectionThreadMessages-deleteByThreadId-succeeded": {
    repository: "deleteByThreadId" as const,
  },
  "ProjectionThreadProposedPlans-upsert-succeeded": {
    repository: "upsert" as const,
  },
  "ProjectionThreadProposedPlans-listByThreadId-succeeded": {
    repository: "ProjectionThreadProposedPlans" as const,
  },
  "ProjectionThreadProposedPlans-deleteByThreadId-succeeded": {
    repository: "deleteByThreadId" as const,
  },
  "ProjectionThreadSessions-upsert-succeeded": { repository: "upsert" as const },
  "ProjectionThreadSessions-getByThreadId-succeeded": {
    repository: "ProjectionThreadSessions" as const,
  },
  "ProjectionThreadSessions-deleteByThreadId-succeeded": {
    repository: "deleteByThreadId" as const,
  },
  "ProjectionThreads-upsert-succeeded": { repository: "upsert" as const },
  "ProjectionThreads-getById-succeeded": {
    repository: "ProjectionThreads" as const,
  },
  "ProjectionThreads-listByProjectId-succeeded": {
    repository: "ProjectionThreads" as const,
  },
  "ProjectionThreads-deleteById-succeeded": { repository: "deleteById" as const },
  "ProjectionTurns-upsertByTurnId-succeeded": {
    repository: "upsertByTurnId" as const,
  },
  "ProjectionTurns-replacePendingTurnStart-succeeded": {
    repository: "replacePendingTurnStart" as const,
  },
  "ProjectionTurns-getPendingTurnStartByThreadId-succeeded": {
    repository: "ProjectionTurns" as const,
  },
  "ProjectionTurns-deletePendingTurnStartByThreadId-succeeded": {
    repository: "deletePendingTurnStartByThreadId" as const,
  },
  "ProjectionTurns-listByThreadId-succeeded": {
    repository: "ProjectionTurns" as const,
  },
  "ProjectionTurns-getByTurnId-succeeded": {
    repository: "ProjectionTurns" as const,
  },
  "ProjectionTurns-clearCheckpointTurnConflict-succeeded": {
    repository: "clearCheckpointTurnConflict" as const,
  },
  "ProjectionTurns-deleteByThreadId-succeeded": {
    repository: "deleteByThreadId" as const,
  },
} as const;

export type G9ProjectSqlPhaseId = keyof typeof G9_PROJECT_SQL_PHASE_INPUTS;

/** ProjectionSnapshotQuery method domain for INV-T2-PROJECT-READ. */
export type G9ProjectReadMethod =
  | "getCommandReadModel"
  | "getSnapshot"
  | "getShellSnapshot"
  | "getArchivedShellSnapshot"
  | "searchThreads"
  | "getSnapshotSequence"
  | "getCounts"
  | "getActiveProjectByWorkspaceRoot"
  | "getProjectShellById"
  | "getFirstActiveThreadIdByProjectId"
  | "getThreadCheckpointContext"
  | "getFullThreadDiffContext"
  | "getThreadShellById"
  | "getThreadDetailById"
  | "getThreadDetailSnapshot";

/** NodeSqliteClient operation domain for INV-T2-SQLITE. */
export type G9SqliteOperation = "execute" | "executeRaw" | "executeStream";

/** T2 OTEL flag member + state_label (presence/shape only). */
export type G9T2OtelFlagMember =
  | "T2CODE_TRACE_FILE"
  | "T2CODE_OTLP_TRACES_URL"
  | "T2CODE_OTLP_SERVICE_NAME";
export type G9T2OtelFlagState = "configured" | "defaulted" | "absent";

/** Process-flag state_label for codex / cloudflared (no new env parsing). */
export type G9ProcessFlagState = "configured" | "absent";

/**
 * Build INV-T2-PROJECT-SQL capture input for one ledger phase.
 *
 * Parameters
 * ----------
 * phase : G9ProjectSqlPhaseId
 *     Exact ledger phase_id (Projection*-succeeded).
 *
 * Returns
 * -------
 * G9CaptureOccurrenceInput
 *     Closed union member for that phase; repository from G9_PROJECT_SQL_PHASE_INPUTS.
 */
export const buildProjectSqlCaptureInput = (phase: G9ProjectSqlPhaseId): G9CaptureOccurrenceInput =>
  ({
    comm_id: "INV-T2-PROJECT-SQL",
    phase,
    input: G9_PROJECT_SQL_PHASE_INPUTS[phase],
  }) as G9CaptureOccurrenceInput;

/**
 * Build INV-T2-PROJECT-READ / projection-query-succeeded input.
 *
 * Parameters
 * ----------
 * method : G9ProjectReadMethod
 *     Successful ProjectionSnapshotQuery method name (ledger finite domain).
 */
export const buildProjectReadCaptureInput = (
  method: G9ProjectReadMethod,
): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-PROJECT-READ",
  phase: "projection-query-succeeded",
  input: { method },
});

/**
 * Build INV-T2-SQLITE / sqlite-execute-succeeded input.
 *
 * Parameters
 * ----------
 * operation : G9SqliteOperation
 *     Successful NodeSqliteClient op (no SQL text in A).
 */
export const buildSqliteExecuteCaptureInput = (
  operation: G9SqliteOperation,
): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-SQLITE",
  phase: "sqlite-execute-succeeded",
  input: { operation },
});

/** INV-T2-FILE-SETTINGS builders (B2→B1 handoff on serverSettings.ts). */
export const buildSettingsFileExistsCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FILE-SETTINGS",
  phase: "settings-file-exists-succeeded",
  input: { operation: "succeeded" },
});

export const buildSettingsFileReadCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FILE-SETTINGS",
  phase: "settings-file-read-succeeded",
  input: { operation: "succeeded" },
});

export const buildSettingsFileWriteCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FILE-SETTINGS",
  phase: "settings-file-write-succeeded",
  input: { operation: "write" },
});

/** INV-T2-FILE-RUNTIME-STATE builders (B2-owned live surfaces). */
export const buildRuntimeStateWriteCaptureInput = (
  member_id:
    | "serverRuntimeStatePath"
    | "environmentIdPath"
    | "anonymousIdPath"
    | "keybindingsConfigPath",
): G9CaptureOccurrenceInput => {
  switch (member_id) {
    case "serverRuntimeStatePath":
      return {
        comm_id: "INV-T2-FILE-RUNTIME-STATE",
        phase: "serverRuntimeStatePath-write-succeeded",
        input: { member_id: "serverRuntimeStatePath" },
      };
    case "environmentIdPath":
      return {
        comm_id: "INV-T2-FILE-RUNTIME-STATE",
        phase: "environmentIdPath-write-succeeded",
        input: { member_id: "environmentIdPath" },
      };
    case "anonymousIdPath":
      return {
        comm_id: "INV-T2-FILE-RUNTIME-STATE",
        phase: "anonymousIdPath-write-succeeded",
        input: { member_id: "anonymousIdPath" },
      };
    case "keybindingsConfigPath":
      return {
        comm_id: "INV-T2-FILE-RUNTIME-STATE",
        phase: "keybindingsConfigPath-write-succeeded",
        input: { member_id: "keybindingsConfigPath" },
      };
    default: {
      const _exhaustive: never = member_id;
      return _exhaustive;
    }
  }
};

/** INV-T2-FILE-WORKTREES builders (GitVcsDriverCore). */
export const buildWorktreeCreateCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FILE-WORKTREES",
  phase: "worktree-create-succeeded",
  input: { comm_id: "worktree-create-succeeded" },
});

export const buildWorktreeRemoveCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FILE-WORKTREES",
  phase: "worktree-remove-succeeded",
  input: { comm_id: "worktree-remove-succeeded" },
});

/** INV-T2-FILE-ATTACHMENTS / attachment-write-succeeded. */
export const buildAttachmentWriteCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FILE-ATTACHMENTS",
  phase: "attachment-write-succeeded",
  input: { site: "writeFile" },
});

/** INV-T2-FILE-USAGE-CACHE / usage-cache-persisted. */
export const buildUsageCachePersistedCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FILE-USAGE-CACHE",
  phase: "usage-cache-persisted",
  input: { comm_id: "present" },
});

/** INV-T2-FILE-SECRETS / secret-store-persisted. */
export const buildSecretStorePersistedCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FILE-SECRETS",
  phase: "secret-store-persisted",
  input: { comm_id: "present" },
});

/**
 * INV-T2-FILE-CHECKPOINTS builders (B2→B3 handoff; live success in GitVcsDriver).
 *
 * Parameters
 * ----------
 * operation : checkpoint op name matching ledger phase (hasCheckpointRef → "succeeded").
 */
export const buildCheckpointCaptureInput = (
  operation:
    | "captureCheckpoint"
    | "restoreCheckpoint"
    | "diffCheckpoints"
    | "deleteCheckpointRefs"
    | "hasCheckpointRef",
): G9CaptureOccurrenceInput => {
  switch (operation) {
    case "captureCheckpoint":
      return {
        comm_id: "INV-T2-FILE-CHECKPOINTS",
        phase: "checkpoint-captureCheckpoint-succeeded",
        input: { operation: "captureCheckpoint" },
      };
    case "restoreCheckpoint":
      return {
        comm_id: "INV-T2-FILE-CHECKPOINTS",
        phase: "checkpoint-restoreCheckpoint-succeeded",
        input: { operation: "restoreCheckpoint" },
      };
    case "diffCheckpoints":
      return {
        comm_id: "INV-T2-FILE-CHECKPOINTS",
        phase: "checkpoint-diffCheckpoints-succeeded",
        input: { operation: "diffCheckpoints" },
      };
    case "deleteCheckpointRefs":
      return {
        comm_id: "INV-T2-FILE-CHECKPOINTS",
        phase: "checkpoint-deleteCheckpointRefs-succeeded",
        input: { operation: "deleteCheckpointRefs" },
      };
    case "hasCheckpointRef":
      return {
        comm_id: "INV-T2-FILE-CHECKPOINTS",
        phase: "checkpoint-hasCheckpointRef-succeeded",
        input: { operation: "succeeded" },
      };
    default: {
      const _exhaustive: never = operation;
      return _exhaustive;
    }
  }
};

/**
 * INV-T2-FILE-PROVIDER-SESSION builders.
 * Cache read/write → B2→B4 handoff; binding ops → ProviderSessionRuntime (B2 may land).
 */
export const buildProviderStatusCacheReadCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FILE-PROVIDER-SESSION",
  phase: "provider-status-cache-read-succeeded",
  input: { member_id: "provider-status-cache" },
});

export const buildProviderStatusCacheWriteCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FILE-PROVIDER-SESSION",
  phase: "provider-status-cache-write-succeeded",
  input: { member_id: "write" },
});

export const buildProviderSessionBindingCaptureInput = (
  op: "upsert" | "getByThreadId" | "list" | "deleteByThreadId",
): G9CaptureOccurrenceInput => {
  switch (op) {
    case "upsert":
      return {
        comm_id: "INV-T2-FILE-PROVIDER-SESSION",
        phase: "provider-session-binding-upsert-succeeded",
        input: { member_id: "upsert" },
      };
    case "getByThreadId":
      return {
        comm_id: "INV-T2-FILE-PROVIDER-SESSION",
        phase: "provider-session-binding-getByThreadId-succeeded",
        input: { member_id: "provider-session-binding" },
      };
    case "list":
      return {
        comm_id: "INV-T2-FILE-PROVIDER-SESSION",
        phase: "provider-session-binding-list-succeeded",
        input: { member_id: "provider-session-binding" },
      };
    case "deleteByThreadId":
      return {
        comm_id: "INV-T2-FILE-PROVIDER-SESSION",
        phase: "provider-session-binding-deleteByThreadId-succeeded",
        input: { member_id: "deleteByThreadId" },
      };
    default: {
      const _exhaustive: never = op;
      return _exhaustive;
    }
  }
};

/**
 * INV-T2-FILE-LOGS builders.
 * Agent: serverLogPath-declared-no-live-writer is declaration-absence; do not call
 * captureOccurrence in production. Use buildFileLogsDeclarationAbsenceInput only
 * in fixture/assert drivers.
 */
export const buildFileLogsDirCreateCaptureInput = (
  member_id: "logsDir" | "providerLogsDir" | "terminalLogsDir",
): G9CaptureOccurrenceInput => {
  switch (member_id) {
    case "logsDir":
      return {
        comm_id: "INV-T2-FILE-LOGS",
        phase: "logsDir-directory-create-succeeded",
        input: { member_id: "logsDir" },
      };
    case "providerLogsDir":
      return {
        comm_id: "INV-T2-FILE-LOGS",
        phase: "providerLogsDir-directory-create-succeeded",
        input: { member_id: "providerLogsDir" },
      };
    case "terminalLogsDir":
      return {
        comm_id: "INV-T2-FILE-LOGS",
        phase: "terminalLogsDir-directory-create-succeeded",
        input: { member_id: "terminalLogsDir" },
      };
    default: {
      const _exhaustive: never = member_id;
      return _exhaustive;
    }
  }
};

/** B2→B4: providerEventLogPath writer success. */
export const buildProviderEventLogWriterCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FILE-LOGS",
  phase: "providerEventLogPath-writer-succeeded",
  input: { member_id: "providerEventLogPath" },
});

/** B2→B5: terminalLogs writer success. */
export const buildTerminalLogsWriterCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FILE-LOGS",
  phase: "terminalLogs-writer-succeeded",
  input: { member_id: "terminalLogs" },
});

/**
 * Fixture-only input for declaration-absence phase.
 * Agent: coordinator rejects enqueue; production must not call captureOccurrence.
 */
export const buildFileLogsDeclarationAbsenceInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FILE-LOGS",
  phase: "serverLogPath-declared-no-live-writer",
  input: { member_id: "serverLogPath" },
});

/** True when phase is the FILE-LOGS declaration-absence row. */
export const isFileLogsDeclarationAbsencePhase = (phase: string): boolean =>
  phase === G9_FILE_LOGS_DECLARATION_ABSENCE_PHASE;

/** INV-T2-FLAG-T2-OTEL / flag-resolved (B2→WP6 handoff on T2Observability.ts). */
export const buildFlagT2OtelResolvedCaptureInput = (
  member: G9T2OtelFlagMember,
  state_label: G9T2OtelFlagState,
): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FLAG-T2-OTEL",
  phase: "flag-resolved",
  input: { member, state_label },
});

/** INV-T2-FLAG-T3-OTEL / flag-resolved (canonical absence; cli/config). */
export const buildFlagT3OtelResolvedCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FLAG-T3-OTEL",
  phase: "flag-resolved",
  input: { comm_id: "resolved" },
});

/** INV-T2-FLAG-SERVER-CONFIG / flag-resolved (canonical absence; cli/config). */
export const buildFlagServerConfigResolvedCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FLAG-SERVER-CONFIG",
  phase: "flag-resolved",
  input: { comm_id: "resolved" },
});

/** INV-T2-FLAG-CODEX-LAUNCH / flag-resolved (B2→B4 handoff). */
export const buildFlagCodexLaunchResolvedCaptureInput = (
  state_label: G9ProcessFlagState,
): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FLAG-CODEX-LAUNCH",
  phase: "flag-resolved",
  input: { member: "T3CODE_CODEX_LAUNCH_ARGS", state_label },
});

/** INV-T2-FLAG-CLOUDFLARED / flag-resolved (B2→B3 handoff on relayClient.ts). */
export const buildFlagCloudflaredResolvedCaptureInput = (
  state_label: G9ProcessFlagState,
): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FLAG-CLOUDFLARED",
  phase: "flag-resolved",
  input: { member: "T3CODE_CLOUDFLARED_PATH", state_label },
});

/** INV-T2-FLAG-TERM-ENV / terminal-child-env-filtered (B2→B5 handoff). */
export const buildFlagTermEnvFilteredCaptureInput = (): G9CaptureOccurrenceInput => ({
  comm_id: "INV-T2-FLAG-TERM-ENV",
  phase: "terminal-child-env-filtered",
  input: { kind: "terminal-child-env-filtered" },
});

/**
 * Call captureOccurrence once with a pre-built B2 input.
 *
 * Intended: live success → one call; family never enqueues itself.
 * Observed: returns whatever the injected capture returns (typically void via asVoid).
 *
 * Parameters
 * ----------
 * input : G9CaptureOccurrenceInput
 *     Builder output (must be a B2 ledger pair).
 * capture : G9B2CaptureFn
 *     Live-safe captureOccurrence.
 */
export const captureB2Occurrence = (
  input: G9CaptureOccurrenceInput,
  capture: G9B2CaptureFn,
): Effect.Effect<G9CaptureResult | undefined, never> => capture(input);

/**
 * Refuse live capture for FILE-LOGS declaration-absence.
 *
 * Agent: returns undefined without invoking capture. Integrators must not wire
 * a production writer for serverLogPath.
 */
export const refuseFileLogsDeclarationAbsenceLiveCapture = (_capture: G9B2CaptureFn): undefined =>
  undefined;

/** Capture wrappers used by handoff docs (named for integrator import). */

export const captureProjectSqlSucceeded = (phase: G9ProjectSqlPhaseId, capture: G9B2CaptureFn) =>
  captureB2Occurrence(buildProjectSqlCaptureInput(phase), capture);

export const captureProjectReadSucceeded = (method: G9ProjectReadMethod, capture: G9B2CaptureFn) =>
  captureB2Occurrence(buildProjectReadCaptureInput(method), capture);

export const captureSqliteExecuteSucceeded = (
  operation: G9SqliteOperation,
  capture: G9B2CaptureFn,
) => captureB2Occurrence(buildSqliteExecuteCaptureInput(operation), capture);

export const captureSettingsFileExistsSucceeded = (capture: G9B2CaptureFn) =>
  captureB2Occurrence(buildSettingsFileExistsCaptureInput(), capture);

export const captureSettingsFileReadSucceeded = (capture: G9B2CaptureFn) =>
  captureB2Occurrence(buildSettingsFileReadCaptureInput(), capture);

export const captureSettingsFileWriteSucceeded = (capture: G9B2CaptureFn) =>
  captureB2Occurrence(buildSettingsFileWriteCaptureInput(), capture);

export const captureCheckpointSucceeded = (
  operation:
    | "captureCheckpoint"
    | "restoreCheckpoint"
    | "diffCheckpoints"
    | "deleteCheckpointRefs"
    | "hasCheckpointRef",
  capture: G9B2CaptureFn,
) => captureB2Occurrence(buildCheckpointCaptureInput(operation), capture);

export const captureProviderStatusCacheReadSucceeded = (capture: G9B2CaptureFn) =>
  captureB2Occurrence(buildProviderStatusCacheReadCaptureInput(), capture);

export const captureProviderStatusCacheWriteSucceeded = (capture: G9B2CaptureFn) =>
  captureB2Occurrence(buildProviderStatusCacheWriteCaptureInput(), capture);

export const captureProviderEventLogWriterSucceeded = (capture: G9B2CaptureFn) =>
  captureB2Occurrence(buildProviderEventLogWriterCaptureInput(), capture);

export const captureTerminalLogsWriterSucceeded = (capture: G9B2CaptureFn) =>
  captureB2Occurrence(buildTerminalLogsWriterCaptureInput(), capture);

export const captureFlagTermEnvFiltered = (capture: G9B2CaptureFn) =>
  captureB2Occurrence(buildFlagTermEnvFilteredCaptureInput(), capture);

export const captureFlagCodexLaunchResolved = (
  state_label: G9ProcessFlagState,
  capture: G9B2CaptureFn,
) => captureB2Occurrence(buildFlagCodexLaunchResolvedCaptureInput(state_label), capture);

export const captureFlagCloudflaredResolved = (
  state_label: G9ProcessFlagState,
  capture: G9B2CaptureFn,
) => captureB2Occurrence(buildFlagCloudflaredResolvedCaptureInput(state_label), capture);

export const captureFlagT2OtelResolved = (
  member: G9T2OtelFlagMember,
  state_label: G9T2OtelFlagState,
  capture: G9B2CaptureFn,
) => captureB2Occurrence(buildFlagT2OtelResolvedCaptureInput(member, state_label), capture);

/**
 * List every PROJECT-SQL phase id (41). Agent: fan-out tests / completeness checks.
 */
export const listProjectSqlPhaseIds = (): ReadonlyArray<G9ProjectSqlPhaseId> =>
  Object.keys(G9_PROJECT_SQL_PHASE_INPUTS) as G9ProjectSqlPhaseId[];

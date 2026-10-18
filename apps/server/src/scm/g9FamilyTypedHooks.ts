/**
 * G9 WP6 typed-hook family (W6-FAMILY / WP6-Hook-Family-Owner).
 *
 * Intended: map Effect patch seams (RpcServerRequestHooks, HttpSessionHooks,
 * ExportHooks) to ledger-bounded captureOccurrence via G9CaptureService
 * (live-safe never channel). Absent G9CaptureService ⇒ no-op. A carries method /
 * site / signal labels only — never payloads, OTLP bodies, or tokens.
 *
 * Also exports Layer.provide helpers for W6-CONSUMER sole landers (ws.ts,
 * McpHttpServer.ts, Observability.ts) and a T2 OTLP SDK-path helper (not
 * Effect ExportHooks). Re-exports B4 MCP non-hook + B1 ORCH-LIVE handoff
 * helpers for the same consumer wave.
 *
 * Observed: builders below project closed method partitions; unknown tags
 * no-op. Does not edit Effect patch, server.ts, or consumer files. Does not
 * flip g9toG10Authorized. Does not authorize G10.
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as OtlpExporter from "effect/unstable/observability/OtlpExporter";
import * as RpcServer from "effect/unstable/rpc/RpcServer";

import type {
  G9RpcAdmitA,
  G9RpcAdmitA_INV_T2_ORCH_RPC_rpc_request_admitted,
  G9RpcAdmitA_INV_T2_RPC_STREAM_AUTH_rpc_request_admitted,
  G9RpcAdmitA_INV_T2_RPC_STREAM_CONFIG_rpc_request_admitted,
  G9RpcAdmitA_INV_T2_RPC_STREAM_DISCOVERY_rpc_request_admitted,
  G9RpcAdmitA_INV_T2_RPC_STREAM_ORCH_rpc_request_admitted,
  G9RpcAdmitA_INV_T2_RPC_STREAM_TEL_rpc_request_admitted,
  G9RpcAdmitA_INV_T2_RPC_STREAM_TERM_rpc_request_admitted,
  G9RpcStreamElementA,
  G9RpcUnarySuccessA,
} from "./g9EqualityA.generated.ts";
import {
  G9_B4_MCP_HTTP_NON_HOOK_HANDOFF,
  captureMcpHttpHandlerSucceeded,
  captureMcpHttpMessageAdmitted,
} from "./g9FamilyProviderProtocol.ts";
import {
  G9_B1_ORCH_LIVE_WS_HANDOFF,
  buildOrchLiveCaptureInput,
  captureOrchLiveIfOfferAccepted,
} from "./g9FamilyQueuePubSubCallback.ts";
import { G9CaptureService, type G9CaptureServiceShape } from "./g9OrchQueueCapture.ts";
import type { G9CaptureOccurrenceInput } from "./g9Occurrence.ts";

/** WP6 typed-hook + OTLP full-row comm_ids (RpcServer partitions + MCP delete + OTLP). */
export const WP6_TYPED_HOOK_COMM_IDS = [
  "INV-T2-RPC-WS",
  "INV-T2-ORCH-RPC",
  "INV-T2-RPC-STREAM-TERM",
  "INV-T2-RPC-STREAM-ORCH",
  "INV-T2-RPC-STREAM-TEL",
  "INV-T2-RPC-STREAM-AUTH",
  "INV-T2-RPC-STREAM-CONFIG",
  "INV-T2-RPC-STREAM-DISCOVERY",
  "INV-T2-MCP-HTTP",
  "INV-T2-TEL-T3-OTLP",
  "INV-T2-TEL-T2-OTLP",
] as const;

export type G9Wp6CommId = (typeof WP6_TYPED_HOOK_COMM_IDS)[number];

/** WP6-callable capture inputs (RpcServer + MCP delete + T2/T3 OTLP). */
export type G9Wp6CaptureOccurrenceInput = Extract<
  G9CaptureOccurrenceInput,
  { readonly comm_id: G9Wp6CommId }
>;

/** Live-safe capture function (error channel never). */
export type G9Wp6CaptureFn = G9CaptureServiceShape["captureOccurrence"];

/** Effect exporter labels that map to INV-T2-TEL-T3-OTLP signals. */
export const G9_T3_OTLP_EXPORTER_LABELS = {
  traces: "OtlpTracer",
  metrics: "OtlpMetrics",
} as const;

/**
 * Consumer integration surface for W6-CONSUMER (re-exports + Layer names).
 *
 * Agent: wire Layers into ws / McpHttpServer / Observability. Call T2 SDK helper
 * from T2Observability after filtered export success. Land B4 MCP non-hook and
 * B1 ORCH-LIVE helpers on their sole-lander files (not here).
 */
export const G9_WP6_TYPED_HOOKS_CONSUMER_HANDOFF = {
  lander: "WP6-Consumer-Owner",
  family_module: "apps/server/src/scm/g9FamilyTypedHooks.ts",
  layers: {
    rpc: "G9RpcServerRequestHooksLayer",
    mcp_session: "G9McpHttpSessionHooksLayer",
    t3_otlp: "G9T3OtlpExportHooksLayer",
  },
  consumer_files: {
    ws: "apps/server/src/ws.ts",
    mcp: "apps/server/src/mcp/McpHttpServer.ts",
    t3_otlp: "apps/server/src/observability/Layers/Observability.ts",
    t2_otlp: "apps/server/src/t2Observability/T2Observability.ts",
  },
  helpers: {
    t2_otlp: "captureT2OtlpExportSucceeded",
    mcp_delete: "captureMcpHttpSessionDeleted",
    mcp_message_admitted: "captureMcpHttpMessageAdmitted",
    mcp_handler_succeeded: "captureMcpHttpHandlerSucceeded",
    orch_live: "captureOrchLiveIfOfferAccepted",
  },
  b4_mcp_handoff: G9_B4_MCP_HTTP_NON_HOOK_HANDOFF,
  b1_orch_live_handoff: G9_B1_ORCH_LIVE_WS_HANDOFF,
} as const;

// Re-export consumer handoff helpers (B4 non-hook MCP + B1 ORCH-LIVE).
export {
  G9_B1_ORCH_LIVE_WS_HANDOFF,
  G9_B4_MCP_HTTP_NON_HOOK_HANDOFF,
  buildOrchLiveCaptureInput,
  captureMcpHttpHandlerSucceeded,
  captureMcpHttpMessageAdmitted,
  captureOrchLiveIfOfferAccepted,
};

/** Ledger method tags for G9RpcAdmitA (method-only A). */
const RPC_WS_ADMIT_METHODS = [
  "server.probe",
  "server.getConfig",
  "server.refreshProviders",
  "server.updateProvider",
  "server.updateServer",
  "server.upsertKeybinding",
  "server.removeKeybinding",
  "server.getSettings",
  "server.updateSettings",
  "server.discoverSourceControl",
  "server.getTraceDiagnostics",
  "server.getProcessDiagnostics",
  "server.getProcessResourceHistory",
  "server.getResourceTelemetryHistory",
  "server.retryResourceTelemetry",
  "server.getUsageSummary",
  "server.signalProcess",
  "server.reportClientActivity",
  "server.reportHostPowerState",
  "server.getBackgroundPolicy",
  "cloud.getRelayClientStatus",
  "pullRequests.list",
  "pullRequests.listStats",
  "pullRequests.detail",
  "pullRequests.activity",
  "pullRequests.diffFileContents",
  "pullRequests.runAction",
  "pullRequests.update",
  "pullRequests.comment",
  "pullRequests.updateComment",
  "pullRequests.submitReview",
  "pullRequests.replyToThread",
  "pullRequests.setThreadResolution",
  "pullRequests.setReaction",
  "pullRequests.invalidate",
  "pullRequests.reviewerCandidates",
  "pullRequests.requestReviewers",
  "sourceControl.lookupRepository",
  "sourceControl.cloneRepository",
  "sourceControl.publishRepository",
  "projects.listEntries",
  "projects.readFile",
  "projects.searchContents",
  "projects.searchEntries",
  "projects.writeFile",
  "shell.openInEditor",
  "filesystem.browse",
  "assets.createUrl",
  "vcs.pull",
  "vcs.refreshStatus",
  "git.resolvePullRequest",
  "git.preparePullRequestThread",
  "vcs.listRefs",
  "vcs.createWorktree",
  "vcs.removeWorktree",
  "vcs.createRef",
  "vcs.switchRef",
  "vcs.init",
  "review.getDiffPreview",
  "review.getDiffFileContents",
  "terminal.open",
  "terminal.write",
  "terminal.resize",
  "terminal.clear",
  "terminal.restart",
  "terminal.close",
  "preview.open",
  "preview.navigate",
  "preview.resize",
  "preview.refresh",
  "preview.close",
  "preview.list",
  "preview.reportStatus",
  "previewAutomation.respond",
  "previewAutomation.focusHost",
  "server.updateServerWithProgress",
  "cloud.installRelayClient",
  "git.runStackedAction",
  "terminal.attach",
  "previewAutomation.connect",
] as const satisfies readonly G9RpcAdmitA["method"][];

const RPC_WS_ADMIT_METHODS_SET: ReadonlySet<string> = new Set(RPC_WS_ADMIT_METHODS);

/** Ledger method tags for G9RpcUnarySuccessA (method-only A). */
const RPC_WS_UNARY_METHODS = [
  "server.probe",
  "server.getConfig",
  "server.refreshProviders",
  "server.updateProvider",
  "server.updateServer",
  "server.upsertKeybinding",
  "server.removeKeybinding",
  "server.getSettings",
  "server.updateSettings",
  "server.discoverSourceControl",
  "server.getTraceDiagnostics",
  "server.getProcessDiagnostics",
  "server.getProcessResourceHistory",
  "server.getResourceTelemetryHistory",
  "server.retryResourceTelemetry",
  "server.getUsageSummary",
  "server.signalProcess",
  "server.reportClientActivity",
  "server.reportHostPowerState",
  "server.getBackgroundPolicy",
  "cloud.getRelayClientStatus",
  "pullRequests.list",
  "pullRequests.listStats",
  "pullRequests.detail",
  "pullRequests.activity",
  "pullRequests.diffFileContents",
  "pullRequests.runAction",
  "pullRequests.update",
  "pullRequests.comment",
  "pullRequests.updateComment",
  "pullRequests.submitReview",
  "pullRequests.replyToThread",
  "pullRequests.setThreadResolution",
  "pullRequests.setReaction",
  "pullRequests.invalidate",
  "pullRequests.reviewerCandidates",
  "pullRequests.requestReviewers",
  "sourceControl.lookupRepository",
  "sourceControl.cloneRepository",
  "sourceControl.publishRepository",
  "projects.listEntries",
  "projects.readFile",
  "projects.searchContents",
  "projects.searchEntries",
  "projects.writeFile",
  "shell.openInEditor",
  "filesystem.browse",
  "assets.createUrl",
  "vcs.pull",
  "vcs.refreshStatus",
  "git.resolvePullRequest",
  "git.preparePullRequestThread",
  "vcs.listRefs",
  "vcs.createWorktree",
  "vcs.removeWorktree",
  "vcs.createRef",
  "vcs.switchRef",
  "vcs.init",
  "review.getDiffPreview",
  "review.getDiffFileContents",
  "terminal.open",
  "terminal.write",
  "terminal.resize",
  "terminal.clear",
  "terminal.restart",
  "terminal.close",
  "preview.open",
  "preview.navigate",
  "preview.resize",
  "preview.refresh",
  "preview.close",
  "preview.list",
  "preview.reportStatus",
  "previewAutomation.respond",
  "previewAutomation.focusHost",
] as const satisfies readonly G9RpcUnarySuccessA["method"][];

const RPC_WS_UNARY_METHODS_SET: ReadonlySet<string> = new Set(RPC_WS_UNARY_METHODS);

/** Ledger method tags for G9RpcStreamElementA (method-only A). */
const RPC_WS_STREAM_METHODS = [
  "server.updateServerWithProgress",
  "cloud.installRelayClient",
  "git.runStackedAction",
  "terminal.attach",
  "previewAutomation.connect",
] as const satisfies readonly G9RpcStreamElementA["method"][];

const RPC_WS_STREAM_METHODS_SET: ReadonlySet<string> = new Set(RPC_WS_STREAM_METHODS);

/** Ledger method tags for G9RpcAdmitA_INV_T2_ORCH_RPC_rpc_request_admitted (method-only A). */
const ORCH_RPC_METHODS = [
  "orchestration.dispatchCommand",
  "orchestration.getWorkflowScript",
  "orchestration.getTurnDiff",
  "orchestration.getFullThreadDiff",
  "orchestration.searchThreads",
  "orchestration.getArchivedShellSnapshot",
] as const satisfies readonly G9RpcAdmitA_INV_T2_ORCH_RPC_rpc_request_admitted["method"][];

const ORCH_RPC_METHODS_SET: ReadonlySet<string> = new Set(ORCH_RPC_METHODS);

/** Ledger method tags for G9RpcAdmitA_INV_T2_RPC_STREAM_TERM_rpc_request_admitted (method-only A). */
const STREAM_TERM_METHODS = [
  "subscribeTerminalEvents",
  "subscribeTerminalMetadata",
] as const satisfies readonly G9RpcAdmitA_INV_T2_RPC_STREAM_TERM_rpc_request_admitted["method"][];

const STREAM_TERM_METHODS_SET: ReadonlySet<string> = new Set(STREAM_TERM_METHODS);

/** Ledger method tags for G9RpcAdmitA_INV_T2_RPC_STREAM_ORCH_rpc_request_admitted (method-only A). */
const STREAM_ORCH_METHODS = [
  "orchestration.subscribeShell",
  "orchestration.subscribeThread",
] as const satisfies readonly G9RpcAdmitA_INV_T2_RPC_STREAM_ORCH_rpc_request_admitted["method"][];

const STREAM_ORCH_METHODS_SET: ReadonlySet<string> = new Set(STREAM_ORCH_METHODS);

/** Ledger method tags for G9RpcAdmitA_INV_T2_RPC_STREAM_TEL_rpc_request_admitted (method-only A). */
const STREAM_TEL_METHODS = [
  "subscribeResourceTelemetry",
] as const satisfies readonly G9RpcAdmitA_INV_T2_RPC_STREAM_TEL_rpc_request_admitted["method"][];

const STREAM_TEL_METHODS_SET: ReadonlySet<string> = new Set(STREAM_TEL_METHODS);

/** Ledger method tags for G9RpcAdmitA_INV_T2_RPC_STREAM_AUTH_rpc_request_admitted (method-only A). */
const STREAM_AUTH_METHODS = [
  "subscribeAuthAccess",
  "subscribeBackgroundPolicy",
] as const satisfies readonly G9RpcAdmitA_INV_T2_RPC_STREAM_AUTH_rpc_request_admitted["method"][];

const STREAM_AUTH_METHODS_SET: ReadonlySet<string> = new Set(STREAM_AUTH_METHODS);

/** Ledger method tags for G9RpcAdmitA_INV_T2_RPC_STREAM_CONFIG_rpc_request_admitted (method-only A). */
const STREAM_CONFIG_METHODS = [
  "subscribeServerConfig",
  "subscribeServerLifecycle",
] as const satisfies readonly G9RpcAdmitA_INV_T2_RPC_STREAM_CONFIG_rpc_request_admitted["method"][];

const STREAM_CONFIG_METHODS_SET: ReadonlySet<string> = new Set(STREAM_CONFIG_METHODS);

/** Ledger method tags for G9RpcAdmitA_INV_T2_RPC_STREAM_DISCOVERY_rpc_request_admitted (method-only A). */
const STREAM_DISCOVERY_METHODS = [
  "subscribeVcsStatus",
  "subscribePreviewEvents",
  "subscribeDiscoveredLocalServers",
] as const satisfies readonly G9RpcAdmitA_INV_T2_RPC_STREAM_DISCOVERY_rpc_request_admitted["method"][];

const STREAM_DISCOVERY_METHODS_SET: ReadonlySet<string> = new Set(STREAM_DISCOVERY_METHODS);

/**
 * Optional G9CaptureService gate for WP6 hook callbacks and SDK helpers.
 *
 * Agent: Effect.serviceOption(G9CaptureService). Absent ⇒ Effect.void (live
 * unchanged). Present ⇒ `run` receives captureOccurrence only.
 */
export const withOptionalG9Capture = (
  run: (capture: G9Wp6CaptureFn) => Effect.Effect<void, never>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const capture = yield* Effect.serviceOption(G9CaptureService);
    if (Option.isNone(capture)) {
      return;
    }
    yield* run((input) => capture.value.captureOccurrence(input));
  });

/**
 * Sole WP6 capture path. Projects already-bounded input into live-safe capture.
 */
export const captureTypedHooksOccurrence = (
  capture: G9Wp6CaptureFn,
  input: G9Wp6CaptureOccurrenceInput,
): Effect.Effect<void, never> => capture(input).pipe(Effect.asVoid);

/**
 * Shared OTLP post-success eligibility (SCM-only + empty batch excluded).
 *
 * Parameters
 * ----------
 * batchSize : number
 *     Exported item count after filterStatusOk / SDK success.
 * scmOnlyBatch : boolean
 *     True when the filtered batch is SCM-only (ledger exclusion).
 */
export const isCapturableOtlpExportBatch = (args: {
  readonly batchSize: number;
  readonly scmOnlyBatch?: boolean;
}): boolean => args.batchSize > 0 && args.scmOnlyBatch !== true;

/** Build rpc-request-admitted input from a registered method tag, or undefined. */
export const buildRpcAdmitCaptureInput = (
  tag: string,
): Extract<G9Wp6CaptureOccurrenceInput, { readonly phase: "rpc-request-admitted" }> | undefined => {
  if (RPC_WS_ADMIT_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-WS",
      phase: "rpc-request-admitted",
      input: { method: tag as G9RpcAdmitA["method"] },
    };
  }
  if (ORCH_RPC_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-ORCH-RPC",
      phase: "rpc-request-admitted",
      input: { method: tag as G9RpcAdmitA_INV_T2_ORCH_RPC_rpc_request_admitted["method"] },
    };
  }
  if (STREAM_TERM_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-STREAM-TERM",
      phase: "rpc-request-admitted",
      input: { method: tag as G9RpcAdmitA_INV_T2_RPC_STREAM_TERM_rpc_request_admitted["method"] },
    };
  }
  if (STREAM_ORCH_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-STREAM-ORCH",
      phase: "rpc-request-admitted",
      input: { method: tag as G9RpcAdmitA_INV_T2_RPC_STREAM_ORCH_rpc_request_admitted["method"] },
    };
  }
  if (STREAM_TEL_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-STREAM-TEL",
      phase: "rpc-request-admitted",
      input: { method: tag as G9RpcAdmitA_INV_T2_RPC_STREAM_TEL_rpc_request_admitted["method"] },
    };
  }
  if (STREAM_AUTH_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-STREAM-AUTH",
      phase: "rpc-request-admitted",
      input: { method: tag as G9RpcAdmitA_INV_T2_RPC_STREAM_AUTH_rpc_request_admitted["method"] },
    };
  }
  if (STREAM_CONFIG_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-STREAM-CONFIG",
      phase: "rpc-request-admitted",
      input: { method: tag as G9RpcAdmitA_INV_T2_RPC_STREAM_CONFIG_rpc_request_admitted["method"] },
    };
  }
  if (STREAM_DISCOVERY_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-STREAM-DISCOVERY",
      phase: "rpc-request-admitted",
      input: {
        method: tag as G9RpcAdmitA_INV_T2_RPC_STREAM_DISCOVERY_rpc_request_admitted["method"],
      },
    };
  }
  return undefined;
};

/** Build rpc-handler-succeeded input (unary partition only), or undefined. */
export const buildRpcUnarySuccessCaptureInput = (
  tag: string,
):
  | Extract<G9Wp6CaptureOccurrenceInput, { readonly phase: "rpc-handler-succeeded" }>
  | undefined => {
  if (RPC_WS_UNARY_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-WS",
      phase: "rpc-handler-succeeded",
      input: { method: tag as G9RpcUnarySuccessA["method"] },
    };
  }
  if (ORCH_RPC_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-ORCH-RPC",
      phase: "rpc-handler-succeeded",
      input: { method: tag as G9RpcAdmitA_INV_T2_ORCH_RPC_rpc_request_admitted["method"] },
    };
  }
  return undefined;
};

/** Build rpc-stream-element-emitted input, or undefined. */
export const buildRpcStreamElementCaptureInput = (
  tag: string,
):
  | Extract<G9Wp6CaptureOccurrenceInput, { readonly phase: "rpc-stream-element-emitted" }>
  | undefined => {
  if (RPC_WS_STREAM_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-WS",
      phase: "rpc-stream-element-emitted",
      input: { method: tag as G9RpcStreamElementA["method"] },
    };
  }
  if (STREAM_TERM_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-STREAM-TERM",
      phase: "rpc-stream-element-emitted",
      input: { method: tag as G9RpcAdmitA_INV_T2_RPC_STREAM_TERM_rpc_request_admitted["method"] },
    };
  }
  if (STREAM_ORCH_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-STREAM-ORCH",
      phase: "rpc-stream-element-emitted",
      input: { method: tag as G9RpcAdmitA_INV_T2_RPC_STREAM_ORCH_rpc_request_admitted["method"] },
    };
  }
  if (STREAM_TEL_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-STREAM-TEL",
      phase: "rpc-stream-element-emitted",
      input: { method: tag as G9RpcAdmitA_INV_T2_RPC_STREAM_TEL_rpc_request_admitted["method"] },
    };
  }
  if (STREAM_AUTH_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-STREAM-AUTH",
      phase: "rpc-stream-element-emitted",
      input: { method: tag as G9RpcAdmitA_INV_T2_RPC_STREAM_AUTH_rpc_request_admitted["method"] },
    };
  }
  if (STREAM_CONFIG_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-STREAM-CONFIG",
      phase: "rpc-stream-element-emitted",
      input: { method: tag as G9RpcAdmitA_INV_T2_RPC_STREAM_CONFIG_rpc_request_admitted["method"] },
    };
  }
  if (STREAM_DISCOVERY_METHODS_SET.has(tag)) {
    return {
      comm_id: "INV-T2-RPC-STREAM-DISCOVERY",
      phase: "rpc-stream-element-emitted",
      input: {
        method: tag as G9RpcAdmitA_INV_T2_RPC_STREAM_DISCOVERY_rpc_request_admitted["method"],
      },
    };
  }
  return undefined;
};

/** RpcServer admit hook → one captureOccurrence when tag is ledger-registered. */
export const captureRpcRequestAdmitted = (tag: string): Effect.Effect<void, never> => {
  const input = buildRpcAdmitCaptureInput(tag);
  if (input === undefined) return Effect.void;
  return withOptionalG9Capture((capture) => captureTypedHooksOccurrence(capture, input));
};

/** RpcServer unary-success hook → one captureOccurrence when tag is unary-partitioned. */
export const captureRpcUnarySucceeded = (tag: string): Effect.Effect<void, never> => {
  const input = buildRpcUnarySuccessCaptureInput(tag);
  if (input === undefined) return Effect.void;
  return withOptionalG9Capture((capture) => captureTypedHooksOccurrence(capture, input));
};

/** RpcServer stream-element hook → one captureOccurrence when tag is stream-partitioned. */
export const captureRpcStreamElement = (tag: string): Effect.Effect<void, never> => {
  const input = buildRpcStreamElementCaptureInput(tag);
  if (input === undefined) return Effect.void;
  return withOptionalG9Capture((capture) => captureTypedHooksOccurrence(capture, input));
};

/** MCP existing-session DELETE 204 → G9McpDeleteA (site only). */
export const captureMcpHttpSessionDeleted = (): Effect.Effect<void, never> =>
  withOptionalG9Capture((capture) =>
    captureTypedHooksOccurrence(capture, {
      comm_id: "INV-T2-MCP-HTTP",
      phase: "mcp-http-session-deleted",
      input: { site: "mcp-http-session-deleted" },
    }),
  );

/** T3 OTLP traces export success → G9T3OtlpTracesA.signal. */
export const captureT3OtlpTracesExportSucceeded = (): Effect.Effect<void, never> =>
  withOptionalG9Capture((capture) =>
    captureTypedHooksOccurrence(capture, {
      comm_id: "INV-T2-TEL-T3-OTLP",
      phase: "t3-otlp-traces-export-succeeded",
      input: { signal: "t3-otlp-traces-export-succeeded" },
    }),
  );

/** T3 OTLP metrics export success → G9T3OtlpMetricsA.signal. */
export const captureT3OtlpMetricsExportSucceeded = (): Effect.Effect<void, never> =>
  withOptionalG9Capture((capture) =>
    captureTypedHooksOccurrence(capture, {
      comm_id: "INV-T2-TEL-T3-OTLP",
      phase: "t3-otlp-metrics-export-succeeded",
      input: { signal: "t3-otlp-metrics-export-succeeded" },
    }),
  );

/**
 * Map Effect ExportHooks label → T3 OTLP ledger capture (post-success only).
 *
 * Agent: patch already gates nonempty batches. Unknown labels no-op. SCM-only
 * batches are excluded when scmOnlyBatch is true (consumer / filter path).
 */
export const captureT3OtlpExportSucceededFromLabel = (args: {
  readonly label: string;
  readonly batchSize: number;
  readonly scmOnlyBatch?: boolean;
}): Effect.Effect<void, never> => {
  if (!isCapturableOtlpExportBatch(args)) return Effect.void;
  if (args.label === G9_T3_OTLP_EXPORTER_LABELS.traces) {
    return captureT3OtlpTracesExportSucceeded();
  }
  if (args.label === G9_T3_OTLP_EXPORTER_LABELS.metrics) {
    return captureT3OtlpMetricsExportSucceeded();
  }
  return Effect.void;
};

/**
 * T2 OTLP SDK-path helper (OTLPTraceExporter success callback — not ExportHooks).
 *
 * Call only after a filtered nonempty export success. Pass scmOnlyBatch true to
 * skip ledger capture for SCM-only batches.
 */
export const captureT2OtlpExportSucceeded = (args?: {
  readonly batchSize?: number;
  readonly scmOnlyBatch?: boolean;
}): Effect.Effect<void, never> => {
  const batchSize = args?.batchSize ?? 1;
  if (!isCapturableOtlpExportBatch({ batchSize, scmOnlyBatch: args?.scmOnlyBatch })) {
    return Effect.void;
  }
  return withOptionalG9Capture((capture) =>
    captureTypedHooksOccurrence(capture, {
      comm_id: "INV-T2-TEL-T2-OTLP",
      phase: "t2-otlp-export-succeeded",
      input: { signal: "t2-otlp-export-succeeded" },
    }),
  );
};

/**
 * Layer for ws.ts: provide RpcServer.RpcServerRequestHooks → WP6 capture.
 *
 * Agent: merge with RpcServer.toHttpEffectWebsocket stack. Requires
 * G9CaptureService in the runtime for capture; absent ⇒ callbacks no-op.
 */
export const G9RpcServerRequestHooksLayer: Layer.Layer<RpcServer.RpcServerRequestHooks> =
  Layer.succeed(RpcServer.RpcServerRequestHooks, {
    onRequestAdmitted: ({ tag }) => captureRpcRequestAdmitted(tag),
    onUnarySucceeded: ({ tag }) => captureRpcUnarySucceeded(tag),
    onStreamElement: ({ tag }) => captureRpcStreamElement(tag),
  });

/**
 * Layer for McpHttpServer.ts: provide McpServer.HttpSessionHooks → G9McpDeleteA.
 *
 * Agent: bridge only from existing-session select-204 (RFC-013). Seam already
 * gates missing/unknown session.
 */
export const G9McpHttpSessionHooksLayer: Layer.Layer<McpServer.HttpSessionHooks> = Layer.succeed(
  McpServer.HttpSessionHooks,
  {
    onExistingSessionDeleted: () => captureMcpHttpSessionDeleted(),
  },
);

/**
 * Layer for Observability.ts: provide OtlpExporter.ExportHooks → T3 OTLP signals.
 *
 * Agent: maps OtlpTracer / OtlpMetrics labels only. batchSize gate + label map;
 * SCM-only exclusion remains a consumer filter before spans reach export when
 * applicable (hook sees label + size only).
 */
export const G9T3OtlpExportHooksLayer: Layer.Layer<OtlpExporter.ExportHooks> = Layer.succeed(
  OtlpExporter.ExportHooks,
  {
    onExportSucceeded: ({ label, batchSize }) =>
      captureT3OtlpExportSucceededFromLabel({ label, batchSize }),
  },
);

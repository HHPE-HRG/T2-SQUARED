/**
 * WP5 B4 provider-protocol family helpers (Mode B Wave W5a/W5c).
 *
 * Intended: project ledger-bounded equality A for B4 rows, then call only
 * G9CaptureService.captureOccurrence. No FIFO, clock, tracer, meter, enqueue,
 * or publish ownership. RpcServer admit/unary/stream and OTLP stay WP6.
 *
 * Observed: helpers below build G9B4CaptureOccurrenceInput and invoke the
 * live-safe capture channel. MCP non-hook phases are authored here as handoff
 * notes + helpers for WP6-Consumer-Owner to land on McpHttpServer.ts (RFC-014).
 * mcp-http-session-deleted is excluded from the B4 callable union (WP6 only).
 *
 * W5c: B4 is sole lander for provider/** capture sites. Optional
 * captureWhenG9Present keeps live paths unchanged when G9CaptureService is
 * absent. Does not flip g9toG10Authorized. Does not authorize G10.
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { G9CaptureService, type G9CaptureServiceShape } from "./g9OrchQueueCapture.ts";
import type { G9CaptureOccurrenceInput } from "./g9Occurrence.ts";

/**
 * Ledger comm_ids owned by bundle B4 (plan § B4). Sixteen rows, forty-one
 * phases total; one MCP phase is WP6-only (see G9_B4_MCP_HTTP_NON_HOOK_HANDOFF).
 */
export const B4_PROVIDER_PROTOCOL_COMM_IDS = [
  "INV-T2-HTTP-AUTH",
  "INV-T2-HTTP-CONNECT",
  "INV-T2-HTTP-META",
  "INV-T2-HTTP-ORCH",
  "INV-T2-HTTP-PR",
  "INV-T2-HTTP-STATIC",
  "INV-T2-MCP-HTTP",
  "INV-T2-PROVIDER-CLAUDE",
  "INV-T2-PROVIDER-CODEX",
  "INV-T2-PROVIDER-CURSOR",
  "INV-T2-PROVIDER-EVENTS",
  "INV-T2-PROVIDER-GROK",
  "INV-T2-PROVIDER-LIST-EVENTS",
  "INV-T2-PROVIDER-OPENCODE",
  "INV-T2-PROVIDER-PERM",
  "INV-T2-PROVIDER-TURN",
] as const;

export type G9B4CommId = (typeof B4_PROVIDER_PROTOCOL_COMM_IDS)[number];

/**
 * B4-callable capture inputs. Excludes mcp-http-session-deleted so W5a cannot
 * dual-own the WP6 typed-hook phase.
 */
export type G9B4CaptureOccurrenceInput = Exclude<
  Extract<G9CaptureOccurrenceInput, { readonly comm_id: G9B4CommId }>,
  { readonly phase: "mcp-http-session-deleted" }
>;

/** Live-safe capture function (error channel never). */
export type G9B4CaptureFn = G9CaptureServiceShape["captureOccurrence"];

type ExtractB4<C extends G9B4CommId, P extends string> = Extract<
  G9B4CaptureOccurrenceInput,
  { readonly comm_id: C; readonly phase: P }
>;

export type G9B4HttpAuthEndpoint = ExtractB4<
  "INV-T2-HTTP-AUTH",
  "http-request-admitted"
>["input"]["endpoint"];
export type G9B4HttpOrchEndpoint = ExtractB4<
  "INV-T2-HTTP-ORCH",
  "http-request-admitted"
>["input"]["endpoint"];
export type G9B4HttpPrEndpoint = ExtractB4<
  "INV-T2-HTTP-PR",
  "http-request-admitted"
>["input"]["endpoint"];
export type G9B4HttpConnectEndpoint = ExtractB4<
  "INV-T2-HTTP-CONNECT",
  "http-request-admitted"
>["input"]["endpoint"];
export type G9B4ProviderEventMember = ExtractB4<
  "INV-T2-PROVIDER-EVENTS",
  "pubsub-published"
>["input"]["member_id"];
export type G9B4CodexOperation = ExtractB4<
  "INV-T2-PROVIDER-CODEX",
  "protocol-request-succeeded"
>["input"]["operation"];
export type G9B4CodexEventClass = ExtractB4<
  "INV-T2-PROVIDER-CODEX",
  "protocol-event-decoded"
>["input"]["event_class"];
export type G9B4AcpOperation = ExtractB4<
  "INV-T2-PROVIDER-CURSOR",
  "protocol-request-succeeded"
>["input"]["operation"];
export type G9B4AcpEventClass = ExtractB4<
  "INV-T2-PROVIDER-CURSOR",
  "protocol-event-decoded"
>["input"]["event_class"];
export type G9B4OpenCodeOperation = ExtractB4<
  "INV-T2-PROVIDER-OPENCODE",
  "protocol-request-succeeded"
>["input"]["operation"];
export type G9B4OpenCodeEventClass = ExtractB4<
  "INV-T2-PROVIDER-OPENCODE",
  "protocol-event-decoded"
>["input"]["event_class"];

/**
 * Handoff notes for MCP non-hook phases → WP6 McpHttpServer sole lander.
 *
 * Agent: W5a authors helpers here only. Do not edit McpHttpServer.ts or ws.ts
 * in this wave. WP6 integrates capture at the sites below. Session-delete stays
 * planned_typed_hooks under WP6 (RFC-013/014).
 */
export const G9_B4_MCP_HTTP_NON_HOOK_HANDOFF = {
  lander: "WP6-Consumer-Owner",
  live_file: "apps/server/src/mcp/McpHttpServer.ts",
  planning_owner: "WP5-B4",
  phases: [
    {
      comm_id: "INV-T2-MCP-HTTP",
      phase: "mcp-http-message-admitted",
      live_site: "authenticateRequest",
      helper: "captureMcpHttpMessageAdmitted",
      input: { site: "mcp-http-message-admitted" },
    },
    {
      comm_id: "INV-T2-MCP-HTTP",
      phase: "mcp-http-handler-succeeded",
      live_site: "normalizeMcpHttpResponse",
      helper: "captureMcpHttpHandlerSucceeded",
      input: { site: "mcp-http-handler-succeeded" },
    },
  ],
  wp6_only_phase: {
    comm_id: "INV-T2-MCP-HTTP",
    phase: "mcp-http-session-deleted",
    reason: "planned_typed_hooks Effect layerHttp DELETE existing-session select-204",
  },
  forbidden_in_w5a: [
    "apps/server/src/mcp/McpHttpServer.ts commits",
    "apps/server/src/ws.ts commits",
    "RpcServer admit/unary/stream capture",
    "OTLP post-success capture",
    "apps/server/src/provider/** commits (W5c integrator)",
  ],
} as const;

/**
 * Sole B4 capture path. Projects already-bounded input into live-safe capture.
 *
 * Parameters
 * ----------
 * capture : G9B4CaptureFn
 *     Live-safe captureOccurrence (never-failing error channel).
 * input : G9B4CaptureOccurrenceInput
 *     Ledger (comm_id, phase, input) for a B4-callable phase.
 *
 * Returns
 * -------
 * Effect&lt;void, never&gt;
 *     Discards capture result; live caller stays void.
 */
export const captureProviderProtocolOccurrence = (
  capture: G9B4CaptureFn,
  input: G9B4CaptureOccurrenceInput,
): Effect.Effect<void, never> => capture(input).pipe(Effect.asVoid);

/**
 * Optional live-safe capture for provider/** land sites.
 *
 * Agent: absent G9CaptureService ⇒ no-op (live behavior unchanged). Present ⇒
 * run once with captureOccurrence. Use for B4 protocol rows and for wiring
 * B2 handoff helpers that take a capture fn.
 *
 * Parameters
 * ----------
 * run : (capture) =&gt; Effect&lt;void, never&gt;
 *     Caller invokes a family capture* helper with the injected fn.
 */
export const captureWhenG9Present = (
  run: (capture: G9B4CaptureFn) => Effect.Effect<unknown, never>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const opt = yield* Effect.serviceOption(G9CaptureService);
    if (Option.isSome(opt)) {
      yield* run((input) => opt.value.captureOccurrence(input));
    }
  });

/** Build INV-T2-HTTP-AUTH admit/success input (endpoint only; no tokens). */
export const buildHttpAuthCaptureInput = (
  phase: "http-request-admitted" | "http-handler-succeeded",
  endpoint: G9B4HttpAuthEndpoint,
): ExtractB4<"INV-T2-HTTP-AUTH", typeof phase> =>
  ({
    comm_id: "INV-T2-HTTP-AUTH",
    phase,
    input: { endpoint },
  }) as ExtractB4<"INV-T2-HTTP-AUTH", typeof phase>;

/** Build INV-T2-HTTP-META admit/success input. */
export const buildHttpMetaCaptureInput = (
  phase: "http-request-admitted" | "http-handler-succeeded",
): ExtractB4<"INV-T2-HTTP-META", typeof phase> =>
  ({
    comm_id: "INV-T2-HTTP-META",
    phase,
    input: { endpoint: "descriptor" },
  }) as ExtractB4<"INV-T2-HTTP-META", typeof phase>;

/** Build INV-T2-HTTP-ORCH admit/success input. */
export const buildHttpOrchCaptureInput = (
  phase: "http-request-admitted" | "http-handler-succeeded",
  endpoint: G9B4HttpOrchEndpoint,
): ExtractB4<"INV-T2-HTTP-ORCH", typeof phase> =>
  ({
    comm_id: "INV-T2-HTTP-ORCH",
    phase,
    input: { endpoint },
  }) as ExtractB4<"INV-T2-HTTP-ORCH", typeof phase>;

/** Build INV-T2-HTTP-PR admit/success input. */
export const buildHttpPrCaptureInput = (
  phase: "http-request-admitted" | "http-handler-succeeded",
  endpoint: G9B4HttpPrEndpoint,
): ExtractB4<"INV-T2-HTTP-PR", typeof phase> =>
  ({
    comm_id: "INV-T2-HTTP-PR",
    phase,
    input: { endpoint },
  }) as ExtractB4<"INV-T2-HTTP-PR", typeof phase>;

/** Build INV-T2-HTTP-CONNECT admit/success input. */
export const buildHttpConnectCaptureInput = (
  phase: "http-request-admitted" | "http-handler-succeeded",
  endpoint: G9B4HttpConnectEndpoint,
): ExtractB4<"INV-T2-HTTP-CONNECT", typeof phase> =>
  ({
    comm_id: "INV-T2-HTTP-CONNECT",
    phase,
    input: { endpoint },
  }) as ExtractB4<"INV-T2-HTTP-CONNECT", typeof phase>;

type HttpStaticPhase =
  | "asset-file-200-selected"
  | "static-file-200-selected"
  | "static-spa-fallback-200-selected"
  | "static-dev-redirect-302-selected";

/** Build INV-T2-HTTP-STATIC selection input (phase id mirrored in A.comm_id). */
export const buildHttpStaticCaptureInput = (
  phase: HttpStaticPhase,
): ExtractB4<"INV-T2-HTTP-STATIC", HttpStaticPhase> =>
  ({
    comm_id: "INV-T2-HTTP-STATIC",
    phase,
    input: { comm_id: phase },
  }) as ExtractB4<"INV-T2-HTTP-STATIC", HttpStaticPhase>;

/** Build INV-T2-PROVIDER-TURN phase input. */
export const buildProviderTurnCaptureInput = (
  phase: "send-turn-admitted" | "send-turn-succeeded",
): ExtractB4<"INV-T2-PROVIDER-TURN", typeof phase> =>
  ({
    comm_id: "INV-T2-PROVIDER-TURN",
    phase,
    input: { comm_id: phase },
  }) as ExtractB4<"INV-T2-PROVIDER-TURN", typeof phase>;

/** Build INV-T2-PROVIDER-PERM phase input. */
export const buildProviderPermCaptureInput = (
  phase: "permission-request-admitted" | "permission-outcome-succeeded",
): ExtractB4<"INV-T2-PROVIDER-PERM", typeof phase> =>
  ({
    comm_id: "INV-T2-PROVIDER-PERM",
    phase,
    input: { comm_id: phase },
  }) as ExtractB4<"INV-T2-PROVIDER-PERM", typeof phase>;

/** Build INV-T2-PROVIDER-EVENTS pubsub input (member_id only; no payload). */
export const buildProviderEventsCaptureInput = (
  member_id: G9B4ProviderEventMember,
): ExtractB4<"INV-T2-PROVIDER-EVENTS", "pubsub-published"> => ({
  comm_id: "INV-T2-PROVIDER-EVENTS",
  phase: "pubsub-published",
  input: { member_id },
});

/** Build INV-T2-PROVIDER-LIST-EVENTS pubsub input. */
export const buildProviderListEventsCaptureInput = (): ExtractB4<
  "INV-T2-PROVIDER-LIST-EVENTS",
  "pubsub-published"
> => ({
  comm_id: "INV-T2-PROVIDER-LIST-EVENTS",
  phase: "pubsub-published",
  input: { comm_id: "present" },
});

/** Build Codex runtime/protocol capture input. */
export const buildProviderCodexCaptureInput = (
  args:
    | { readonly phase: "runtime-spawn-succeeded" }
    | { readonly phase: "runtime-exit-succeeded" }
    | { readonly phase: "protocol-request-succeeded"; readonly operation: G9B4CodexOperation }
    | { readonly phase: "protocol-event-decoded"; readonly event_class: G9B4CodexEventClass },
): G9B4CaptureOccurrenceInput => {
  switch (args.phase) {
    case "runtime-spawn-succeeded":
      return {
        comm_id: "INV-T2-PROVIDER-CODEX",
        phase: "runtime-spawn-succeeded",
        input: { provider: "spawned" },
      };
    case "runtime-exit-succeeded":
      return {
        comm_id: "INV-T2-PROVIDER-CODEX",
        phase: "runtime-exit-succeeded",
        input: { provider: "exited" },
      };
    case "protocol-request-succeeded":
      return {
        comm_id: "INV-T2-PROVIDER-CODEX",
        phase: "protocol-request-succeeded",
        input: { operation: args.operation },
      };
    case "protocol-event-decoded":
      return {
        comm_id: "INV-T2-PROVIDER-CODEX",
        phase: "protocol-event-decoded",
        input: { event_class: args.event_class },
      };
    default: {
      const _exhaustive: never = args;
      return _exhaustive;
    }
  }
};

/** Build Claude protocol/probe capture input. */
export const buildProviderClaudeCaptureInput = (
  args:
    | { readonly phase: "protocol-request-succeeded" }
    | { readonly phase: "protocol-event-decoded" }
    | { readonly phase: "cli-version-probe-succeeded" },
): G9B4CaptureOccurrenceInput => {
  switch (args.phase) {
    case "protocol-request-succeeded":
      return {
        comm_id: "INV-T2-PROVIDER-CLAUDE",
        phase: "protocol-request-succeeded",
        input: { operation: "claude.sdk.query" },
      };
    case "protocol-event-decoded":
      return {
        comm_id: "INV-T2-PROVIDER-CLAUDE",
        phase: "protocol-event-decoded",
        input: { event_class: "claude.sdk.message" },
      };
    case "cli-version-probe-succeeded":
      return {
        comm_id: "INV-T2-PROVIDER-CLAUDE",
        phase: "cli-version-probe-succeeded",
        input: { operation: "claude-cli-version" },
      };
    default: {
      const _exhaustive: never = args;
      return _exhaustive;
    }
  }
};

type AcpProviderCommId = "INV-T2-PROVIDER-CURSOR" | "INV-T2-PROVIDER-GROK";

/** Build Cursor/Grok ACP runtime/protocol capture input. */
export const buildProviderAcpCaptureInput = (
  comm_id: AcpProviderCommId,
  args:
    | { readonly phase: "runtime-spawn-succeeded" }
    | { readonly phase: "protocol-request-succeeded"; readonly operation: G9B4AcpOperation }
    | { readonly phase: "protocol-event-decoded"; readonly event_class: G9B4AcpEventClass },
): G9B4CaptureOccurrenceInput => {
  switch (args.phase) {
    case "runtime-spawn-succeeded":
      return {
        comm_id,
        phase: "runtime-spawn-succeeded",
        input: { provider: "spawned" },
      };
    case "protocol-request-succeeded":
      return {
        comm_id,
        phase: "protocol-request-succeeded",
        input: { operation: args.operation },
      };
    case "protocol-event-decoded":
      return {
        comm_id,
        phase: "protocol-event-decoded",
        input: { event_class: args.event_class },
      };
    default: {
      const _exhaustive: never = args;
      return _exhaustive;
    }
  }
};

/** Build OpenCode runtime/protocol/http capture input. */
export const buildProviderOpenCodeCaptureInput = (
  args:
    | { readonly phase: "runtime-spawn-succeeded" }
    | { readonly phase: "runtime-exit-succeeded" }
    | {
        readonly phase: "protocol-request-succeeded";
        readonly operation: G9B4OpenCodeOperation;
      }
    | {
        readonly phase: "protocol-event-decoded";
        readonly event_class: G9B4OpenCodeEventClass;
      }
    | { readonly phase: "opencode-http-succeeded" },
): G9B4CaptureOccurrenceInput => {
  switch (args.phase) {
    case "runtime-spawn-succeeded":
      return {
        comm_id: "INV-T2-PROVIDER-OPENCODE",
        phase: "runtime-spawn-succeeded",
        input: { provider: "spawned" },
      };
    case "runtime-exit-succeeded":
      return {
        comm_id: "INV-T2-PROVIDER-OPENCODE",
        phase: "runtime-exit-succeeded",
        input: { provider: "exited" },
      };
    case "protocol-request-succeeded":
      return {
        comm_id: "INV-T2-PROVIDER-OPENCODE",
        phase: "protocol-request-succeeded",
        input: { operation: args.operation },
      };
    case "protocol-event-decoded":
      return {
        comm_id: "INV-T2-PROVIDER-OPENCODE",
        phase: "protocol-event-decoded",
        input: { event_class: args.event_class },
      };
    case "opencode-http-succeeded":
      return {
        comm_id: "INV-T2-PROVIDER-OPENCODE",
        phase: "opencode-http-succeeded",
        input: { operation: "opencode-http" },
      };
    default: {
      const _exhaustive: never = args;
      return _exhaustive;
    }
  }
};

/**
 * MCP message-admitted handoff helper for WP6 McpHttpServer lander.
 * Call only after authenticateRequest admits the message.
 */
export const captureMcpHttpMessageAdmitted = (capture: G9B4CaptureFn): Effect.Effect<void, never> =>
  captureProviderProtocolOccurrence(capture, {
    comm_id: "INV-T2-MCP-HTTP",
    phase: "mcp-http-message-admitted",
    input: { site: "mcp-http-message-admitted" },
  });

/**
 * MCP handler-succeeded handoff helper for WP6 McpHttpServer lander.
 * Call only after normalizeMcpHttpResponse succeeds.
 */
export const captureMcpHttpHandlerSucceeded = (
  capture: G9B4CaptureFn,
): Effect.Effect<void, never> =>
  captureProviderProtocolOccurrence(capture, {
    comm_id: "INV-T2-MCP-HTTP",
    phase: "mcp-http-handler-succeeded",
    input: { site: "mcp-http-handler-succeeded" },
  });

/** Convenience: HTTP AUTH admit → one captureOccurrence. */
export const captureHttpAuthAdmitted = (
  capture: G9B4CaptureFn,
  endpoint: G9B4HttpAuthEndpoint,
): Effect.Effect<void, never> =>
  captureProviderProtocolOccurrence(
    capture,
    buildHttpAuthCaptureInput("http-request-admitted", endpoint),
  );

/** Convenience: HTTP AUTH handler success → one captureOccurrence. */
export const captureHttpAuthSucceeded = (
  capture: G9B4CaptureFn,
  endpoint: G9B4HttpAuthEndpoint,
): Effect.Effect<void, never> =>
  captureProviderProtocolOccurrence(
    capture,
    buildHttpAuthCaptureInput("http-handler-succeeded", endpoint),
  );

/** Ledger finite domains for B4 live capture guards (from coverage-ledger request_label). */
export const G9_B4_CODEX_OPERATIONS: ReadonlySet<string> = new Set([
  "account/login/cancel",
  "account/login/start",
  "account/logout",
  "account/rateLimitResetCredit/consume",
  "account/rateLimits/read",
  "account/read",
  "account/sendAddCreditsNudgeEmail",
  "account/usage/read",
  "account/workspaceMessages/read",
  "app/installed",
  "app/list",
  "app/read",
  "command/exec",
  "command/exec/resize",
  "command/exec/terminate",
  "command/exec/write",
  "config/batchWrite",
  "config/mcpServer/reload",
  "config/read",
  "config/value/write",
  "configRequirements/read",
  "experimentalFeature/enablement/set",
  "experimentalFeature/list",
  "externalAgentConfig/detect",
  "externalAgentConfig/import",
  "externalAgentConfig/import/readHistories",
  "feedback/upload",
  "fs/copy",
  "fs/createDirectory",
  "fs/getMetadata",
  "fs/readDirectory",
  "fs/readFile",
  "fs/remove",
  "fs/unwatch",
  "fs/watch",
  "fs/writeFile",
  "fuzzyFileSearch",
  "hooks/list",
  "initialize",
  "initialized",
  "marketplace/add",
  "marketplace/remove",
  "marketplace/upgrade",
  "mcpServer/oauth/login",
  "mcpServer/resource/read",
  "mcpServer/tool/call",
  "mcpServerStatus/list",
  "model/list",
  "modelProvider/capabilities/read",
  "permissionProfile/list",
  "plugin/install",
  "plugin/installed",
  "plugin/list",
  "plugin/read",
  "plugin/share/checkout",
  "plugin/share/delete",
  "plugin/share/list",
  "plugin/share/save",
  "plugin/share/updateTargets",
  "plugin/skill/read",
  "plugin/uninstall",
  "review/start",
  "skills/config/write",
  "skills/extraRoots/set",
  "skills/list",
  "thread/approveGuardianDeniedAction",
  "thread/archive",
  "thread/compact/start",
  "thread/delete",
  "thread/fork",
  "thread/goal/clear",
  "thread/goal/get",
  "thread/goal/set",
  "thread/inject_items",
  "thread/list",
  "thread/loaded/list",
  "thread/metadata/update",
  "thread/name/set",
  "thread/read",
  "thread/resume",
  "thread/rollback",
  "thread/shellCommand",
  "thread/start",
  "thread/unarchive",
  "thread/unsubscribe",
  "turn/interrupt",
  "turn/start",
  "turn/steer",
  "windowsSandbox/readiness",
  "windowsSandbox/setupStart",
]);
export const G9_B4_CODEX_EVENT_CLASSES: ReadonlySet<string> = new Set([
  "account/login/completed",
  "account/rateLimits/updated",
  "account/updated",
  "app/list/updated",
  "command/exec/outputDelta",
  "configWarning",
  "deprecationNotice",
  "error",
  "externalAgentConfig/import/completed",
  "externalAgentConfig/import/progress",
  "fs/changed",
  "fuzzyFileSearch/sessionCompleted",
  "fuzzyFileSearch/sessionUpdated",
  "guardianWarning",
  "hook/completed",
  "hook/started",
  "item/agentMessage/delta",
  "item/autoApprovalReview/completed",
  "item/autoApprovalReview/started",
  "item/commandExecution/outputDelta",
  "item/commandExecution/terminalInteraction",
  "item/completed",
  "item/fileChange/outputDelta",
  "item/fileChange/patchUpdated",
  "item/mcpToolCall/progress",
  "item/plan/delta",
  "item/reasoning/summaryPartAdded",
  "item/reasoning/summaryTextDelta",
  "item/reasoning/textDelta",
  "item/started",
  "mcpServer/oauthLogin/completed",
  "mcpServer/startupStatus/updated",
  "model/rerouted",
  "model/safetyBuffering/updated",
  "model/verification",
  "process/exited",
  "process/outputDelta",
  "remoteControl/status/changed",
  "serverRequest/resolved",
  "skills/changed",
  "thread/archived",
  "thread/closed",
  "thread/compacted",
  "thread/deleted",
  "thread/environment/connected",
  "thread/environment/disconnected",
  "thread/goal/cleared",
  "thread/goal/updated",
  "thread/name/updated",
  "thread/realtime/closed",
  "thread/realtime/error",
  "thread/realtime/itemAdded",
  "thread/realtime/outputAudio/delta",
  "thread/realtime/sdp",
  "thread/realtime/started",
  "thread/realtime/transcript/delta",
  "thread/realtime/transcript/done",
  "thread/settings/updated",
  "thread/started",
  "thread/status/changed",
  "thread/tokenUsage/updated",
  "thread/unarchived",
  "turn/completed",
  "turn/diff/updated",
  "turn/moderationMetadata",
  "turn/plan/updated",
  "turn/started",
  "warning",
  "windows/worldWritableWarning",
  "windowsSandbox/setupCompleted",
]);
export const G9_B4_ACP_OPERATIONS: ReadonlySet<string> = new Set([
  "authenticate",
  "initialize",
  "logout",
  "session/cancel",
  "session/close",
  "session/fork",
  "session/list",
  "session/load",
  "session/new",
  "session/prompt",
  "session/resume",
  "session/set_config_option",
  "session/set_mode",
  "session/set_model",
]);
export const G9_B4_ACP_EVENT_CLASSES: ReadonlySet<string> = new Set([
  "fs/read_text_file",
  "fs/write_text_file",
  "session/elicitation",
  "session/elicitation/complete",
  "session/update",
  "terminal/create",
  "terminal/kill",
  "terminal/output",
  "terminal/release",
  "terminal/wait_for_exit",
]);
export const G9_B4_OPENCODE_OPERATIONS: ReadonlySet<string> = new Set([
  "session.abort",
  "event.subscribe",
  "mcp.add",
  "session.get",
  "session.update",
  "session.fork",
  "session.create",
  "session.promptAsync",
  "permission.reply",
  "question.reply",
  "session.messages",
  "session.revert",
  "provider.list",
  "app.agents",
]);
export const G9_B4_OPENCODE_EVENT_CLASSES: ReadonlySet<string> = new Set([
  "session.updated",
  "message.updated",
  "message.removed",
  "message.part.delta",
  "message.part.updated",
  "permission.asked",
  "permission.replied",
  "question.asked",
  "question.replied",
  "question.rejected",
  "session.status",
  "session.error",
]);
export const G9_B4_PROVIDER_EVENT_MEMBERS: ReadonlySet<string> = new Set([
  "session.started",
  "session.configured",
  "session.state.changed",
  "session.exited",
  "thread.started",
  "thread.state.changed",
  "thread.metadata.updated",
  "thread.token-usage.updated",
  "thread.realtime.started",
  "thread.realtime.item-added",
  "thread.realtime.audio.delta",
  "thread.realtime.error",
  "thread.realtime.closed",
  "turn.started",
  "turn.completed",
  "turn.aborted",
  "turn.plan.updated",
  "turn.proposed.delta",
  "turn.proposed.completed",
  "turn.diff.updated",
  "item.started",
  "item.updated",
  "item.completed",
  "content.delta",
  "request.opened",
  "request.resolved",
  "user-input.requested",
  "user-input.resolved",
  "task.started",
  "task.progress",
  "task.updated",
  "task.completed",
  "hook.started",
  "hook.progress",
  "hook.completed",
  "tool.progress",
  "tool.summary",
  "auth.status",
  "account.updated",
  "account.rate-limits.updated",
  "mcp.status.updated",
  "mcp.oauth.completed",
  "model.rerouted",
  "config.warning",
  "deprecation.notice",
  "files.persisted",
  "tool.denied",
  "runtime.warning",
  "runtime.error",
]);

/** Optional-service HTTP AUTH admit+succeed around a successful handler body. */
export const withHttpAuthCapture = <A, E, R>(
  endpoint: G9B4HttpAuthEndpoint,
  body: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    yield* captureWhenG9Present((c) => captureHttpAuthAdmitted(c, endpoint));
    const result = yield* body;
    yield* captureWhenG9Present((c) => captureHttpAuthSucceeded(c, endpoint));
    return result;
  });

/** Optional-service HTTP META admit+succeed. */
export const withHttpMetaCapture = <A, E, R>(
  body: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    yield* captureWhenG9Present((c) =>
      captureProviderProtocolOccurrence(c, buildHttpMetaCaptureInput("http-request-admitted")),
    );
    const result = yield* body;
    yield* captureWhenG9Present((c) =>
      captureProviderProtocolOccurrence(c, buildHttpMetaCaptureInput("http-handler-succeeded")),
    );
    return result;
  });

/** Optional-service HTTP ORCH admit+succeed. */
export const withHttpOrchCapture = <A, E, R>(
  endpoint: G9B4HttpOrchEndpoint,
  body: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    yield* captureWhenG9Present((c) =>
      captureProviderProtocolOccurrence(
        c,
        buildHttpOrchCaptureInput("http-request-admitted", endpoint),
      ),
    );
    const result = yield* body;
    yield* captureWhenG9Present((c) =>
      captureProviderProtocolOccurrence(
        c,
        buildHttpOrchCaptureInput("http-handler-succeeded", endpoint),
      ),
    );
    return result;
  });

/** Optional-service HTTP PR admit+succeed. */
export const withHttpPrCapture = <A, E, R>(
  endpoint: G9B4HttpPrEndpoint,
  body: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    yield* captureWhenG9Present((c) =>
      captureProviderProtocolOccurrence(
        c,
        buildHttpPrCaptureInput("http-request-admitted", endpoint),
      ),
    );
    const result = yield* body;
    yield* captureWhenG9Present((c) =>
      captureProviderProtocolOccurrence(
        c,
        buildHttpPrCaptureInput("http-handler-succeeded", endpoint),
      ),
    );
    return result;
  });

/** Optional-service HTTP CONNECT admit+succeed. */
export const withHttpConnectCapture = <A, E, R>(
  endpoint: G9B4HttpConnectEndpoint,
  body: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    yield* captureWhenG9Present((c) =>
      captureProviderProtocolOccurrence(
        c,
        buildHttpConnectCaptureInput("http-request-admitted", endpoint),
      ),
    );
    const result = yield* body;
    yield* captureWhenG9Present((c) =>
      captureProviderProtocolOccurrence(
        c,
        buildHttpConnectCaptureInput("http-handler-succeeded", endpoint),
      ),
    );
    return result;
  });

/** INV-T2-HTTP-STATIC selection capture (one phase per selected response). */
export const captureHttpStaticSelected = (
  phase:
    | "asset-file-200-selected"
    | "static-file-200-selected"
    | "static-spa-fallback-200-selected"
    | "static-dev-redirect-302-selected",
): Effect.Effect<void, never> =>
  captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(c, buildHttpStaticCaptureInput(phase)),
  );

/** INV-T2-PROVIDER-TURN phases (optional service). */
export const captureProviderTurnPhase = (
  phase: "send-turn-admitted" | "send-turn-succeeded",
): Effect.Effect<void, never> =>
  captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(c, buildProviderTurnCaptureInput(phase)),
  );

/** INV-T2-PROVIDER-PERM phases (optional service). */
export const captureProviderPermPhase = (
  phase: "permission-request-admitted" | "permission-outcome-succeeded",
): Effect.Effect<void, never> =>
  captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(c, buildProviderPermCaptureInput(phase)),
  );

/** INV-T2-PROVIDER-LIST-EVENTS pubsub (optional service). */
export const captureProviderListEventsPublished = (): Effect.Effect<void, never> =>
  captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(c, buildProviderListEventsCaptureInput()),
  );

/** INV-T2-PROVIDER-EVENTS pubsub when member_id is ledger-known. */
export const captureProviderEventPublishedIfKnown = (
  member_id: string,
): Effect.Effect<void, never> => {
  if (!G9_B4_PROVIDER_EVENT_MEMBERS.has(member_id)) {
    return Effect.void;
  }
  return captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(
      c,
      buildProviderEventsCaptureInput(member_id as G9B4ProviderEventMember),
    ),
  );
};

/** INV-T2-PROVIDER-CODEX runtime spawn/exit. */
export const captureProviderCodexRuntime = (
  phase: "runtime-spawn-succeeded" | "runtime-exit-succeeded",
): Effect.Effect<void, never> =>
  captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(c, buildProviderCodexCaptureInput({ phase })),
  );

/** INV-T2-PROVIDER-CODEX protocol-request when operation is ledger-known. */
export const captureCodexProtocolRequestIfKnown = (
  operation: string,
): Effect.Effect<void, never> => {
  if (!G9_B4_CODEX_OPERATIONS.has(operation)) {
    return Effect.void;
  }
  return captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(
      c,
      buildProviderCodexCaptureInput({
        phase: "protocol-request-succeeded",
        operation: operation as G9B4CodexOperation,
      }),
    ),
  );
};

/** INV-T2-PROVIDER-CODEX protocol-event when event_class is ledger-known. */
export const captureCodexProtocolEventIfKnown = (
  event_class: string,
): Effect.Effect<void, never> => {
  if (!G9_B4_CODEX_EVENT_CLASSES.has(event_class)) {
    return Effect.void;
  }
  return captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(
      c,
      buildProviderCodexCaptureInput({
        phase: "protocol-event-decoded",
        event_class: event_class as G9B4CodexEventClass,
      }),
    ),
  );
};

/** INV-T2-PROVIDER-CLAUDE protocol/probe captures (fixed A). */
export const captureProviderClaudePhase = (
  phase: "protocol-request-succeeded" | "protocol-event-decoded" | "cli-version-probe-succeeded",
): Effect.Effect<void, never> =>
  captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(c, buildProviderClaudeCaptureInput({ phase })),
  );

/** ACP runtime spawn for CURSOR or GROK. */
export const captureAcpRuntimeSpawn = (
  comm_id: "INV-T2-PROVIDER-CURSOR" | "INV-T2-PROVIDER-GROK",
): Effect.Effect<void, never> =>
  captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(
      c,
      buildProviderAcpCaptureInput(comm_id, { phase: "runtime-spawn-succeeded" }),
    ),
  );

/** ACP protocol-request when operation is ledger-known. */
export const captureAcpProtocolRequestIfKnown = (
  comm_id: "INV-T2-PROVIDER-CURSOR" | "INV-T2-PROVIDER-GROK",
  operation: string,
): Effect.Effect<void, never> => {
  if (!G9_B4_ACP_OPERATIONS.has(operation)) {
    return Effect.void;
  }
  return captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(
      c,
      buildProviderAcpCaptureInput(comm_id, {
        phase: "protocol-request-succeeded",
        operation: operation as G9B4AcpOperation,
      }),
    ),
  );
};

/** ACP protocol-event when event_class is ledger-known. */
export const captureAcpProtocolEventIfKnown = (
  comm_id: "INV-T2-PROVIDER-CURSOR" | "INV-T2-PROVIDER-GROK",
  event_class: string,
): Effect.Effect<void, never> => {
  if (!G9_B4_ACP_EVENT_CLASSES.has(event_class)) {
    return Effect.void;
  }
  return captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(
      c,
      buildProviderAcpCaptureInput(comm_id, {
        phase: "protocol-event-decoded",
        event_class: event_class as G9B4AcpEventClass,
      }),
    ),
  );
};

/** INV-T2-PROVIDER-OPENCODE runtime spawn/exit. */
export const captureProviderOpenCodeRuntime = (
  phase: "runtime-spawn-succeeded" | "runtime-exit-succeeded",
): Effect.Effect<void, never> =>
  captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(c, buildProviderOpenCodeCaptureInput({ phase })),
  );

/** OpenCode protocol-request when operation is ledger-known. */
export const captureOpenCodeProtocolRequestIfKnown = (
  operation: string,
): Effect.Effect<void, never> => {
  if (!G9_B4_OPENCODE_OPERATIONS.has(operation)) {
    return Effect.void;
  }
  return captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(
      c,
      buildProviderOpenCodeCaptureInput({
        phase: "protocol-request-succeeded",
        operation: operation as G9B4OpenCodeOperation,
      }),
    ),
  );
};

/** OpenCode protocol-event when event_class is ledger-known. */
export const captureOpenCodeProtocolEventIfKnown = (
  event_class: string,
): Effect.Effect<void, never> => {
  if (!G9_B4_OPENCODE_EVENT_CLASSES.has(event_class)) {
    return Effect.void;
  }
  return captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(
      c,
      buildProviderOpenCodeCaptureInput({
        phase: "protocol-event-decoded",
        event_class: event_class as G9B4OpenCodeEventClass,
      }),
    ),
  );
};

/** OpenCode HTTP client success. */
export const captureOpenCodeHttpSucceeded = (): Effect.Effect<void, never> =>
  captureWhenG9Present((c) =>
    captureProviderProtocolOccurrence(
      c,
      buildProviderOpenCodeCaptureInput({ phase: "opencode-http-succeeded" }),
    ),
  );

/**
 * Compile-time proof: Extract of mcp-http-session-deleted from the B4 callable
 * union is never. If Task 14 regen reintroduces it without Exclude, this fails.
 */
export type G9B4McpSessionDeletedExtract = Extract<
  G9B4CaptureOccurrenceInput,
  { readonly phase: "mcp-http-session-deleted" }
>;
type AssertNever<T extends never> = T;
/** Imported by tests so regen cannot reintroduce session-deleted into B4. */
export type G9B4AssertNoMcpSessionDeleted = AssertNever<G9B4McpSessionDeletedExtract>;

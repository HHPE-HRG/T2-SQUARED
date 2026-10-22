import * as Effect from "effect/Effect";
import {
  PreviewAutomationAdmissionDeniedError,
  type PreviewAutomationError,
  type PreviewAutomationOperation,
  type PreviewAutomationOpenInput,
  type PreviewAutomationRecordingArtifact,
  type PreviewAutomationRecordingStatus,
  type PreviewAutomationResizeResult,
  type PreviewAutomationSetColorSchemeResult,
  type PreviewAutomationSnapshot,
  type PreviewAutomationStatus,
  type PreviewTabId,
} from "@t3tools/contracts";

import {
  decidePreviewDispatch,
  isAdmissionReconcileEnabled,
} from "../../../scm/admissionDispatch.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as PreviewAutomationBroker from "../../PreviewAutomationBroker.ts";
import { PreviewSnapshotToolkit, PreviewStandardToolkit, PreviewToolkit } from "./tools.ts";

export function normalizePreviewOpenInput(
  input: PreviewAutomationOpenInput,
): PreviewAutomationOpenInput {
  const open = input.open ?? input.show ?? true;
  return {
    ...input,
    open,
    show: open,
    reuseExistingTab: input.reuseExistingTab ?? true,
  };
}

/**
 * Preview invoke.
 *
 * Intended: the `"preview"` credential stays a session check. When
 * `T2CODE_SCM_ADMISSION_RECONCILE` is unset, broker.invoke runs as before.
 * When it is set, admission dispatch runs before the broker and fail-closes
 * unknown, drifted, revoked, or missing-snapshot capabilities.
 *
 * Observed: the gate reads the process-local snapshot in admissionDispatch.
 * It does not admit provider-native tools and does not replace the session check.
 */
export const invokePreviewOperation = Effect.fn("PreviewToolkit.invoke")(function* <A>(
  operation: PreviewAutomationOperation,
  input: unknown,
  timeoutMs?: number,
  tabId?: PreviewTabId,
): Effect.fn.Return<
  A,
  PreviewAutomationError,
  McpInvocationContext.McpInvocationContext | PreviewAutomationBroker.PreviewAutomationBroker
> {
  const scope = yield* McpInvocationContext.requireMcpCapability("preview");
  // Env unset: do not consult the snapshot. Current preview behavior stays.
  if (isAdmissionReconcileEnabled()) {
    const decision = decidePreviewDispatch(operation);
    if (!decision.allow) {
      return yield* new PreviewAutomationAdmissionDeniedError({
        capability: "preview",
        operation,
        capabilityId: decision.capabilityId,
        reason: decision.reason,
        environmentId: scope.environmentId,
        threadId: scope.threadId,
        providerSessionId: scope.providerSessionId,
        providerInstanceId: scope.providerInstanceId,
      });
    }
  }
  const broker = yield* PreviewAutomationBroker.PreviewAutomationBroker;
  return yield* broker.invoke<A>({
    scope,
    operation,
    input,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    ...(tabId === undefined ? {} : { tabId }),
  });
});

const invokeTargeted = <A>(
  operation: PreviewAutomationOperation,
  input: {
    readonly tabId?: PreviewTabId | undefined;
    readonly [key: string]: unknown;
  },
  timeoutMs?: number,
) => {
  const { tabId, ...operationInput } = input;
  return invokePreviewOperation<A>(operation, operationInput, timeoutMs, tabId);
};

const handlers = {
  preview_status: (input) => invokeTargeted<PreviewAutomationStatus>("status", input ?? {}),
  preview_open: (input) =>
    invokeTargeted<PreviewAutomationStatus>("open", normalizePreviewOpenInput(input)),
  preview_navigate: (input) =>
    invokeTargeted<PreviewAutomationStatus>("navigate", input, input.timeoutMs),
  preview_resize: (input) =>
    invokeTargeted<PreviewAutomationResizeResult>("resize", input, input.timeoutMs),
  preview_set_appearance: (input) =>
    invokeTargeted<PreviewAutomationSetColorSchemeResult>("setColorScheme", input),
  preview_snapshot: (input) => invokeTargeted<PreviewAutomationSnapshot>("snapshot", input ?? {}),
  preview_click: (input) =>
    invokeTargeted<void>("click", input, input.timeoutMs).pipe(Effect.as(null)),
  preview_type: (input) =>
    invokeTargeted<void>("type", input, input.timeoutMs).pipe(Effect.as(null)),
  preview_press: (input) => invokeTargeted<void>("press", input).pipe(Effect.as(null)),
  preview_scroll: (input) => invokeTargeted<void>("scroll", input).pipe(Effect.as(null)),
  preview_evaluate: (input) =>
    invokeTargeted<unknown>("evaluate", input).pipe(Effect.map((result) => result ?? null)),
  preview_wait_for: (input) =>
    invokeTargeted<void>("waitFor", input, input.timeoutMs).pipe(Effect.as(null)),
  preview_recording_start: (input) =>
    invokeTargeted<PreviewAutomationRecordingStatus>("recordingStart", input ?? {}),
  preview_recording_stop: (input) =>
    invokeTargeted<PreviewAutomationRecordingArtifact>("recordingStop", input ?? {}),
} satisfies Parameters<typeof PreviewToolkit.toLayer>[0];

const { preview_snapshot, ...standardHandlers } = handlers;

export const PreviewStandardToolkitHandlersLive = PreviewStandardToolkit.toLayer(standardHandlers);

export const PreviewSnapshotToolkitHandlersLive = PreviewSnapshotToolkit.toLayer({
  preview_snapshot,
});

export const PreviewToolkitHandlersLive = PreviewToolkit.toLayer(handlers);

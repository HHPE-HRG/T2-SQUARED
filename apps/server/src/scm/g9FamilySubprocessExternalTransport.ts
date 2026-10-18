/**
 * WP5 B3 subprocess-external-transport family helpers (Mode B Wave W5a/W5c).
 *
 * Intended: project ledger-bounded equality A for B3's sixteen rows, then call
 * only G9CaptureService.captureOccurrence. No FIFO, clock, tracer, meter,
 * enqueue, or publish ownership. No payload / stdout / error-string retention
 * in A. No Effect global patches.
 *
 * Observed: helpers below build G9B3CaptureOccurrenceInput and invoke the
 * live-safe capture channel. W5c sole landers wire optional capture on
 * VcsDriver.ts (GIT + B2 FILE-CHECKPOINTS) and relayClient.ts (RELAY-CLIENT +
 * B2 FLAG-CLOUDFLARED). TEL-DESKTOP-CONTROL stays a B3→B5 handoff for
 * DesktopTelemetryReceiver.ts (RFC-014 A). OTLP rows stay WP6.
 *
 * W5c allowlist: VcsDriver.ts + relayClient.ts + this module (+ tests).
 * Does not flip g9toG10Authorized. Does not authorize G10.
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import type { G9CaptureServiceShape } from "./g9OrchQueueCapture.ts";
import { G9CaptureService } from "./g9OrchQueueCapture.ts";
import type { G9CaptureOccurrenceInput } from "./g9Occurrence.ts";

/**
 * Ledger comm_ids owned by bundle B3 (plan § B3). Sixteen rows, twenty-one
 * phases total.
 */
export const B3_SUBPROCESS_EXTERNAL_TRANSPORT_COMM_IDS = [
  "INV-T2-EDITOR-LAUNCH",
  "INV-T2-GIT",
  "INV-T2-HTTP-SERVE",
  "INV-T2-NET-TCP",
  "INV-T2-PREVIEW-SCAN",
  "INV-T2-PROJECT-SETUP",
  "INV-T2-RELAY-AWARENESS",
  "INV-T2-RELAY-CLIENT",
  "INV-T2-RELAY-HTTP",
  "INV-T2-SC-ADO",
  "INV-T2-SC-BITBUCKET",
  "INV-T2-SC-GITHUB",
  "INV-T2-SC-GITLAB",
  "INV-T2-TAILSCALE",
  "INV-T2-TEL-ANALYTICS",
  "INV-T2-TEL-DESKTOP-CONTROL",
] as const;

export type G9B3CommId = (typeof B3_SUBPROCESS_EXTERNAL_TRANSPORT_COMM_IDS)[number];

/** B3-callable capture inputs (all twenty-one ledger phases for the sixteen rows). */
export type G9B3CaptureOccurrenceInput = Extract<
  G9CaptureOccurrenceInput,
  { readonly comm_id: G9B3CommId }
>;

/** Live-safe capture function (error channel never). */
export type G9B3CaptureFn = G9CaptureServiceShape["captureOccurrence"];

type ExtractB3<C extends G9B3CommId, P extends string> = Extract<
  G9B3CaptureOccurrenceInput,
  { readonly comm_id: C; readonly phase: P }
>;

export type G9B3GitMethod = ExtractB3<"INV-T2-GIT", "git-execute-succeeded">["input"]["method"];

export type G9B3BitbucketOperation = ExtractB3<
  "INV-T2-SC-BITBUCKET",
  "http-client-succeeded"
>["input"]["operation"];

export type G9B3TailscaleOperation = ExtractB3<
  "INV-T2-TAILSCALE",
  "tailscale-command-succeeded"
>["input"]["operation"];

export type G9B3RelayHttpMember = ExtractB3<
  "INV-T2-RELAY-HTTP",
  "relay-http-client-succeeded"
>["input"]["member_id"];

export type G9B3NetResultClass = ExtractB3<
  "INV-T2-NET-TCP",
  "net-canListenOnHost-resolved"
>["input"]["result_class"];

export type G9B3DesktopControlOperation = ExtractB3<
  "INV-T2-TEL-DESKTOP-CONTROL",
  "desktop-control-send-succeeded"
>["input"]["operation"];

type ScCliCommId = "INV-T2-SC-GITHUB" | "INV-T2-SC-GITLAB" | "INV-T2-SC-ADO";

/**
 * Land notes for INV-T2-GIT on VcsDriver (W5c sole lander).
 *
 * Agent: VcsDriver.of wraps public method success with captureGitExecuteSucceeded.
 * B2 FILE-CHECKPOINTS wraps live on the same shape via captureCheckpointSucceeded.
 */
export const G9_B3_VCSDRIVER_GIT_HANDOFF = {
  lander: "WP5-B3-Owner",
  live_file: "apps/server/src/vcs/VcsDriver.ts",
  planning_owner: "WP5-B3",
  rfc: "RFC-014 A",
  wave: "W5c",
  integrates_before_land: "B2 INV-T2-FILE-CHECKPOINTS handoff on VcsDriver.ts",
  phases: [
    {
      comm_id: "INV-T2-GIT",
      phase: "git-execute-succeeded",
      live_sites: [
        "VcsDriver.execute",
        "detectRepository",
        "isInsideWorkTree",
        "listWorkspaceFiles",
        "listRemotes",
        "filterIgnoredPaths",
        "initRepository",
      ],
      helper: "captureGitExecuteSucceeded",
      equality_key: "method",
      sensitive_exclusions: ["stdout", "stderr", "cwd", "args", "error_string"],
    },
  ],
  forbidden_in_w5a: [
    "apps/server/src/vcs/VcsDriver.ts commits",
    "payload / error-string retention in equality A",
  ],
} as const;

/**
 * Land notes for INV-T2-RELAY-CLIENT on relayClient (W5c sole lander).
 *
 * Agent: runCommand captures spawn/exit; resolve captures B2 FLAG-CLOUDFLARED.
 * Shared package uses RelayClientOptionalG9Capture with the same Context key as
 * server G9CaptureService (no shared→server import).
 */
export const G9_B3_RELAYCLIENT_HANDOFF = {
  lander: "WP5-B3-Owner",
  live_file: "packages/shared/src/relayClient.ts",
  planning_owner: "WP5-B3",
  rfc: "RFC-014 A",
  wave: "W5c",
  integrates_before_land: "B2 INV-T2-FLAG-CLOUDFLARED handoff on relayClient.ts",
  phases: [
    {
      comm_id: "INV-T2-RELAY-CLIENT",
      phase: "cloudflared-spawn-succeeded",
      live_site: "makeCloudflaredRelayClient / runCommand spawner.spawn",
      helper: "captureCloudflaredSpawnSucceeded",
      input: { site: "spawned" },
      sensitive_exclusions: ["command", "args", "path", "error_string"],
    },
    {
      comm_id: "INV-T2-RELAY-CLIENT",
      phase: "cloudflared-exit-succeeded",
      live_site: "child.exitCode observed after spawn",
      helper: "captureCloudflaredExitSucceeded",
      input: { site: "exited" },
      sensitive_exclusions: ["exitCode_number_in_A", "stderr", "error_string"],
    },
  ],
  forbidden_in_w5a: [
    "packages/shared/src/relayClient.ts commits",
    "payload / error-string retention in equality A",
  ],
} as const;

/**
 * Handoff notes for INV-T2-TEL-DESKTOP-CONTROL → B5 DesktopTelemetryReceiver.
 *
 * Agent: B3 authors helpers here. B5 is the sole WP5 lander on
 * DesktopTelemetryReceiver.ts (plan serial hotspot). Do not edit that live
 * file in W5a.
 */
export const G9_B3_DESKTOP_CONTROL_HANDOFF = {
  lander: "WP5-B5-Owner",
  live_file: "apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts",
  planning_owner: "WP5-B3",
  rfc: "RFC-014 A",
  phases: [
    {
      comm_id: "INV-T2-TEL-DESKTOP-CONTROL",
      phase: "desktop-control-send-succeeded",
      live_site: "sendControlMessage after setDiagnosticsDemand / setHostPowerIntervals succeed",
      helper: "captureDesktopControlSendSucceeded",
      equality_key: "operation",
      sensitive_exclusions: ["enabled", "activeIntervalMs", "idleIntervalMs", "encoded_payload"],
    },
  ],
  forbidden_in_w5a: [
    "apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts commits",
    "OTLP post-success capture (WP6)",
    "control payload retention in equality A",
  ],
} as const;

/**
 * Run a B3 (or B2 handoff) capture body only when G9CaptureService is present.
 *
 * Intended: absent service ⇒ Effect.void (live path unchanged). Present ⇒
 * invoke run with captureOccurrence. Never fails the live caller.
 *
 * Parameters
 * ----------
 * run : (capture) => Effect&lt;void, never&gt;
 *     Family capture helper call (already never-failing).
 */
export const whenG9CapturePresent = (
  run: (capture: G9B3CaptureFn) => Effect.Effect<unknown, never>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const capture = yield* Effect.serviceOption(G9CaptureService);
    if (Option.isNone(capture)) return;
    yield* run((input) => capture.value.captureOccurrence(input));
  });

/**
 * Sole B3 capture path. Projects already-bounded input into live-safe capture.
 *
 * Parameters
 * ----------
 * capture : G9B3CaptureFn
 *     Live-safe captureOccurrence (never-failing error channel).
 * input : G9B3CaptureOccurrenceInput
 *     Ledger (comm_id, phase, input) for a B3 phase.
 *
 * Returns
 * -------
 * Effect&lt;void, never&gt;
 *     Discards capture result; live caller stays void.
 */
export const captureSubprocessExternalTransportOccurrence = (
  capture: G9B3CaptureFn,
  input: G9B3CaptureOccurrenceInput,
): Effect.Effect<void, never> => capture(input).pipe(Effect.asVoid);

/** Build INV-T2-GIT / git-execute-succeeded (method only; no stdout). */
export const buildGitExecuteCaptureInput = (
  method: G9B3GitMethod,
): ExtractB3<"INV-T2-GIT", "git-execute-succeeded"> => ({
  comm_id: "INV-T2-GIT",
  phase: "git-execute-succeeded",
  input: { method },
});

/** Build SC CLI success input (GitHub / GitLab / ADO share G9CliA shape). */
export const buildScCliCaptureInput = (
  comm_id: ScCliCommId,
): ExtractB3<ScCliCommId, "cli-execute-succeeded"> =>
  ({
    comm_id,
    phase: "cli-execute-succeeded",
    input: { comm_id: "cli-execute-succeeded" },
  }) as ExtractB3<ScCliCommId, "cli-execute-succeeded">;

/**
 * Build INV-T2-SC-BITBUCKET / http-client-succeeded.
 * Agent: A.operation is exactly the ten BitbucketApiOperation members (RFC-011).
 * Typed failure identities and English error strings are not success fixtures.
 */
export const buildBitbucketCaptureInput = (
  operation: G9B3BitbucketOperation,
): ExtractB3<"INV-T2-SC-BITBUCKET", "http-client-succeeded"> => ({
  comm_id: "INV-T2-SC-BITBUCKET",
  phase: "http-client-succeeded",
  input: { operation },
});

/** Build INV-T2-PREVIEW-SCAN process/probe success (presence only). */
export const buildPreviewScanCaptureInput = (
  phase: "scan-process-succeeded" | "scan-probe-succeeded",
): ExtractB3<"INV-T2-PREVIEW-SCAN", typeof phase> =>
  ({
    comm_id: "INV-T2-PREVIEW-SCAN",
    phase,
    input: { comm_id: "present" },
  }) as ExtractB3<"INV-T2-PREVIEW-SCAN", typeof phase>;

/** Build INV-T2-PROJECT-SETUP / project-setup-started (site only). */
export const buildProjectSetupCaptureInput = (): ExtractB3<
  "INV-T2-PROJECT-SETUP",
  "project-setup-started"
> => ({
  comm_id: "INV-T2-PROJECT-SETUP",
  phase: "project-setup-started",
  input: { site: "project-setup-started" },
});

/** Build INV-T2-TAILSCALE command success (configure|disable only). */
export const buildTailscaleCaptureInput = (
  operation: G9B3TailscaleOperation,
): ExtractB3<"INV-T2-TAILSCALE", "tailscale-command-succeeded"> => ({
  comm_id: "INV-T2-TAILSCALE",
  phase: "tailscale-command-succeeded",
  input: { operation },
});

/** Build INV-T2-RELAY-CLIENT cloudflared spawn (site only). */
export const buildCloudflaredSpawnCaptureInput = (): ExtractB3<
  "INV-T2-RELAY-CLIENT",
  "cloudflared-spawn-succeeded"
> => ({
  comm_id: "INV-T2-RELAY-CLIENT",
  phase: "cloudflared-spawn-succeeded",
  input: { site: "spawned" },
});

/** Build INV-T2-RELAY-CLIENT cloudflared exit (site only; no exitCode in A). */
export const buildCloudflaredExitCaptureInput = (): ExtractB3<
  "INV-T2-RELAY-CLIENT",
  "cloudflared-exit-succeeded"
> => ({
  comm_id: "INV-T2-RELAY-CLIENT",
  phase: "cloudflared-exit-succeeded",
  input: { site: "exited" },
});

/** Build INV-T2-EDITOR-LAUNCH spawn success (presence only). */
export const buildEditorLaunchCaptureInput = (): ExtractB3<
  "INV-T2-EDITOR-LAUNCH",
  "editor-spawn-succeeded"
> => ({
  comm_id: "INV-T2-EDITOR-LAUNCH",
  phase: "editor-spawn-succeeded",
  input: { comm_id: "present" },
});

/** Build INV-T2-HTTP-SERVE listen mark (site only; once per bind). */
export const buildHttpServeCaptureInput = (): ExtractB3<
  "INV-T2-HTTP-SERVE",
  "http-listening-marked"
> => ({
  comm_id: "INV-T2-HTTP-SERVE",
  phase: "http-listening-marked",
  input: { site: "listening" },
});

/** Build INV-T2-RELAY-HTTP client success (member_id only; no tokens). */
export const buildRelayHttpCaptureInput = (
  member_id: G9B3RelayHttpMember,
): ExtractB3<"INV-T2-RELAY-HTTP", "relay-http-client-succeeded"> => ({
  comm_id: "INV-T2-RELAY-HTTP",
  phase: "relay-http-client-succeeded",
  input: { member_id },
});

/** Build INV-T2-RELAY-AWARENESS publish success. */
export const buildRelayAwarenessCaptureInput = (): ExtractB3<
  "INV-T2-RELAY-AWARENESS",
  "awareness-publish-succeeded"
> => ({
  comm_id: "INV-T2-RELAY-AWARENESS",
  phase: "awareness-publish-succeeded",
  input: { operation: "publishAgentActivity" },
});

/** Build INV-T2-TEL-ANALYTICS posthog batch success (presence only). */
export const buildAnalyticsCaptureInput = (): ExtractB3<
  "INV-T2-TEL-ANALYTICS",
  "posthog-batch-succeeded"
> => ({
  comm_id: "INV-T2-TEL-ANALYTICS",
  phase: "posthog-batch-succeeded",
  input: { comm_id: "present" },
});

/**
 * Build INV-T2-TEL-DESKTOP-CONTROL send success (operation only).
 * Agent: B5 lands this on DesktopTelemetryReceiver; B3 owns the helper.
 */
export const buildDesktopControlCaptureInput = (
  operation: G9B3DesktopControlOperation,
): ExtractB3<"INV-T2-TEL-DESKTOP-CONTROL", "desktop-control-send-succeeded"> => ({
  comm_id: "INV-T2-TEL-DESKTOP-CONTROL",
  phase: "desktop-control-send-succeeded",
  input: { operation },
});

/** Build INV-T2-NET-TCP canListen / isPortAvailable (result_class only). */
export const buildNetListenCheckCaptureInput = (
  phase: "net-canListenOnHost-resolved" | "net-isPortAvailableOnLoopback-resolved",
  result_class: G9B3NetResultClass,
): ExtractB3<"INV-T2-NET-TCP", typeof phase> =>
  ({
    comm_id: "INV-T2-NET-TCP",
    phase,
    input: { result_class },
  }) as ExtractB3<"INV-T2-NET-TCP", typeof phase>;

/** Build INV-T2-NET-TCP reserveLoopbackPort success. */
export const buildNetReserveLoopbackCaptureInput = (): ExtractB3<
  "INV-T2-NET-TCP",
  "net-reserveLoopbackPort-resolved"
> => ({
  comm_id: "INV-T2-NET-TCP",
  phase: "net-reserveLoopbackPort-resolved",
  input: { operation: "reserveLoopbackPort" },
});

/** Build INV-T2-NET-TCP findAvailablePort success. */
export const buildNetFindAvailablePortCaptureInput = (): ExtractB3<
  "INV-T2-NET-TCP",
  "net-findAvailablePort-resolved"
> => ({
  comm_id: "INV-T2-NET-TCP",
  phase: "net-findAvailablePort-resolved",
  input: { operation: "findAvailablePort" },
});

/** Convenience: GIT method success → one captureOccurrence (VcsDriver lander). */
export const captureGitExecuteSucceeded = (
  capture: G9B3CaptureFn,
  method: G9B3GitMethod,
): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildGitExecuteCaptureInput(method));

/** Convenience: SC CLI success → one captureOccurrence. */
export const captureScCliExecuteSucceeded = (
  capture: G9B3CaptureFn,
  comm_id: ScCliCommId,
): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildScCliCaptureInput(comm_id));

/** Convenience: Bitbucket operation success → one captureOccurrence. */
export const captureBitbucketHttpClientSucceeded = (
  capture: G9B3CaptureFn,
  operation: G9B3BitbucketOperation,
): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildBitbucketCaptureInput(operation));

/** Convenience: preview scan process/probe → one captureOccurrence. */
export const capturePreviewScanSucceeded = (
  capture: G9B3CaptureFn,
  phase: "scan-process-succeeded" | "scan-probe-succeeded",
): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildPreviewScanCaptureInput(phase));

/** Convenience: project setup started → one captureOccurrence. */
export const captureProjectSetupStarted = (capture: G9B3CaptureFn): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildProjectSetupCaptureInput());

/** Convenience: tailscale configure|disable → one captureOccurrence. */
export const captureTailscaleCommandSucceeded = (
  capture: G9B3CaptureFn,
  operation: G9B3TailscaleOperation,
): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildTailscaleCaptureInput(operation));

/** Convenience: cloudflared spawn → one captureOccurrence (relayClient lander). */
export const captureCloudflaredSpawnSucceeded = (
  capture: G9B3CaptureFn,
): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildCloudflaredSpawnCaptureInput());

/** Convenience: cloudflared exit → one captureOccurrence (relayClient lander). */
export const captureCloudflaredExitSucceeded = (
  capture: G9B3CaptureFn,
): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildCloudflaredExitCaptureInput());

/** Convenience: editor spawn → one captureOccurrence. */
export const captureEditorSpawnSucceeded = (capture: G9B3CaptureFn): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildEditorLaunchCaptureInput());

/** Convenience: HTTP listen mark → one captureOccurrence. */
export const captureHttpListeningMarked = (capture: G9B3CaptureFn): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildHttpServeCaptureInput());

/** Convenience: relay HTTP member → one captureOccurrence. */
export const captureRelayHttpClientSucceeded = (
  capture: G9B3CaptureFn,
  member_id: G9B3RelayHttpMember,
): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildRelayHttpCaptureInput(member_id));

/** Convenience: awareness publish → one captureOccurrence. */
export const captureAwarenessPublishSucceeded = (
  capture: G9B3CaptureFn,
): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildRelayAwarenessCaptureInput());

/** Convenience: analytics batch → one captureOccurrence. */
export const captureAnalyticsBatchSucceeded = (
  capture: G9B3CaptureFn,
): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildAnalyticsCaptureInput());

/**
 * Desktop-control send handoff helper for B5 DesktopTelemetryReceiver lander.
 * Call only after sendControlMessage succeeds; never put control payload in A.
 */
export const captureDesktopControlSendSucceeded = (
  capture: G9B3CaptureFn,
  operation: G9B3DesktopControlOperation,
): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildDesktopControlCaptureInput(operation));

/** Convenience: Net listen-check resolve → one captureOccurrence. */
export const captureNetListenCheckResolved = (
  capture: G9B3CaptureFn,
  phase: "net-canListenOnHost-resolved" | "net-isPortAvailableOnLoopback-resolved",
  result_class: G9B3NetResultClass,
): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(
    capture,
    buildNetListenCheckCaptureInput(phase, result_class),
  );

/** Convenience: Net reserveLoopbackPort → one captureOccurrence. */
export const captureNetReserveLoopbackPortResolved = (
  capture: G9B3CaptureFn,
): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildNetReserveLoopbackCaptureInput());

/** Convenience: Net findAvailablePort → one captureOccurrence. */
export const captureNetFindAvailablePortResolved = (
  capture: G9B3CaptureFn,
): Effect.Effect<void, never> =>
  captureSubprocessExternalTransportOccurrence(capture, buildNetFindAvailablePortCaptureInput());

/**
 * Closed list of the ten BitbucketApiOperation success members (RFC-011).
 * Agent: do not expand with failure identities or English error strings.
 */
export const B3_BITBUCKET_API_OPERATIONS = [
  "resolveRepository",
  "getRepository",
  "getBranchingModel",
  "getPullRequest",
  "listPullRequests",
  "createRepository",
  "createPullRequest",
  "probeAuth",
  "checkoutPullRequest",
  "request",
] as const satisfies ReadonlyArray<G9B3BitbucketOperation>;

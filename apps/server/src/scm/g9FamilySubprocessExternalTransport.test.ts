/**
 * WP5 B3 subprocess-external-transport family tests (Mode B Wave W5a/W5c).
 *
 * Intended: helpers call captureOccurrence once with ledger-bounded input;
 * VcsDriver / relayClient / desktop-control handoff notes name sole landers;
 * A never carries payload, stdout, or error strings; Bitbucket A.operation is
 * the ten BitbucketApiOperation members only (RFC-011).
 *
 * Observed: assertions against mocked capture Ref + whenG9CapturePresent.
 * Does not authorize G10.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { G9_LEDGER_PHASE_PAIRS } from "./g9CaptureInput.generated.ts";
import {
  B3_BITBUCKET_API_OPERATIONS,
  B3_SUBPROCESS_EXTERNAL_TRANSPORT_COMM_IDS,
  G9_B3_DESKTOP_CONTROL_HANDOFF,
  G9_B3_RELAYCLIENT_HANDOFF,
  G9_B3_VCSDRIVER_GIT_HANDOFF,
  buildBitbucketCaptureInput,
  buildCloudflaredExitCaptureInput,
  buildCloudflaredSpawnCaptureInput,
  buildDesktopControlCaptureInput,
  buildEditorLaunchCaptureInput,
  buildGitExecuteCaptureInput,
  buildHttpServeCaptureInput,
  buildNetFindAvailablePortCaptureInput,
  buildNetListenCheckCaptureInput,
  buildNetReserveLoopbackCaptureInput,
  buildPreviewScanCaptureInput,
  buildProjectSetupCaptureInput,
  buildRelayAwarenessCaptureInput,
  buildRelayHttpCaptureInput,
  buildScCliCaptureInput,
  buildTailscaleCaptureInput,
  buildAnalyticsCaptureInput,
  captureBitbucketHttpClientSucceeded,
  captureCloudflaredExitSucceeded,
  captureCloudflaredSpawnSucceeded,
  captureDesktopControlSendSucceeded,
  captureGitExecuteSucceeded,
  captureSubprocessExternalTransportOccurrence,
  whenG9CapturePresent,
  type G9B3CaptureOccurrenceInput,
} from "./g9FamilySubprocessExternalTransport.ts";
import { G9CaptureService } from "./g9OrchQueueCapture.ts";
import type { G9CaptureOccurrenceInput, G9CaptureResult, G9EqualityA } from "./g9Occurrence.ts";

/** Test stub: shape only; does not prove coordinator W1 projection. */
const stubEnqueued = (input: G9CaptureOccurrenceInput): G9CaptureResult => ({
  status: "enqueued",
  occurrence: {
    comm_id: input.comm_id,
    phase_id: input.phase,
    node_id: "node.test",
    origin_bus_id: "bus.test",
    attempt_sequence: 0,
    equality_A: input.input as G9EqualityA,
    semanticKind: "request",
    request_label: input.phase,
    state_label: "",
    retainCurrentAfterPublish: false,
  },
});

/** Keys that must never appear in B3 public A (payload / error retention ban). */
const FORBIDDEN_A_KEYS = [
  "stdout",
  "stderr",
  "payload",
  "error",
  "error_string",
  "message",
  "body",
  "token",
  "cwd",
  "args",
  "command",
  "enabled",
  "activeIntervalMs",
  "idleIntervalMs",
] as const;

describe("g9FamilySubprocessExternalTransport (WP5 B3)", () => {
  it("B3 comm_id set is sixteen ledger rows with twenty-one phases", () => {
    assert.equal(B3_SUBPROCESS_EXTERNAL_TRANSPORT_COMM_IDS.length, 16);
    const b3Set = new Set<string>(B3_SUBPROCESS_EXTERNAL_TRANSPORT_COMM_IDS);
    const phases = G9_LEDGER_PHASE_PAIRS.filter((p) => b3Set.has(p.comm_id));
    assert.equal(phases.length, 21);
  });

  it("VcsDriver GIT handoff names B3 sole lander and seven method sites", () => {
    assert.equal(G9_B3_VCSDRIVER_GIT_HANDOFF.lander, "WP5-B3-Owner");
    assert.equal(G9_B3_VCSDRIVER_GIT_HANDOFF.live_file, "apps/server/src/vcs/VcsDriver.ts");
    assert.equal(G9_B3_VCSDRIVER_GIT_HANDOFF.phases.length, 1);
    assert.equal(G9_B3_VCSDRIVER_GIT_HANDOFF.phases[0]?.phase, "git-execute-succeeded");
    assert.equal(G9_B3_VCSDRIVER_GIT_HANDOFF.phases[0]?.live_sites.length, 7);
    assert.equal(
      G9_B3_VCSDRIVER_GIT_HANDOFF.forbidden_in_w5a.includes(
        "apps/server/src/vcs/VcsDriver.ts commits",
      ),
      true,
    );
  });

  it("relayClient handoff names B3 sole lander and spawn/exit phases", () => {
    assert.equal(G9_B3_RELAYCLIENT_HANDOFF.lander, "WP5-B3-Owner");
    assert.equal(G9_B3_RELAYCLIENT_HANDOFF.live_file, "packages/shared/src/relayClient.ts");
    assert.equal(G9_B3_RELAYCLIENT_HANDOFF.phases.length, 2);
    assert.equal(G9_B3_RELAYCLIENT_HANDOFF.phases[0]?.phase, "cloudflared-spawn-succeeded");
    assert.equal(G9_B3_RELAYCLIENT_HANDOFF.phases[1]?.phase, "cloudflared-exit-succeeded");
  });

  it("desktop-control handoff names B5 lander on DesktopTelemetryReceiver", () => {
    assert.equal(G9_B3_DESKTOP_CONTROL_HANDOFF.lander, "WP5-B5-Owner");
    assert.equal(
      G9_B3_DESKTOP_CONTROL_HANDOFF.live_file,
      "apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts",
    );
    assert.equal(G9_B3_DESKTOP_CONTROL_HANDOFF.planning_owner, "WP5-B3");
    assert.equal(G9_B3_DESKTOP_CONTROL_HANDOFF.phases[0]?.phase, "desktop-control-send-succeeded");
    assert.equal(
      G9_B3_DESKTOP_CONTROL_HANDOFF.forbidden_in_w5a.includes(
        "apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts commits",
      ),
      true,
    );
  });

  it("BitbucketApiOperation closed set is exactly ten success members", () => {
    assert.equal(B3_BITBUCKET_API_OPERATIONS.length, 10);
    assert.deepEqual(
      [...B3_BITBUCKET_API_OPERATIONS],
      [
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
      ],
    );
  });

  it.effect("GIT execute calls captureOccurrence once with method-only A", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const capture = (input: G9CaptureOccurrenceInput) =>
        Effect.gen(function* () {
          yield* Ref.update(calls, (xs) => [...xs, input]);
          return stubEnqueued(input);
        });

      yield* captureGitExecuteSucceeded(capture, "detectRepository");
      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 1);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-GIT",
        phase: "git-execute-succeeded",
        input: { method: "detectRepository" },
      });
      assert.deepEqual(Object.keys(seen[0]!.input).sort(), ["method"]);
    }),
  );

  it.effect("whenG9CapturePresent no-ops when service absent and captures when present", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      yield* whenG9CapturePresent((capture) => captureGitExecuteSucceeded(capture, "execute"));
      assert.equal((yield* Ref.get(calls)).length, 0);

      const layer = Layer.succeed(G9CaptureService, {
        captureOccurrence: (input) =>
          Effect.gen(function* () {
            yield* Ref.update(calls, (xs) => [...xs, input]);
            return stubEnqueued(input);
          }),
      });
      yield* whenG9CapturePresent((capture) =>
        captureGitExecuteSucceeded(capture, "listRemotes"),
      ).pipe(Effect.provide(layer));
      const seen = yield* Ref.get(calls);
      assert.deepEqual(seen, [
        {
          comm_id: "INV-T2-GIT",
          phase: "git-execute-succeeded",
          input: { method: "listRemotes" },
        },
      ]);
    }),
  );

  it.effect("Bitbucket + cloudflared + desktop-control project bounded A only", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const capture = (input: G9CaptureOccurrenceInput) =>
        Effect.gen(function* () {
          yield* Ref.update(calls, (xs) => [...xs, input]);
          return stubEnqueued(input);
        });

      yield* captureBitbucketHttpClientSucceeded(capture, "resolveRepository");
      yield* captureCloudflaredSpawnSucceeded(capture);
      yield* captureCloudflaredExitSucceeded(capture);
      yield* captureDesktopControlSendSucceeded(capture, "setDiagnosticsDemand");

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 4);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-SC-BITBUCKET",
        phase: "http-client-succeeded",
        input: { operation: "resolveRepository" },
      });
      assert.deepEqual(seen[1], {
        comm_id: "INV-T2-RELAY-CLIENT",
        phase: "cloudflared-spawn-succeeded",
        input: { site: "spawned" },
      });
      assert.deepEqual(seen[2], {
        comm_id: "INV-T2-RELAY-CLIENT",
        phase: "cloudflared-exit-succeeded",
        input: { site: "exited" },
      });
      assert.deepEqual(seen[3], {
        comm_id: "INV-T2-TEL-DESKTOP-CONTROL",
        phase: "desktop-control-send-succeeded",
        input: { operation: "setDiagnosticsDemand" },
      });
    }),
  );

  it.effect("builders cover all sixteen B3 rows without forbidden A keys", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const capture = (input: G9CaptureOccurrenceInput) =>
        Effect.gen(function* () {
          yield* Ref.update(calls, (xs) => [...xs, input]);
          return stubEnqueued(input);
        });

      const inputs: G9B3CaptureOccurrenceInput[] = [
        buildEditorLaunchCaptureInput(),
        buildGitExecuteCaptureInput("execute"),
        buildHttpServeCaptureInput(),
        buildNetListenCheckCaptureInput("net-canListenOnHost-resolved", "available"),
        buildNetListenCheckCaptureInput("net-isPortAvailableOnLoopback-resolved", "unavailable"),
        buildNetReserveLoopbackCaptureInput(),
        buildNetFindAvailablePortCaptureInput(),
        buildPreviewScanCaptureInput("scan-process-succeeded"),
        buildPreviewScanCaptureInput("scan-probe-succeeded"),
        buildProjectSetupCaptureInput(),
        buildRelayAwarenessCaptureInput(),
        buildCloudflaredSpawnCaptureInput(),
        buildCloudflaredExitCaptureInput(),
        buildRelayHttpCaptureInput("environment-link"),
        buildScCliCaptureInput("INV-T2-SC-ADO"),
        buildBitbucketCaptureInput("request"),
        buildScCliCaptureInput("INV-T2-SC-GITHUB"),
        buildScCliCaptureInput("INV-T2-SC-GITLAB"),
        buildTailscaleCaptureInput("configure"),
        buildAnalyticsCaptureInput(),
        buildDesktopControlCaptureInput("setHostPowerIntervals"),
      ];

      assert.equal(inputs.length, 21);

      for (const input of inputs) {
        yield* captureSubprocessExternalTransportOccurrence(capture, input);
      }

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 21);

      const covered = new Set(seen.map((c) => c.comm_id));
      for (const commId of B3_SUBPROCESS_EXTERNAL_TRANSPORT_COMM_IDS) {
        assert.equal(covered.has(commId), true, `missing ${commId}`);
      }

      for (const call of seen) {
        assert.equal(call.comm_id.includes("OTLP"), false);
        for (const key of FORBIDDEN_A_KEYS) {
          assert.equal(
            Object.prototype.hasOwnProperty.call(call.input, key),
            false,
            `${call.comm_id}/${call.phase} retained ${key}`,
          );
        }
      }
    }),
  );
});

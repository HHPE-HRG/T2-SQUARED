/**
 * Preview invoke admission gate.
 *
 * Intended: env unset does not consult the snapshot and still calls the
 * broker. Env set fail-closes a drifted tool before broker.invoke, and
 * fail-closes when the snapshot is missing.
 */
import {
  EnvironmentId,
  PreviewAutomationAdmissionDeniedError,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as PreviewAutomationBroker from "../../PreviewAutomationBroker.ts";
import {
  ADMISSION_RECONCILE_ENV,
  admitCapability,
  createCapabilityRecord,
} from "../../../scm/admissionCatalog.ts";
import { installAdmittedSnapshot } from "../../../scm/admissionDispatch.ts";
import { compareCatalog } from "../../../scm/admissionDrift.ts";
import { discoverPreviewTools } from "../../../scm/admissionDiscover.ts";
import { invokePreviewOperation } from "./handlers.ts";

const invocation: McpInvocationContext.McpInvocationScope = {
  environmentId: EnvironmentId.make("environment-1"),
  threadId: ThreadId.make("thread-1"),
  providerSessionId: "provider-session-1",
  providerInstanceId: ProviderInstanceId.make("codex"),
  capabilities: new Set(["preview"]),
  issuedAt: 1,
};

const restoreEnv = (previous: string | undefined): void => {
  if (previous === undefined) delete process.env[ADMISSION_RECONCILE_ENV];
  else process.env[ADMISSION_RECONCILE_ENV] = previous;
};

it.effect(
  "leaves preview invoke unchanged when the env is unset and fail-closes drift when set",
  () => {
    const previous = process.env[ADMISSION_RECONCILE_ENV];
    const calls: string[] = [];
    const broker = {
      connect: () => Effect.die("connect is unused"),
      focusHost: () => Effect.die("focusHost is unused"),
      respond: () => Effect.die("respond is unused"),
      invoke: <A>(request: { readonly operation: string }) =>
        Effect.sync(() => {
          calls.push(request.operation);
          return { available: true } as A;
        }),
    };

    return Effect.gen(function* () {
      delete process.env[ADMISSION_RECONCILE_ENV];
      installAdmittedSnapshot(null);
      const ungated = yield* invokePreviewOperation("navigate", {}).pipe(
        Effect.provideService(McpInvocationContext.McpInvocationContext, invocation),
        Effect.provideService(PreviewAutomationBroker.PreviewAutomationBroker, broker),
      );
      assert.deepEqual(ungated, { available: true });
      assert.deepEqual(calls, ["navigate"]);

      const proposed = discoverPreviewTools(["preview_navigate"])[0];
      assert.ok(proposed);
      const admitted = admitCapability([proposed], "preview_navigate");
      const drifted = createCapabilityRecord({
        ...proposed,
        input_schema: "preview_navigate-drifted",
      });
      const compared = compareCatalog(admitted, [drifted]);
      installAdmittedSnapshot(compared.records, compared.deltas);
      process.env[ADMISSION_RECONCILE_ENV] = "1";
      calls.length = 0;
      const denied = yield* invokePreviewOperation("navigate", {}).pipe(
        Effect.provideService(McpInvocationContext.McpInvocationContext, invocation),
        Effect.provideService(PreviewAutomationBroker.PreviewAutomationBroker, broker),
        Effect.flip,
      );
      assert.ok(denied instanceof PreviewAutomationAdmissionDeniedError);
      assert.equal(denied.reason, "pending-drift");
      assert.equal(denied.capabilityId, "preview_navigate");
      assert.deepEqual(calls, []);

      installAdmittedSnapshot(null);
      const missing = yield* invokePreviewOperation("status", {}).pipe(
        Effect.provideService(McpInvocationContext.McpInvocationContext, invocation),
        Effect.provideService(PreviewAutomationBroker.PreviewAutomationBroker, broker),
        Effect.flip,
      );
      assert.ok(missing instanceof PreviewAutomationAdmissionDeniedError);
      assert.equal(missing.reason, "missing-snapshot");
      assert.deepEqual(calls, []);
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          installAdmittedSnapshot(null);
          restoreEnv(previous);
        }),
      ),
    );
  },
);

// @effect-diagnostics nodeBuiltinImport:off
/**
 * G9 WP7 bootstrap gate + composition tests (W7-BOOT).
 *
 * Intended: absent env ⇒ no G9CaptureService and no loadG9Package side effect;
 * present ⇒ ten-bus coordinator, armed waker under Layer, live-safe capture;
 * bootstrap source never references home-bus-link fabric.
 *
 * Observed: assertions below. Does not flip g9toG10Authorized. Does not
 * authorize G10. Does not edit server.ts beyond the gated merge under test.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  type OrchestrationCommand,
} from "@t3tools/contracts";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import {
  G9_SHADOW_PARITY_ENV,
  buildG9ShadowStack,
  g9ShadowStackLayerFromEnv,
  isG9ShadowParityEnabled,
  resolveG9RepoRoot,
} from "./g9Bootstrap.ts";
import { G9CaptureService, captureIfOfferAccepted } from "./g9OrchQueueCapture.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveG9RepoRoot();
const bootstrapSourcePath = join(here, "g9Bootstrap.ts");

const clientCmd = (): OrchestrationCommand => ({
  type: "thread.create",
  commandId: CommandId.make("cmd-g9-boot-client"),
  threadId: ThreadId.make("thread-g9-boot"),
  projectId: ProjectId.make("project-g9-boot"),
  title: "G9 Bootstrap",
  modelSelection: {
    instanceId: ProviderInstanceId.make("codex"),
    model: "gpt-5-codex",
  },
  interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
  runtimeMode: "full-access",
  branch: null,
  worktreePath: null,
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("G9 WP7 bootstrap gate (RFC-003 A)", () => {
  it("isG9ShadowParityEnabled defaults false; accepts 1/true/yes", () => {
    assert.equal(isG9ShadowParityEnabled({}), false);
    assert.equal(isG9ShadowParityEnabled({ [G9_SHADOW_PARITY_ENV]: "0" }), false);
    assert.equal(isG9ShadowParityEnabled({ [G9_SHADOW_PARITY_ENV]: "1" }), true);
    assert.equal(isG9ShadowParityEnabled({ [G9_SHADOW_PARITY_ENV]: "TRUE" }), true);
    assert.equal(isG9ShadowParityEnabled({ [G9_SHADOW_PARITY_ENV]: " yes " }), true);
  });

  it.effect("absent: Layer.empty leaves G9CaptureService unresolved", () =>
    Effect.gen(function* () {
      const opt = yield* Effect.serviceOption(G9CaptureService);
      assert.equal(Option.isNone(opt), true);
    }).pipe(Effect.provide(g9ShadowStackLayerFromEnv({}))),
  );

  it("absent: g9ShadowStackLayerFromEnv does not call loadG9Package", () => {
    // Gate short-circuit: constructing the Layer must not throw even if repoRoot
    // would be invalid — because load is never reached.
    const layer = g9ShadowStackLayerFromEnv(
      {},
      { repoRoot: join(repoRoot, "definitely-missing-g9-root") },
    );
    assert.ok(layer !== undefined);
  });

  it("bootstrap source does not import home-bus-link fabric", () => {
    const src = readFileSync(bootstrapSourcePath, "utf8");
    // Import path / symbol — comments may mention the law in prose.
    assert.equal(/\bfrom\s+["']\.\/g6HomeBusLink\.ts["']/.test(src), false);
    assert.equal(/\bimport\s*\{[^}]*BidirectionalHomeBusLink/.test(src), false);
  });
});

describe("G9 WP7 bootstrap present stack", () => {
  it("buildG9ShadowStack: exactly ten bus keys; waker starts stopped", () => {
    const stack = buildG9ShadowStack({
      repoRoot,
      sink: { deliver: () => Effect.void },
    });
    assert.equal(stack.coordinator.buses.size, 10);
    assert.equal([...stack.pkg.runtimeBusIds].length, 10);
    assert.equal(stack.waker.state(), "stopped");
    assert.equal(stack.faults.latched(), undefined);
  });

  it.effect("present Layer: G9CaptureService + armed waker; ORCH-QUEUE capture enqueues", () => {
    const stack = buildG9ShadowStack({
      repoRoot,
      sink: { deliver: () => Effect.void },
    });

    return Effect.gen(function* () {
      const capture = yield* G9CaptureService;
      // Present mode arms on Layer start; first wake may already be in-flight.
      const state = stack.waker.state();
      assert.ok(state === "armed-idle" || state === "armed-in-flight", state);

      yield* captureIfOfferAccepted(true, clientCmd(), (input) => capture.captureOccurrence(input));
      assert.equal(stack.coordinator.fifo.depth("node.orchestration"), 1);
      assert.equal(stack.faults.latched(), undefined);
    }).pipe(Effect.provide(stack.layer), Effect.scoped);
  });

  it.effect("present fromEnv: G9CaptureService resolves when gate on", () => {
    const env = { [G9_SHADOW_PARITY_ENV]: "1" };
    return Effect.gen(function* () {
      const opt = yield* Effect.serviceOption(G9CaptureService);
      assert.equal(Option.isSome(opt), true);
    }).pipe(
      Effect.provide(
        g9ShadowStackLayerFromEnv(env, { repoRoot, sink: { deliver: () => Effect.void } }),
      ),
      Effect.scoped,
    );
  });
});

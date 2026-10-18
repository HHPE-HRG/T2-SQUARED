/**
 * W5c VcsDriver sole-lander tests: optional G9 capture on GIT + checkpoints.
 *
 * Intended: VcsDriver.of wraps success paths; absent G9CaptureService ⇒ no
 * captureOccurrence calls; present ⇒ method/operation tokens only in A.
 *
 * Observed: stub driver + Layer.succeed(G9CaptureService). No GitVcsDriver edit.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import { ChildProcessSpawner } from "effect/unstable/process";

import type { VcsDriverCapabilities } from "@t3tools/contracts";
import { CheckpointRef } from "@t3tools/contracts";

import { G9CaptureService, type G9CaptureServiceShape } from "../scm/g9OrchQueueCapture.ts";
import type {
  G9CaptureOccurrenceInput,
  G9CaptureResult,
  G9EqualityA,
} from "../scm/g9Occurrence.ts";
import { VcsDriver, wrapVcsDriverShapeWithG9Capture, type VcsDriverShape } from "./VcsDriver.ts";

const capabilities = {
  kind: "git",
  supportsWorktrees: true,
  supportsBookmarks: false,
  supportsAtomicSnapshot: true,
  supportsPushDefaultRemote: true,
  ignoreClassifier: "native",
} satisfies VcsDriverCapabilities;

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

const makeStubShape = (): VcsDriverShape => ({
  capabilities,
  execute: () =>
    Effect.succeed({
      exitCode: ChildProcessSpawner.ExitCode(0),
      stdout: "SECRET_STDOUT",
      stderr: "",
      stdoutTruncated: false,
      stderrTruncated: false,
    }),
  detectRepository: () => Effect.succeed(null),
  isInsideWorkTree: () => Effect.succeed(true),
  // Unused return bodies in these tests; cast keeps stub focused on capture taps.
  listWorkspaceFiles: () => Effect.succeed({ paths: [], truncated: false } as never),
  listRemotes: () => Effect.succeed({ remotes: [] } as never),
  filterIgnoredPaths: (_cwd, paths) => Effect.succeed(paths),
  initRepository: () => Effect.void,
  checkpoints: {
    captureCheckpoint: () => Effect.void,
    hasCheckpointRef: () => Effect.succeed(true),
    restoreCheckpoint: () => Effect.succeed(true),
    diffCheckpoints: () => Effect.succeed("diff-bytes-must-not-enter-A"),
    deleteCheckpointRefs: () => Effect.void,
  },
});

describe("VcsDriver G9 capture wrap (W5c B3)", () => {
  it.effect("absent G9CaptureService leaves live success without captureOccurrence", () =>
    Effect.gen(function* () {
      const driver = VcsDriver.of(makeStubShape());
      yield* driver.detectRepository("/tmp/repo");
      yield* driver.checkpoints!.captureCheckpoint({
        cwd: "/tmp/repo",
        checkpointRef: CheckpointRef.make("refs/t3/checkpoints/test"),
      });
    }),
  );

  it.effect("present G9CaptureService captures GIT method + checkpoint ops without payloads", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const captureService: G9CaptureServiceShape = {
        captureOccurrence: (input) =>
          Effect.gen(function* () {
            yield* Ref.update(calls, (xs) => [...xs, input]);
            return stubEnqueued(input);
          }),
      };

      const driver = wrapVcsDriverShapeWithG9Capture(makeStubShape());
      yield* driver
        .execute({
          operation: "test",
          cwd: "/tmp/repo",
          args: ["status"],
        })
        .pipe(Effect.provideService(G9CaptureService, captureService));
      yield* driver
        .detectRepository("/tmp/repo")
        .pipe(Effect.provideService(G9CaptureService, captureService));
      yield* driver
        .checkpoints!.hasCheckpointRef({
          cwd: "/tmp/repo",
          checkpointRef: CheckpointRef.make("refs/t3/checkpoints/test"),
        })
        .pipe(Effect.provideService(G9CaptureService, captureService));
      yield* driver
        .checkpoints!.diffCheckpoints({
          cwd: "/tmp/repo",
          fromCheckpointRef: CheckpointRef.make("refs/t3/checkpoints/a"),
          toCheckpointRef: CheckpointRef.make("refs/t3/checkpoints/b"),
          ignoreWhitespace: false,
        })
        .pipe(Effect.provideService(G9CaptureService, captureService));

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 4);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-GIT",
        phase: "git-execute-succeeded",
        input: { method: "execute" },
      });
      assert.deepEqual(seen[1], {
        comm_id: "INV-T2-GIT",
        phase: "git-execute-succeeded",
        input: { method: "detectRepository" },
      });
      assert.deepEqual(seen[2], {
        comm_id: "INV-T2-FILE-CHECKPOINTS",
        phase: "checkpoint-hasCheckpointRef-succeeded",
        input: { operation: "succeeded" },
      });
      assert.deepEqual(seen[3], {
        comm_id: "INV-T2-FILE-CHECKPOINTS",
        phase: "checkpoint-diffCheckpoints-succeeded",
        input: { operation: "diffCheckpoints" },
      });
      for (const call of seen) {
        assert.equal("stdout" in call.input, false);
        assert.equal("stderr" in call.input, false);
        assert.equal("cwd" in call.input, false);
        assert.equal("diff" in call.input, false);
      }
    }),
  );

  it.effect("VcsDriver.of applies the same wrap as wrapVcsDriverShapeWithG9Capture", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const layer = Layer.succeed(G9CaptureService, {
        captureOccurrence: (input) =>
          Effect.gen(function* () {
            yield* Ref.update(calls, (xs) => [...xs, input]);
            return stubEnqueued(input);
          }),
      });

      const driver = VcsDriver.of(makeStubShape());
      yield* driver.initRepository({ cwd: "/tmp/repo" }).pipe(Effect.provide(layer));
      const seen = yield* Ref.get(calls);
      assert.deepEqual(seen, [
        {
          comm_id: "INV-T2-GIT",
          phase: "git-execute-succeeded",
          input: { method: "initRepository" },
        },
      ]);
    }),
  );
});

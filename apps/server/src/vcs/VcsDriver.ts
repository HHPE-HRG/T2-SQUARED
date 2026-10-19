/**
 * VCS driver Context service + W5c G9 capture wrap + G10 S3 GIT cutover
 * (G10-S3-GitRelay sole lander).
 *
 * Intended: GitVcsDriver builds a shape and calls VcsDriver.of; of wraps every
 * public GIT method and optional checkpoint ops so success taps optional
 * G9CaptureService. G10 S3 admit/route/replace wraps GIT via
 * gitExecuteViaG10Bridge. S8 lander-reopen also wraps FILE-CHECKPOINTS via
 * fileCheckpointsViaG10Bridge (S7→S3 handoff; not historical S3 exit (a)).
 * Absent G10/G9 ⇒ identity behavior (live unchanged). Equality A carries
 * method/operation tokens only (no stdout, refs, diffs).
 *
 * Observed: wrapVcsDriverShapeWithG9Capture is the sole live capture fan-out
 * for INV-T2-GIT and B2 INV-T2-FILE-CHECKPOINTS on this hotspot. Does not edit
 * GitVcsDriver.ts / Manager.ts / server.ts. Does not flip g9toG10Authorized.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";

import type {
  VcsDriverCapabilities,
  VcsError,
  VcsInitInput,
  VcsListRemotesResult,
  VcsListWorkspaceFilesResult,
  ReviewDiffPreviewInput,
  ReviewDiffPreviewResult,
  VcsRepositoryIdentity,
} from "@t3tools/contracts";
import { CheckpointRef } from "@t3tools/contracts";

import { captureCheckpointSucceeded } from "../scm/g9FamilyFileDbProcessConfig.ts";
import {
  captureGitExecuteSucceeded,
  whenG9CapturePresent,
  type G9B3GitMethod,
} from "../scm/g9FamilySubprocessExternalTransport.ts";
import { fileCheckpointsViaG10Bridge, gitExecuteViaG10Bridge } from "../scm/g10SliceS3.ts";
import * as VcsProcess from "./VcsProcess.ts";

export interface VcsCaptureCheckpointInput {
  readonly cwd: string;
  readonly checkpointRef: CheckpointRef;
}

export interface VcsRestoreCheckpointInput {
  readonly cwd: string;
  readonly checkpointRef: CheckpointRef;
  readonly fallbackToHead?: boolean;
}

export interface VcsDiffCheckpointsInput {
  readonly cwd: string;
  readonly fromCheckpointRef: CheckpointRef;
  readonly toCheckpointRef: CheckpointRef;
  readonly fallbackFromToHead?: boolean;
  readonly ignoreWhitespace: boolean;
}

export interface VcsDeleteCheckpointRefsInput {
  readonly cwd: string;
  readonly checkpointRefs: ReadonlyArray<CheckpointRef>;
}

export interface VcsCheckpointOps {
  readonly captureCheckpoint: (input: VcsCaptureCheckpointInput) => Effect.Effect<void, VcsError>;
  readonly hasCheckpointRef: (
    input: Omit<VcsRestoreCheckpointInput, "fallbackToHead">,
  ) => Effect.Effect<boolean, VcsError>;
  readonly restoreCheckpoint: (
    input: VcsRestoreCheckpointInput,
  ) => Effect.Effect<boolean, VcsError>;
  readonly diffCheckpoints: (input: VcsDiffCheckpointsInput) => Effect.Effect<string, VcsError>;
  readonly deleteCheckpointRefs: (
    input: VcsDeleteCheckpointRefsInput,
  ) => Effect.Effect<void, VcsError>;
}

/** Public VcsDriver service shape (GIT methods + optional checkpoints / preview). */
export type VcsDriverShape = {
  readonly capabilities: VcsDriverCapabilities;
  readonly execute: (
    input: Omit<VcsProcess.VcsProcessInput, "command">,
  ) => Effect.Effect<VcsProcess.VcsProcessOutput, VcsError>;
  readonly checkpoints?: VcsCheckpointOps;
  readonly detectRepository: (cwd: string) => Effect.Effect<VcsRepositoryIdentity | null, VcsError>;
  readonly isInsideWorkTree: (cwd: string) => Effect.Effect<boolean, VcsError>;
  readonly listWorkspaceFiles: (
    cwd: string,
  ) => Effect.Effect<VcsListWorkspaceFilesResult, VcsError>;
  readonly listRemotes: (cwd: string) => Effect.Effect<VcsListRemotesResult, VcsError>;
  readonly filterIgnoredPaths: (
    cwd: string,
    relativePaths: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<string>, VcsError>;
  readonly initRepository: (input: VcsInitInput) => Effect.Effect<void, VcsError>;
  readonly getDiffPreview?: (
    input: ReviewDiffPreviewInput,
  ) => Effect.Effect<ReviewDiffPreviewResult, VcsError>;
};

/**
 * Tap GIT method success → INV-T2-GIT capture (method token only).
 *
 * Parameters
 * ----------
 * method : G9B3GitMethod
 *     Ledger request_label member for A.method.
 * effect : Effect
 *     Live driver method body (VcsError channel unchanged).
 */
const tapGitSucceeded = <A, E, R>(
  method: G9B3GitMethod,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  // G10 S3 cutover wraps the live GIT method; G9 capture remains observe-beside.
  gitExecuteViaG10Bridge(
    method,
    effect.pipe(
      Effect.tap(() =>
        whenG9CapturePresent((capture) => captureGitExecuteSucceeded(capture, method)),
      ),
    ),
  );

/**
 * Wrap VcsCheckpointOps so each public success emits FILE-CHECKPOINTS A.
 *
 * Agent: hasCheckpointRef projects operation "succeeded" (not the method name).
 * Capture only after Effect succeeds (boolean true/false both count as success).
 */
/**
 * Wrap one checkpoint op: G10 S8 reopen bridge + G9 capture-beside.
 * Agent: cutover ≠ capture; FILE-CHECKPOINTS not claimed under historical S3 exit (a).
 */
const wrapCheckpointOp = <A, E, R>(
  operation:
    | "captureCheckpoint"
    | "restoreCheckpoint"
    | "diffCheckpoints"
    | "deleteCheckpointRefs"
    | "hasCheckpointRef",
  liveOp: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  fileCheckpointsViaG10Bridge(
    operation,
    liveOp.pipe(
      Effect.tap(() =>
        whenG9CapturePresent((capture) => captureCheckpointSucceeded(operation, capture)),
      ),
    ),
  );

const wrapCheckpointOpsWithG9Capture = (checkpoints: VcsCheckpointOps): VcsCheckpointOps => ({
  captureCheckpoint: (input) =>
    wrapCheckpointOp("captureCheckpoint", checkpoints.captureCheckpoint(input)),
  hasCheckpointRef: (input) =>
    wrapCheckpointOp("hasCheckpointRef", checkpoints.hasCheckpointRef(input)),
  restoreCheckpoint: (input) =>
    wrapCheckpointOp("restoreCheckpoint", checkpoints.restoreCheckpoint(input)),
  diffCheckpoints: (input) =>
    wrapCheckpointOp("diffCheckpoints", checkpoints.diffCheckpoints(input)),
  deleteCheckpointRefs: (input) =>
    wrapCheckpointOp("deleteCheckpointRefs", checkpoints.deleteCheckpointRefs(input)),
});

/**
 * Wrap a driver shape with optional G9 capture on declared success boundaries.
 *
 * Intended: GitVcsDriver.makeVcsDriver → VcsDriver.of(shape) applies this once.
 * Observed: getDiffPreview is not an INV-T2-GIT request_label; left unwrapped.
 *
 * Parameters
 * ----------
 * shape : VcsDriverShape
 *     Inner implementation (usually GitVcsDriver).
 *
 * Returns
 * -------
 * VcsDriverShape
 *     Same capabilities; methods tap capture when G9CaptureService is present.
 */
export const wrapVcsDriverShapeWithG9Capture = (shape: VcsDriverShape): VcsDriverShape => ({
  capabilities: shape.capabilities,
  execute: (input) => tapGitSucceeded("execute", shape.execute(input)),
  detectRepository: (cwd) => tapGitSucceeded("detectRepository", shape.detectRepository(cwd)),
  isInsideWorkTree: (cwd) => tapGitSucceeded("isInsideWorkTree", shape.isInsideWorkTree(cwd)),
  listWorkspaceFiles: (cwd) => tapGitSucceeded("listWorkspaceFiles", shape.listWorkspaceFiles(cwd)),
  listRemotes: (cwd) => tapGitSucceeded("listRemotes", shape.listRemotes(cwd)),
  filterIgnoredPaths: (cwd, relativePaths) =>
    tapGitSucceeded("filterIgnoredPaths", shape.filterIgnoredPaths(cwd, relativePaths)),
  initRepository: (input) => tapGitSucceeded("initRepository", shape.initRepository(input)),
  ...(shape.checkpoints !== undefined
    ? { checkpoints: wrapCheckpointOpsWithG9Capture(shape.checkpoints) }
    : {}),
  ...(shape.getDiffPreview !== undefined ? { getDiffPreview: shape.getDiffPreview } : {}),
});

/**
 * VcsDriver Context service.
 *
 * Agent: static of wraps the shape so GitVcsDriver needs no W5c edit. Layer
 * consumers that bypass of and pass a raw shape skip capture (intentional).
 */
export class VcsDriver extends Context.Service<VcsDriver, VcsDriverShape>()("t3/vcs/VcsDriver") {
  /**
   * Construct the service value with G9 capture wrap applied.
   *
   * Parameters
   * ----------
   * shape : VcsDriverShape
   *     Inner driver implementation.
   */
  static of(shape: VcsDriverShape): VcsDriverShape {
    return wrapVcsDriverShapeWithG9Capture(shape);
  }
}

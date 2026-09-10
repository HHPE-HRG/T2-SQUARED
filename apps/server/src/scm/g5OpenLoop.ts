/**
 * G5 in-process open-loop publish observed by T2 OTEL.
 *
 * One word per active node per fundamental timestep. Write at T is
 * readable at T+1. No delivery ACK. Not DIP, halt, clocks, or live fabric.
 */
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import type { Attributes } from "@opentelemetry/api";
import * as Effect from "effect/Effect";

import { withOwnedSpan } from "../t2Observability/T2Observability.ts";
import { checkW1Word, type W1Word } from "./g4Word.ts";

export const G5_REVIEW_IDENTITY = "codex-independent-review";

const MANIFEST_STATUSES = new Set([
  "planned-not-authorized",
  "authorized",
  "in-progress",
  "completed",
]);

/**
 * Memoryless in-process home bus for the G5 prototype.
 *
 * Parameters
 * ----------
 * none
 *
 * Returns
 * -------
 * InProcessOpenLoopBus
 *     Bus that stores the previous fundamental timestep's words.
 *
 * Example
 * -------
 * const bus = new InProcessOpenLoopBus();
 * bus.publish(word);
 * bus.advanceFundamentalTimestep();
 */
export class InProcessOpenLoopBus {
  fundamentalTimestep = 0;
  private readable = new Map<string, W1Word>();
  private writing = new Map<string, W1Word>();

  /**
   * Publish one word for the current fundamental timestep.
   *
   * Parameters
   * ----------
   * word : W1Word
   *     Checked W1 word for this node.
   *
   * Returns
   * -------
   * void
   *
   * Example
   * -------
   * bus.publish(word);
   */
  publish(word: W1Word): void {
    this.writing.set(word.node_id, word);
  }

  /**
   * Read a word written on the previous fundamental timestep.
   *
   * Parameters
   * ----------
   * nodeId : string
   *     Publishing node id.
   *
   * Returns
   * -------
   * W1Word | undefined
   *     Word from T-1, if any.
   *
   * Example
   * -------
   * const seen = bus.read("node.a");
   */
  read(nodeId: string): W1Word | undefined {
    return this.readable.get(nodeId);
  }

  /**
   * Advance one fundamental timestep. Not a process tick.
   *
   * Parameters
   * ----------
   * none
   *
   * Returns
   * -------
   * void
   *
   * Example
   * -------
   * bus.advanceFundamentalTimestep();
   */
  advanceFundamentalTimestep(): void {
    this.readable = this.writing;
    this.writing = new Map();
    this.fundamentalTimestep += 1;
  }
}

/**
 * Content-derived W1 correlation identity.
 *
 * Parameters
 * ----------
 * word : W1Word
 *     Word whose governed fields feed the digest.
 *
 * Returns
 * -------
 * string
 *     SHA-256 hex used by G5 spans and later bridge correlation.
 *
 * Example
 * -------
 * const id = w1WordId(word);
 */
export const w1WordId = (word: W1Word): string =>
  NodeCrypto.createHash("sha256")
    .update(
      [
        word.bus_id,
        word.node_id,
        word.fundamental_state,
        word.fundamental_request,
        String(word.state_age),
        String(word.request_age),
      ].join("\0"),
    )
    .digest("hex");

const canAttributes = (word: W1Word): Attributes => ({
  "t2.scm.bus_id": word.bus_id,
  "t2.scm.node_id": word.node_id,
  "t2.scm.fundamental_request": word.fundamental_request,
  "t2.scm.request_age": word.request_age,
  "t2.scm.word_id": w1WordId(word),
});

/**
 * Observe a publish on the existing T2 OTEL plane after the word is written.
 *
 * Observation must not admit or drop delivery. The write effect runs first.
 *
 * Parameters
 * ----------
 * word : W1Word
 *     Published word.
 * effect : Effect.Effect
 *     Publish side effect.
 *
 * Returns
 * -------
 * Effect.Effect
 *     Same result, then `t2.scm.publish` when T2 observability is present.
 *
 * Example
 * -------
 * yield* observePublish(word, Effect.sync(() => bus.publish(word)));
 */
export const observePublish = <A, E, R>(
  word: W1Word,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.flatMap(effect, (result) =>
    withOwnedSpan("t2.scm.publish", Effect.succeed(result), canAttributes(word)),
  );

/**
 * Observe a receive on the existing T2 OTEL plane after the word is read.
 *
 * Missing words produce no receive span. Observation does not gate delivery.
 *
 * Parameters
 * ----------
 * effect : Effect.Effect
 *     Read side effect. A checked W1 word is observed; other results are not.
 *
 * Returns
 * -------
 * Effect.Effect
 *     Same result, then `t2.scm.receive` when a word was read.
 *
 * Example
 * -------
 * const seen = yield* observeReceive(Effect.sync(() => bus.read("node.a")));
 */
export const observeReceive = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.flatMap(effect, (result) => {
    const checked = checkW1Word(result);
    if (!checked.ok) {
      return Effect.succeed(result);
    }
    return withOwnedSpan("t2.scm.receive", Effect.succeed(result), canAttributes(checked.word));
  });

export interface G5Review {
  status: string;
  identity: string;
  independentOfImplementationAuthor: boolean;
  reviewedArtifactHash: string;
  note?: string;
}

export interface G5Authorization {
  identity: string;
  scope: string;
  note: string;
}

export interface G5Manifest {
  gate: string;
  status: string;
  authorized: boolean;
  completed: boolean;
  doesNotAuthorizeLaterGates: boolean;
  g6toG10Authorized: boolean;
  authorization: G5Authorization;
  review?: G5Review;
}

export interface G5Package {
  repoRoot: string;
  manifest: G5Manifest;
}

export interface G5Failure {
  readonly code: string;
  readonly message: string;
}

export type G5CheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failures: ReadonlyArray<G5Failure> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const manifestForHash = (manifest: G5Manifest): unknown => {
  const cloned = structuredClone(manifest);
  if (cloned.review !== undefined) {
    const review = { ...cloned.review };
    delete (review as { reviewedArtifactHash?: string }).reviewedArtifactHash;
    cloned.review = review;
  }
  return cloned;
};

/**
 * Digest G5 artifacts a completion reviewer must approve.
 *
 * README is explanatory and is not included. `review.reviewedArtifactHash`
 * is omitted so the digest is not self-referential.
 *
 * Parameters
 * ----------
 * pkg : G5Package
 *     Loaded G5 package.
 *
 * Returns
 * -------
 * string
 *     SHA-256 hex of the canonical reviewed package.
 *
 * Example
 * -------
 * const digest = computeG5ReviewedArtifactHash(loadG5Package(repoRoot));
 */
export const computeG5ReviewedArtifactHash = (pkg: G5Package): string =>
  NodeCrypto.createHash("sha256")
    .update(canonicalJson(manifestForHash(pkg.manifest)))
    .digest("hex");

const legalManifestTuple = (manifest: G5Manifest): boolean => {
  if (!MANIFEST_STATUSES.has(manifest.status)) {
    return false;
  }
  if (manifest.status === "planned-not-authorized") {
    return manifest.authorized === false && manifest.completed === false;
  }
  if (manifest.status === "authorized" || manifest.status === "in-progress") {
    return manifest.authorized === true && manifest.completed === false;
  }
  return manifest.authorized === true && manifest.completed === true;
};

/**
 * Load the G5 open-loop package.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     T2-SQUARED repository root.
 *
 * Returns
 * -------
 * G5Package
 *     Manifest only. README is excluded from the reviewed digest.
 *
 * Example
 * -------
 * const pkg = loadG5Package(repoRoot);
 */
export const loadG5Package = (repoRoot: string): G5Package => ({
  repoRoot,
  manifest: JSON.parse(
    NodeFS.readFileSync(NodePath.join(repoRoot, "docs/scm/g5/manifest.json"), "utf8"),
  ) as G5Manifest,
});

/**
 * Check G5 open-loop package completeness.
 *
 * Parameters
 * ----------
 * pkg : G5Package
 *     Loaded G5 package.
 *
 * Returns
 * -------
 * G5CheckResult
 *     `ok: true` when the legal tuple, later-gate barrier, and review bind.
 *
 * Example
 * -------
 * const result = checkG5(loadG5Package(repoRoot));
 */
export const checkG5 = (pkg: G5Package): G5CheckResult => {
  const failures: G5Failure[] = [];
  const push = (code: string, message: string) => {
    failures.push({ code, message });
  };
  if (!isRecord(pkg.manifest) || pkg.manifest.gate !== "G5") {
    push("manifest-gate", "expected G5 package");
  }
  if (!legalManifestTuple(pkg.manifest)) {
    push(
      "manifest-tuple",
      `illegal tuple status=${pkg.manifest.status} authorized=${String(pkg.manifest.authorized)} completed=${String(pkg.manifest.completed)}`,
    );
  }
  if (!pkg.manifest.doesNotAuthorizeLaterGates || pkg.manifest.g6toG10Authorized) {
    push("later-gates", "G5 must keep doesNotAuthorizeLaterGates true and g6toG10Authorized false");
  }
  const review = pkg.manifest.review;
  if (!isRecord(review)) {
    push("review", "G5 review must name independent Codex review with withheld or approved status");
  } else if (pkg.manifest.completed) {
    const digest = computeG5ReviewedArtifactHash(pkg);
    if (
      review.status !== "approved" ||
      review.identity !== G5_REVIEW_IDENTITY ||
      review.independentOfImplementationAuthor !== true ||
      review.reviewedArtifactHash !== digest
    ) {
      push(
        "review",
        "completed G5 requires approved independent review bound to the reviewed-package digest",
      );
    }
  }
  if (failures.length > 0) {
    return { ok: false, failures };
  }
  return { ok: true };
};

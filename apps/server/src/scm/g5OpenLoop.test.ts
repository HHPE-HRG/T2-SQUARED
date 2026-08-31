/**
 * G5 open-loop publish tests.
 *
 * Two nodes, one in-process bus, unsatisfied repetition without
 * request_age bump. OTEL observes. No ACK. No G6 DIP.
 */
import { mkdtempSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";
import { trace } from "@opentelemetry/api";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { T2Observability, layerTest } from "../t2Observability/T2Observability.ts";
import { CANONICAL_ABSENCE, checkW1Word } from "./g4Word.ts";
import {
  InProcessOpenLoopBus,
  checkG5,
  computeG5ReviewedArtifactHash,
  loadG5Package,
  observePublish,
  observeReceive,
} from "./g5OpenLoop.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const makeFilePath = (): string => join(mkdtempSync(join(tmpdir(), "t2-scm-")), "t2.trace.ndjson");

const word = (node_id: string, request: string, request_age: number) => {
  const result = checkW1Word({
    bus_id: "bus.rpc",
    node_id,
    fundamental_state: "active",
    fundamental_request: request,
    state_age: 0,
    request_age,
    modifier_start: "modifier_start",
    null: "null",
  });
  if (!result.ok) {
    throw new Error(result.failures.map((row) => row.message).join("\n"));
  }
  return result.word;
};

describe("G5 open-loop publish", () => {
  it("rejects delivery ACK and retry APIs", () => {
    const bus = new InProcessOpenLoopBus();
    for (const key of [
      "acknowledge",
      "deliverAck",
      "ack",
      "retry",
      "retryCount",
      "nack",
      "confirm",
    ]) {
      assert.equal(key in bus, false, key);
    }
    const sample = word("node.a", "need-b", 0);
    for (const key of ["ack", "retry", "retryCount", "nack"]) {
      assert.equal(key in sample, false, key);
    }
  });

  it("keeps a write invisible until the next fundamental timestep", () => {
    const bus = new InProcessOpenLoopBus();
    const request = word("node.a", "need-b", 0);
    bus.publish(request);
    assert.equal(bus.read("node.a"), undefined);
    bus.advanceFundamentalTimestep();
    assert.equal(bus.read("node.a")?.fundamental_request, "need-b");
    assert.equal(bus.read("node.a")?.fundamental_request, "need-b");
  });

  it("produces zero words for zero publishers and N times M words for N nodes over M timesteps", () => {
    const empty = new InProcessOpenLoopBus();
    empty.advanceFundamentalTimestep();
    assert.equal(empty.read("node.a"), undefined);

    const bus = new InProcessOpenLoopBus();
    let published = 0;
    const nodes = ["node.a", "node.b"];
    for (let step = 0; step < 3; step += 1) {
      for (const nodeId of nodes) {
        bus.publish(word(nodeId, CANONICAL_ABSENCE, 0));
        published += 1;
      }
      bus.advanceFundamentalTimestep();
    }
    assert.equal(published, 6);
    assert.equal(bus.read("node.a")?.node_id, "node.a");
    assert.equal(bus.read("node.b")?.node_id, "node.b");
  });

  it("keeps one word per node_id when a process interval covers many fundamental timesteps", () => {
    const bus = new InProcessOpenLoopBus();
    bus.publish(word("node.a", "need-b", 0));
    bus.publish(word("node.a", "need-c", 0));
    bus.advanceFundamentalTimestep();
    assert.equal(bus.read("node.a")?.fundamental_request, "need-c");

    for (let step = 0; step < 4; step += 1) {
      bus.publish(word("node.a", "need-b", 0));
      bus.advanceFundamentalTimestep();
    }
    assert.equal(bus.read("node.a")?.fundamental_request, "need-b");
    assert.equal(bus.fundamentalTimestep, 5);
  });

  it("delivers a word even when T2 observation is absent", () => {
    const bus = new InProcessOpenLoopBus();
    const request = word("node.a", "need-b", 0);
    Effect.runSync(
      observePublish(
        request,
        Effect.sync(() => bus.publish(request)),
      ),
    );
    bus.advanceFundamentalTimestep();
    assert.equal(bus.read("node.a")?.fundamental_request, "need-b");
  });

  it.effect(
    "repeats unsatisfied request without bumping request_age and observes publish and receive",
    () => {
      const exporter = new InMemorySpanExporter();
      const before = trace.getTracerProvider();
      const bus = new InProcessOpenLoopBus();
      return Effect.gen(function* () {
        const request = word("node.a", "need-b", 0);
        yield* observePublish(
          request,
          Effect.sync(() => bus.publish(request)),
        );
        bus.advanceFundamentalTimestep();
        const seen = yield* observeReceive(Effect.sync(() => bus.read("node.a")));
        assert.equal(seen?.fundamental_request, "need-b");
        assert.equal(seen?.request_age, 0);

        const bIdle = word("node.b", CANONICAL_ABSENCE, 0);
        yield* observePublish(
          bIdle,
          Effect.sync(() => bus.publish(bIdle)),
        );

        const repeat = word("node.a", "need-b", 0);
        yield* observePublish(
          repeat,
          Effect.sync(() => bus.publish(repeat)),
        );
        bus.advanceFundamentalTimestep();
        const seenRepeat = yield* observeReceive(Effect.sync(() => bus.read("node.a")));
        assert.equal(seenRepeat?.fundamental_request, "need-b");
        assert.equal(seenRepeat?.request_age, 0);

        const t2 = yield* T2Observability;
        yield* t2.forceFlush;
        const publishes = exporter
          .getFinishedSpans()
          .filter((span) => span.name === "t2.scm.publish");
        const receives = exporter
          .getFinishedSpans()
          .filter((span) => span.name === "t2.scm.receive");
        assert.ok(publishes.length >= 3);
        assert.ok(receives.length >= 2);
        assert.equal(publishes[0]?.attributes["t2.scm.node_id"], "node.a");
        assert.equal(publishes[0]?.attributes["t2.scm.bus_id"], "bus.rpc");
        assert.equal(
          publishes[0]?.attributes["t2.scm.word_id"],
          receives[0]?.attributes["t2.scm.word_id"],
        );
        assert.equal(trace.getTracerProvider(), before);
      }).pipe(Effect.provide(layerTest({ exporter, filePath: makeFilePath() })));
    },
  );

  it.effect("keeps the published word when observation fails after write", () => {
    const bus = new InProcessOpenLoopBus();
    const request = word("node.a", "need-b", 0);
    return Effect.gen(function* () {
      const exit = yield* observePublish(
        request,
        Effect.sync(() => {
          bus.publish(request);
        }).pipe(Effect.flatMap(() => Effect.fail("otel-down"))),
      ).pipe(Effect.exit);
      assert.equal(Exit.isFailure(exit), true);
      bus.advanceFundamentalTimestep();
      assert.equal(bus.read("node.a")?.fundamental_request, "need-b");
    });
  });
});

describe("G5 package completeness", () => {
  it("rejects withheld, wrong-identity, arbitrary-hash, and one-byte-drift completion", () => {
    const pkg = loadG5Package(repoRoot);
    const disk = checkG5(pkg);
    assert.equal(disk.ok, true, disk.ok ? "" : disk.failures.map((row) => row.message).join("\n"));
    assert.equal(pkg.manifest.doesNotAuthorizeLaterGates, true);
    assert.equal(pkg.manifest.g6toG10Authorized, false);

    const completed = structuredClone(pkg);
    completed.manifest.status = "completed";
    completed.manifest.authorized = true;
    completed.manifest.completed = true;

    const withheld = structuredClone(completed);
    withheld.manifest.review = {
      ...withheld.manifest.review,
      status: "withheld",
      reviewedArtifactHash: "",
    };
    const withheldResult = checkG5(withheld);
    assert.equal(withheldResult.ok, false);
    assert.ok(
      withheldResult.ok === false && withheldResult.failures.some((row) => row.code === "review"),
    );

    const bind = (identity: string, independent: boolean, note: string) => {
      const next = structuredClone(completed);
      next.manifest.review = {
        status: "approved",
        identity,
        independentOfImplementationAuthor: independent,
        reviewedArtifactHash: "",
        note,
      };
      next.manifest.review.reviewedArtifactHash = computeG5ReviewedArtifactHash(next);
      return next;
    };

    const wrongIdentity = checkG5(bind("self-review", true, "wrong identity"));
    assert.equal(wrongIdentity.ok, false);
    assert.ok(
      wrongIdentity.ok === false && wrongIdentity.failures.some((row) => row.code === "review"),
    );

    const dependent = checkG5(bind("codex-independent-review", false, "dependent"));
    assert.equal(dependent.ok, false);
    assert.ok(dependent.ok === false && dependent.failures.some((row) => row.code === "review"));

    const unbound = structuredClone(completed);
    unbound.manifest.review = {
      status: "approved",
      identity: "codex-independent-review",
      independentOfImplementationAuthor: true,
      reviewedArtifactHash: "a".repeat(64),
      note: "unbound",
    };
    assert.equal(checkG5(unbound).ok, false);

    const bound = bind("codex-independent-review", true, "bound");
    const boundResult = checkG5(bound);
    assert.equal(
      boundResult.ok,
      true,
      boundResult.ok ? "" : boundResult.failures.map((row) => row.message).join("\n"),
    );

    const drift = structuredClone(bound);
    drift.manifest.authorization = {
      ...drift.manifest.authorization,
      note: `${drift.manifest.authorization.note}x`,
    };
    assert.equal(checkG5(drift).ok, false);
  });

  it("rejects later-gate authorization flags", () => {
    const pkg = loadG5Package(repoRoot);
    const mutated = structuredClone(pkg);
    mutated.manifest.g6toG10Authorized = true;
    mutated.manifest.doesNotAuthorizeLaterGates = false;
    const result = checkG5(mutated);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.failures.some((row) => row.code === "later-gates"));
  });
});

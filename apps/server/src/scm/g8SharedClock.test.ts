import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";
import { trace } from "@opentelemetry/api";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";

import { T2Observability, layerTest } from "../t2Observability/T2Observability.ts";
import { checkW1Word } from "./g4Word.ts";
import { InProcessOpenLoopBus } from "./g5OpenLoop.ts";
import { BidirectionalHomeBusLink } from "./g6HomeBusLink.ts";
import {
  DipMuteStore,
  STEWARD_ACTOR,
  type AuthorityClass,
  type GovernedClasses,
} from "./g6DipMute.ts";
import {
  G8_PRODUCER_NAME,
  checkG8,
  loadG8FramingParameters,
  loadG8Package,
  nextAges,
  observeClockAdvance,
  SharedFundamentalClock,
} from "./g8SharedClock.ts";
import { loadG7Package } from "./g7HaltFreeze.ts";
import { loadG4Package } from "./g4Word.ts";
import { loadG5Package } from "./g5OpenLoop.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const fixture = () => {
  const busA = new InProcessOpenLoopBus();
  const busB = new InProcessOpenLoopBus();
  const link = new BidirectionalHomeBusLink({
    buses: new Map([
      ["bus.rpc", busA],
      ["bus.control", busB],
    ]),
    routes: [
      {
        route_id: "route.rpc-to-control",
        source_bus_id: "bus.rpc",
        destination_bus_id: "bus.control",
        allowed_origin_node_ids: ["node.rpc"],
        enabled: true,
      },
      {
        route_id: "route.control-to-rpc",
        source_bus_id: "bus.control",
        destination_bus_id: "bus.rpc",
        allowed_origin_node_ids: ["node.orchestration"],
        enabled: true,
      },
    ],
  });
  return { busA, busB, clock: new SharedFundamentalClock(link) };
};

describe("shared SCM fundamental clock", () => {
  it("names the in-process producer scm.fundamental-clock and loads framing placeholders", () => {
    const { clock } = fixture();
    assert.equal(G8_PRODUCER_NAME, "scm.fundamental-clock");
    assert.equal(clock.producer_name, G8_PRODUCER_NAME);
    assert.deepEqual(loadG8FramingParameters(repoRoot), {
      producer_name: "scm.fundamental-clock",
      modifier_start: "modifier_start",
      null: "null",
      words_per_node_per_fundamental_timestep: 1,
    });
  });

  it.effect("advances every elapsed fundamental timestep in order", () =>
    Effect.gen(function* () {
      const { busA, busB, clock } = fixture();
      const checked = checkW1Word({
        bus_id: "bus.rpc",
        node_id: "node.rpc",
        fundamental_state: "active",
        fundamental_request: "need-control",
        state_age: 0,
        request_age: 0,
        modifier_start: "modifier_start",
        null: "null",
      });
      if (!checked.ok) throw new Error("fixture W1 must be valid");

      busA.publish(checked.word);
      clock.start();
      const deliveries = yield* clock.advanceProcessInterval(2);

      assert.equal(clock.currentFundamentalTimestep, 2);
      assert.equal(deliveries.deliveries.length, 1);
      assert.deepEqual(deliveries.failures, []);
      assert.equal(busB.read("node.rpc")?.fundamental_request, "need-control");
    }),
  );

  it.effect("does not advance before start or after stop", () =>
    Effect.gen(function* () {
      const { clock } = fixture();
      assert.equal(Exit.isFailure(yield* clock.advanceProcessInterval(1).pipe(Effect.exit)), true);
      clock.start();
      yield* clock.advanceProcessInterval(1);
      clock.stop();
      assert.equal(Exit.isFailure(yield* clock.advanceProcessInterval(1).pipe(Effect.exit)), true);
      assert.equal(clock.currentFundamentalTimestep, 1);
    }),
  );

  it.effect("rejects invalid elapsed timestep counts", () =>
    Effect.gen(function* () {
      const { clock } = fixture();
      clock.start();
      for (const count of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        const exit = yield* clock.advanceProcessInterval(count).pipe(Effect.exit);
        assert.equal(Exit.isFailure(exit), true, String(count));
      }
      assert.equal(clock.currentFundamentalTimestep, 0);
    }),
  );

  it.effect("rejects overlap and clears guard after completion", () =>
    Effect.gen(function* () {
      const entered = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const target = {
        advanceFundamentalTimestep: () =>
          Effect.gen(function* () {
            yield* Deferred.succeed(entered, undefined);
            yield* Deferred.await(release);
            return { deliveries: [], failures: [] };
          }),
      };
      const clock = new SharedFundamentalClock(target);
      clock.start();

      const first = yield* clock
        .advanceProcessInterval(1)
        .pipe(Effect.forkChild({ startImmediately: true }));
      yield* Deferred.await(entered);
      const overlap = yield* clock.advanceProcessInterval(1).pipe(Effect.exit);
      assert.equal(Exit.isFailure(overlap), true);

      yield* Deferred.succeed(release, undefined);
      yield* Fiber.join(first);
      const later = yield* clock.advanceProcessInterval(1);
      assert.deepEqual(later, { deliveries: [], failures: [] });
      assert.equal(clock.currentFundamentalTimestep, 2);
    }),
  );

  it.effect("treats zero elapsed timesteps as a no-op", () =>
    Effect.gen(function* () {
      const { clock } = fixture();
      clock.start();
      const zero = yield* clock.advanceProcessInterval(0);
      assert.deepEqual(zero, { deliveries: [], failures: [] });
      assert.equal(clock.currentFundamentalTimestep, 0);
    }),
  );
});

const previousWord = (
  fundamental_state: string,
  fundamental_request: string,
  state_age: number,
  request_age: number,
) => ({
  fundamental_state,
  fundamental_request,
  state_age,
  request_age,
});

describe("G8 nextAges table", () => {
  it("resets both ages on the first word", () => {
    assert.deepEqual(nextAges(undefined, "active", "need-control"), {
      state_age: 0,
      request_age: 0,
    });
  });

  it("increments state_age and keeps request_age when both values repeat", () => {
    assert.deepEqual(
      nextAges(previousWord("active", "need-control", 3, 4), "active", "need-control"),
      { state_age: 4, request_age: 4 },
    );
  });

  it("resets state_age on state change without touching request_age", () => {
    assert.deepEqual(
      nextAges(previousWord("active", "need-control", 5, 2), "halted", "need-control"),
      { state_age: 0, request_age: 2 },
    );
  });

  it("resets request_age on request change and still increments state_age", () => {
    assert.deepEqual(
      nextAges(previousWord("active", "need-control", 5, 2), "active", "need-halt"),
      { state_age: 6, request_age: 0 },
    );
  });

  it("resets both ages when state and request both change", () => {
    assert.deepEqual(
      nextAges(previousWord("active", "need-control", 5, 2), "halted", "need-halt"),
      { state_age: 0, request_age: 0 },
    );
  });
});

const makeOtelFilePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "t2-scm-g8-")), "t2.trace.ndjson");

const loadFixtureGoverned = (): GovernedClasses => {
  const raw = JSON.parse(
    readFileSync(join(repoRoot, "docs/scm/g6/governed-classes.json"), "utf8"),
  ) as {
    readonly authority_bus_id: string;
    readonly buses: Record<string, AuthorityClass>;
    readonly nodes: Record<string, AuthorityClass>;
  };
  return {
    authority_bus_id: raw.authority_bus_id,
    buses: new Map(Object.entries(raw.buses)),
    nodes: new Map(Object.entries(raw.nodes)),
  };
};

describe("G8 clock observation and frozen buses", () => {
  it.effect("emits t2.scm.clock.advance after a process interval", () => {
    const exporter = new InMemorySpanExporter();
    const before = trace.getTracerProvider();
    const { clock } = fixture();
    clock.start();
    return Effect.gen(function* () {
      yield* observeClockAdvance(
        { elapsed_fundamental_timesteps: 1, producer_name: clock.producer_name },
        clock.advanceProcessInterval(1),
      );
      const t2 = yield* T2Observability;
      yield* t2.forceFlush;
      const advances = exporter
        .getFinishedSpans()
        .filter((span) => span.name === "t2.scm.clock.advance");
      assert.equal(advances.length, 1);
      assert.equal(advances[0]?.attributes["t2.scm.producer_name"], G8_PRODUCER_NAME);
      assert.equal(advances[0]?.attributes["t2.scm.elapsed_fundamental_timesteps"], 1);
      assert.equal(trace.getTracerProvider(), before);
    }).pipe(Effect.provide(layerTest({ exporter, filePath: makeOtelFilePath() })));
  });

  it.effect("does not advance a frozen DIP bus during a process interval", () =>
    Effect.gen(function* () {
      const store = new DipMuteStore(loadFixtureGoverned());
      const busA = new InProcessOpenLoopBus({
        mutationGuard: () => store.assertMutable("bus.scm.a"),
      });
      const busB = new InProcessOpenLoopBus({
        mutationGuard: () => store.assertMutable("bus.scm.b"),
      });
      const link = new BidirectionalHomeBusLink({
        buses: new Map([
          ["bus.scm.a", busA],
          ["bus.scm.b", busB],
        ]),
        routes: [
          {
            route_id: "route.scm.a-to-b",
            source_bus_id: "bus.scm.a",
            destination_bus_id: "bus.scm.b",
            allowed_origin_node_ids: ["node.scm.home-a"],
            enabled: true,
          },
          {
            route_id: "route.scm.b-to-a",
            source_bus_id: "bus.scm.b",
            destination_bus_id: "bus.scm.a",
            allowed_origin_node_ids: ["node.scm.home-b"],
            enabled: true,
          },
        ],
        dip: store,
      });
      store.setBusPosition("bus.scm.a", "frozen", STEWARD_ACTOR);
      const timestepA = busA.fundamentalTimestep;
      const clock = new SharedFundamentalClock(link);
      clock.start();
      const result = yield* clock.advanceProcessInterval(1);
      assert.equal(store.busPosition("bus.scm.a"), "frozen");
      assert.equal(busA.fundamentalTimestep, timestepA);
      assert.equal(busB.fundamentalTimestep, timestepA + 1);
      assert.equal(result.deliveries.length, 0);
      assert.ok(result.failures.length >= 1);
    }),
  );
});

describe("G8 package completeness", () => {
  it("accepts the completed G8 tuple without unlocking G9-G10", () => {
    const pkg = loadG8Package(repoRoot);
    const result = checkG8(pkg);
    assert.equal(
      result.ok,
      true,
      result.ok ? "" : result.failures.map((row) => row.message).join("\n"),
    );
    assert.equal(pkg.manifest.g9toG10Authorized, false);
    assert.equal(pkg.manifest.doesNotAuthorizeLaterGates, true);
    assert.equal(loadG7Package(repoRoot).manifest.g8toG10Authorized, false);
    assert.equal(loadG4Package(repoRoot).manifest.g6toG10Authorized, false);
    assert.equal(loadG5Package(repoRoot).manifest.g6toG10Authorized, false);
  });

  it("still rejects encoding keys on W1", () => {
    const encoded = checkW1Word({
      bus_id: "bus.scm.a",
      node_id: "node.scm.home-a",
      fundamental_state: "active",
      fundamental_request: "canonical-absence",
      state_age: 0,
      request_age: 0,
      modifier_start: "modifier_start",
      null: "null",
      nibble_alphabet: "x",
    });
    assert.equal(encoded.ok, false);
  });
});

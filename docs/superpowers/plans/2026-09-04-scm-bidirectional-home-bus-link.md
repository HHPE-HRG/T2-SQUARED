# SCM Bidirectional Home-Bus Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bounded, clock-driven, bidirectional in-process link that republishes eligible locally originated W1 words between two home buses with deterministic T+2 destination visibility.

**Architecture:** Reuse the completed G4 `W1Word`, G5 `InProcessOpenLoopBus`, and isolated T2 OpenTelemetry plane. Add two explicit inverse route records, one small link coordinator, and one injectable shared-clock driver. Preserve W1 content and governed source node/bus identity; use route plus origin timestep plus content-derived `word_id` as delivery-instance identity so lawful cyclic repeats continue crossing once per timestep.

**Tech Stack:** TypeScript, Effect, `@effect/vitest`, Node `crypto`, OpenTelemetry SDK test exporter.

## Global Constraints

- Start from branch `feat/t2-opentelemetry` at or after design commit `1f6d02848` and G1-G5 checkpoint `0eaddec54`.
- Read `AGENTS.md`, `docs/superpowers/specs/2026-09-04-scm-bidirectional-home-bus-link-design.md`, `apps/server/src/scm/g4Word.ts`, `apps/server/src/scm/g5OpenLoop.ts`, and their tests before editing.
- Implementation requires explicit human authorization after this plan is reviewed. Plan existence is not authorization.
- This is a bounded G6/G8 prototype precursor. It does not complete G6 or G8 and does not authorize G7, G9, or G10.
- Preserve G1B `g3Authorized: false` and `g4toG7Authorized: false`.
- Preserve G2/G3 `g4toG7Authorized: false` and G4/G5 `g6toG10Authorized: false`.
- Do not implement DIP mute, halt/freeze, independent clock domains, multi-hop routing, dynamic route discovery, codec, byte/bit/nibble encoding, SocketCAN, ISO-11898, physical transport, semantic parity, or live cutover.
- Do not call `setGlobalTracerProvider` or write T3 `server.trace.ndjson`.
- Bridge routes add no authority. W1 has no `authority_class` field; preserve governed source node/bus identity so later authority evaluation can resolve the source without bridge elevation.
- No ACK, NACK, retry, delivery receipt, destination-readiness query, or feedback control.
- Use “fundamental timestep,” never “tick,” for protocol time. A process interval may advance multiple fundamental timesteps.
- No new dependency.
- Existing untracked Forge bridge files are unrelated. Do not edit, delete, stage, or commit them:
  - `.cursor/rules/hhpe-forge-dev-handoff.mdc`
  - `docs/operations/hhpe-forge-dev-handoff.md`
  - `docs/plans/2026-08-31-001-hhpe-forge-dev-bridge.md`
- Never use `git add .`. Stage exact task paths only when commit authority exists.
- Run focused tests only; do not run repo-wide checks.

---

## File Map

- Modify `apps/server/src/scm/g5OpenLoop.ts`: export existing content-derived W1 correlation function; no behavior change.
- Modify `apps/server/src/scm/g5OpenLoop.test.ts`: pin exported correlation behavior and G5 regression.
- Create `apps/server/src/scm/g6HomeBusLink.ts`: route types, delivery provenance, two-bus coordinator, validation, forwarding, loop prevention, bridge OTEL.
- Create `apps/server/src/scm/g6HomeBusLink.test.ts`: direction, T+2 visibility, identity, loop, collision, failure, and telemetry tests.
- Create `apps/server/src/scm/g8SharedClock.ts`: injectable shared fundamental-clock driver with start/stop, multi-timestep process interval, and overlap guard.
- Create `apps/server/src/scm/g8SharedClock.test.ts`: lifecycle, ordering, interval, failure cleanup, and no-extra-step tests.
- Create `docs/scm/home-bus-link/README.md`: prototype status, exact semantics, authorization boundary, and non-goals.

No G6 or G8 completion manifest is created or modified by this plan.

---

### Task 1: Export G5 W1 correlation identity

**Files:**

- Modify: `apps/server/src/scm/g5OpenLoop.ts`
- Modify: `apps/server/src/scm/g5OpenLoop.test.ts`

**Interfaces:**

- Consumes: `W1Word` from `./g4Word.ts`.
- Produces: `w1WordId(word: W1Word): string` for G5 spans and later bridge correlation.

- [ ] **Step 1: Write failing export test**

Add `w1WordId` to the import from `./g5OpenLoop.ts`, then add this test inside `describe("G5 open-loop publish", ...)`:

```ts
it("exports stable content-derived word correlation identity", () => {
  const first = word("node.a", "need-b", 0);
  const same = word("node.a", "need-b", 0);
  const changed = word("node.a", "need-b", 1);

  assert.equal(w1WordId(first), w1WordId(same));
  assert.notEqual(w1WordId(first), w1WordId(changed));
  assert.match(w1WordId(first), /^[a-f0-9]{64}$/);
});
```

- [ ] **Step 2: Run test and confirm red**

Run:

```bash
cd /Users/maxholden/T2-SQUARED/apps/server
vp test run src/scm/g5OpenLoop.test.ts
```

Expected: module export failure for `w1WordId`.

- [ ] **Step 3: Export existing function without changing algorithm**

In `g5OpenLoop.ts`, replace:

```ts
const wordId = (word: W1Word): string =>
```

with:

```ts
export const w1WordId = (word: W1Word): string =>
```

Update `canAttributes`:

```ts
const canAttributes = (word: W1Word): Attributes => ({
  "t2.scm.bus_id": word.bus_id,
  "t2.scm.node_id": word.node_id,
  "t2.scm.fundamental_request": word.fundamental_request,
  "t2.scm.request_age": word.request_age,
  "t2.scm.word_id": w1WordId(word),
});
```

- [ ] **Step 4: Run G5 regression**

Run:

```bash
vp test run src/scm/g5OpenLoop.test.ts
```

Expected: all G5 tests pass; existing publish/receive span correlation remains unchanged.

- [ ] **Step 5: Commit exact paths if commit authority exists**

```bash
git add -- apps/server/src/scm/g5OpenLoop.ts apps/server/src/scm/g5OpenLoop.test.ts
git commit -m "refactor(scm): expose W1 correlation identity"
```

If execution authority excludes commits, leave changes unstaged and record that fact.

---

### Task 2: Implement two explicit home-bus routes

**Files:**

- Create: `apps/server/src/scm/g6HomeBusLink.ts`
- Create: `apps/server/src/scm/g6HomeBusLink.test.ts`

**Interfaces:**

- Consumes:
  - `W1Word`, `checkW1Word` from `./g4Word.ts`.
  - `InProcessOpenLoopBus`, `w1WordId` from `./g5OpenLoop.ts`.
  - `withOwnedSpan` from `../t2Observability/T2Observability.ts`.
- Produces:
  - `BridgeRoute`.
  - `BridgeDelivery`.
  - `BridgeRouteFailure`.
  - `BridgeAdvanceResult`.
  - `HomeBusLinkFailure`.
  - `BidirectionalHomeBusLink`.
  - `observeBridgeForward`.

- [ ] **Step 1: Write route and visibility tests**

Create `g6HomeBusLink.test.ts`. Use this setup and assertions:

```ts
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { checkW1Word, type W1Word } from "./g4Word.ts";
import { InProcessOpenLoopBus } from "./g5OpenLoop.ts";
import { BidirectionalHomeBusLink, type BridgeRoute } from "./g6HomeBusLink.ts";

const checkedWord = (bus_id: string, node_id: string, request = "canonical-absence"): W1Word => {
  const checked = checkW1Word({
    bus_id,
    node_id,
    fundamental_state: "active",
    fundamental_request: request,
    state_age: 0,
    request_age: 0,
    modifier_start: "modifier_start",
    null: "null",
  });
  if (!checked.ok) {
    throw new Error(checked.failures.map((failure) => failure.message).join("\n"));
  }
  return checked.word;
};

const routeAtoB: BridgeRoute = {
  route_id: "route.rpc-to-control",
  source_bus_id: "bus.rpc",
  destination_bus_id: "bus.control",
  allowed_origin_node_ids: ["node.rpc"],
  enabled: true,
};

const routeBtoA: BridgeRoute = {
  route_id: "route.control-to-rpc",
  source_bus_id: "bus.control",
  destination_bus_id: "bus.rpc",
  allowed_origin_node_ids: ["node.orchestration"],
  enabled: true,
};

const fixture = () => {
  const busA = new InProcessOpenLoopBus();
  const busB = new InProcessOpenLoopBus();
  const link = new BidirectionalHomeBusLink({
    buses: new Map([
      ["bus.rpc", busA],
      ["bus.control", busB],
    ]),
    routes: [routeAtoB, routeBtoA],
  });
  return { busA, busB, link };
};

describe("bidirectional SCM home-bus link", () => {
  it.effect("makes each direction visible at T+2", () =>
    Effect.gen(function* () {
      const { busA, busB, link } = fixture();
      const fromA = checkedWord("bus.rpc", "node.rpc", "need-control");
      const fromB = checkedWord("bus.control", "node.orchestration", "need-rpc");

      busA.publish(fromA);
      busB.publish(fromB);
      assert.equal(busB.read("node.rpc"), undefined);
      assert.equal(busA.read("node.orchestration"), undefined);

      const first = yield* link.advanceFundamentalTimestep();
      assert.equal(first.deliveries.length, 2);
      assert.deepEqual(first.failures, []);
      assert.equal(busB.read("node.rpc"), undefined);
      assert.equal(busA.read("node.orchestration"), undefined);

      yield* link.advanceFundamentalTimestep();
      assert.deepEqual(busB.read("node.rpc"), fromA);
      assert.deepEqual(busA.read("node.orchestration"), fromB);
    }),
  );

  it.effect("forwards identical cyclic content once per origin timestep", () =>
    Effect.gen(function* () {
      const { busA, link } = fixture();
      const repeated = checkedWord("bus.rpc", "node.rpc", "still-needed");

      busA.publish(repeated);
      const first = yield* link.advanceFundamentalTimestep();
      busA.publish(repeated);
      const second = yield* link.advanceFundamentalTimestep();

      assert.equal(first.deliveries.length, 1);
      assert.equal(second.deliveries.length, 1);
      assert.equal(first.deliveries[0]?.word_id, second.deliveries[0]?.word_id);
      assert.notEqual(first.deliveries[0]?.origin_timestep, second.deliveries[0]?.origin_timestep);
    }),
  );

  it.effect("does not re-forward imported words", () =>
    Effect.gen(function* () {
      const { busA, busB, link } = fixture();
      busA.publish(checkedWord("bus.rpc", "node.rpc", "one-way-instance"));

      const atOne = yield* link.advanceFundamentalTimestep();
      const atTwo = yield* link.advanceFundamentalTimestep();
      const atThree = yield* link.advanceFundamentalTimestep();

      assert.equal(atOne.deliveries.length, 1);
      assert.equal(atTwo.deliveries.length, 0);
      assert.equal(atThree.deliveries.length, 0);
      assert.equal(busA.read("node.rpc"), undefined);
      assert.equal(busB.read("node.rpc"), undefined);
    }),
  );
});
```

The last assertions reflect memoryless buses: forwarded word is readable on B at T+2, then absent at T+3 when not republished.

- [ ] **Step 2: Run new test and confirm red**

Run:

```bash
vp test run src/scm/g6HomeBusLink.test.ts
```

Expected: missing `g6HomeBusLink.ts` module.

- [ ] **Step 3: Implement minimal coordinator**

Create `g6HomeBusLink.ts` with these public types and algorithm:

```ts
import type { Attributes } from "@opentelemetry/api";
import * as Effect from "effect/Effect";

import { withOwnedSpan } from "../t2Observability/T2Observability.ts";
import { checkW1Word, type W1Word } from "./g4Word.ts";
import { InProcessOpenLoopBus, w1WordId } from "./g5OpenLoop.ts";

export interface BridgeRoute {
  readonly route_id: string;
  readonly source_bus_id: string;
  readonly destination_bus_id: string;
  readonly allowed_origin_node_ids: ReadonlyArray<string>;
  readonly enabled: boolean;
}

export interface BridgeDelivery {
  readonly route_id: string;
  readonly source_bus_id: string;
  readonly destination_bus_id: string;
  readonly origin_node_id: string;
  readonly origin_bus_id: string;
  readonly origin_timestep: number;
  readonly forwarded_at_timestep: number;
  readonly bridge_hop: 1;
  readonly word_id: string;
  readonly word: W1Word;
}

export interface BridgeRouteFailure {
  readonly route_id: string;
  readonly origin_node_id: string;
  readonly message: string;
}

export interface BridgeAdvanceResult {
  readonly deliveries: ReadonlyArray<BridgeDelivery>;
  readonly failures: ReadonlyArray<BridgeRouteFailure>;
}

export class HomeBusLinkFailure extends Error {
  readonly _tag = "HomeBusLinkFailure";
}

const nonEmpty = (value: string): boolean => value.trim().length > 0;

const routeDeliveryKey = (delivery: BridgeDelivery): string =>
  [
    delivery.route_id,
    delivery.origin_bus_id,
    delivery.origin_node_id,
    String(delivery.origin_timestep),
    delivery.word_id,
  ].join("\0");

const bridgeAttributes = (delivery: BridgeDelivery): Attributes => ({
  "t2.scm.word_id": delivery.word_id,
  "t2.scm.origin_node_id": delivery.origin_node_id,
  "t2.scm.origin_bus_id": delivery.origin_bus_id,
  "t2.scm.source_bus_id": delivery.source_bus_id,
  "t2.scm.destination_bus_id": delivery.destination_bus_id,
  "t2.scm.route_id": delivery.route_id,
  "t2.scm.bridge_hop": delivery.bridge_hop,
  "t2.scm.origin_timestep": delivery.origin_timestep,
  "t2.scm.forwarded_at_timestep": delivery.forwarded_at_timestep,
});

export const observeBridgeForward = <A, E, R>(
  delivery: BridgeDelivery,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.flatMap(effect, (result) =>
    withOwnedSpan("t2.scm.bridge.forward", Effect.succeed(result), bridgeAttributes(delivery)),
  );

export class BidirectionalHomeBusLink {
  private fundamentalTimestep = 0;
  private advancing = false;

  constructor(
    private readonly config: {
      readonly buses: ReadonlyMap<string, InProcessOpenLoopBus>;
      readonly routes: readonly [BridgeRoute, BridgeRoute];
    },
  ) {
    const [forward, reverse] = config.routes;
    const routeIds = new Set(config.routes.map((route) => route.route_id));
    if (
      routeIds.size !== 2 ||
      !config.routes.every(
        (route) =>
          nonEmpty(route.route_id) &&
          nonEmpty(route.source_bus_id) &&
          nonEmpty(route.destination_bus_id) &&
          route.source_bus_id !== route.destination_bus_id &&
          config.buses.has(route.source_bus_id) &&
          config.buses.has(route.destination_bus_id) &&
          route.allowed_origin_node_ids.length > 0 &&
          route.allowed_origin_node_ids.every(nonEmpty) &&
          new Set(route.allowed_origin_node_ids).size === route.allowed_origin_node_ids.length,
      ) ||
      new Set(config.routes.flatMap((route) => route.allowed_origin_node_ids)).size !==
        config.routes.flatMap((route) => route.allowed_origin_node_ids).length ||
      forward.source_bus_id !== reverse.destination_bus_id ||
      forward.destination_bus_id !== reverse.source_bus_id
    ) {
      throw new HomeBusLinkFailure("routes must be unique inverse routes over two known buses");
    }
  }

  advanceFundamentalTimestep(): Effect.Effect<BridgeAdvanceResult, HomeBusLinkFailure> {
    if (this.advancing) {
      return Effect.fail(new HomeBusLinkFailure("fundamental timestep advance already active"));
    }
    this.advancing = true;

    const self = this;
    return Effect.gen(function* () {
      for (const bus of self.config.buses.values()) {
        bus.advanceFundamentalTimestep();
      }

      const originTimestep = self.fundamentalTimestep;
      self.fundamentalTimestep += 1;
      const deliveries: BridgeDelivery[] = [];
      const failures: BridgeRouteFailure[] = [];
      const seen = new Set<string>();

      for (const route of self.config.routes) {
        if (!route.enabled) continue;
        const source = self.config.buses.get(route.source_bus_id)!;
        const destination = self.config.buses.get(route.destination_bus_id)!;

        for (const nodeId of route.allowed_origin_node_ids) {
          const candidate = source.read(nodeId);
          if (candidate === undefined) continue;
          const checked = checkW1Word(candidate);
          if (!checked.ok) {
            failures.push({
              route_id: route.route_id,
              origin_node_id: nodeId,
              message: "source bus exposed invalid W1",
            });
            continue;
          }
          if (checked.word.node_id !== nodeId || checked.word.bus_id !== route.source_bus_id) {
            failures.push({
              route_id: route.route_id,
              origin_node_id: nodeId,
              message: "route accepts only registered local-origin words",
            });
            continue;
          }

          const delivery: BridgeDelivery = {
            route_id: route.route_id,
            source_bus_id: route.source_bus_id,
            destination_bus_id: route.destination_bus_id,
            origin_node_id: checked.word.node_id,
            origin_bus_id: checked.word.bus_id,
            origin_timestep: originTimestep,
            forwarded_at_timestep: self.fundamentalTimestep,
            bridge_hop: 1,
            word_id: w1WordId(checked.word),
            word: checked.word,
          };
          const key = routeDeliveryKey(delivery);
          if (seen.has(key)) continue;
          seen.add(key);

          destination.publish(checked.word);
          deliveries.push(delivery);
        }
      }

      yield* Effect.forEach(deliveries, (delivery) => observeBridgeForward(delivery, Effect.void));
      return { deliveries, failures };
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          self.advancing = false;
        }),
      ),
    );
  }
}
```

- [ ] **Step 4: Run route tests and fix only contract failures**

Run:

```bash
vp test run src/scm/g6HomeBusLink.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Add route validation cases**

Add table-driven tests proving constructor rejection for:

```ts
const invalidRouteSets: ReadonlyArray<readonly [string, readonly [BridgeRoute, BridgeRoute]]> = [
  ["duplicate route IDs", [{ ...routeAtoB }, { ...routeBtoA, route_id: routeAtoB.route_id }]],
  ["same source and destination", [{ ...routeAtoB, destination_bus_id: "bus.rpc" }, routeBtoA]],
  ["unknown bus", [{ ...routeAtoB, destination_bus_id: "bus.missing" }, routeBtoA]],
  [
    "duplicate allowed origin",
    [{ ...routeAtoB, allowed_origin_node_ids: ["node.rpc", "node.rpc"] }, routeBtoA],
  ],
  [
    "origin registered on both home buses",
    [routeAtoB, { ...routeBtoA, allowed_origin_node_ids: ["node.rpc"] }],
  ],
  ["routes are not inverse", [routeAtoB, { ...routeBtoA, destination_bus_id: "bus.control" }]],
];

for (const [name, routes] of invalidRouteSets) {
  assert.throws(
    () =>
      new BidirectionalHomeBusLink({
        buses: new Map([
          ["bus.rpc", new InProcessOpenLoopBus()],
          ["bus.control", new InProcessOpenLoopBus()],
        ]),
        routes,
      }),
    HomeBusLinkFailure,
    name,
  );
}
```

Add disabled-route proof:

```ts
it.effect("forwards only enabled direction", () =>
  Effect.gen(function* () {
    const busA = new InProcessOpenLoopBus();
    const busB = new InProcessOpenLoopBus();
    const link = new BidirectionalHomeBusLink({
      buses: new Map([
        ["bus.rpc", busA],
        ["bus.control", busB],
      ]),
      routes: [{ ...routeAtoB, enabled: false }, routeBtoA],
    });

    busA.publish(checkedWord("bus.rpc", "node.rpc", "blocked-direction"));
    busB.publish(checkedWord("bus.control", "node.orchestration", "enabled-direction"));
    const result = yield* link.advanceFundamentalTimestep();

    assert.equal(result.deliveries.length, 1);
    assert.equal(result.deliveries[0]?.route_id, "route.control-to-rpc");
    assert.deepEqual(result.failures, []);
  }),
);
```

Add a malformed-input isolation test. Cast only at the test boundary to prove runtime validation:

```ts
const { busA, busB, link } = fixture();
busA.publish({ ...checkedWord("bus.rpc", "node.rpc"), request_age: -1 } as W1Word);
busB.publish(checkedWord("bus.control", "node.orchestration", "still-forward"));
const result = yield * link.advanceFundamentalTimestep();
assert.equal(result.failures.length, 1);
assert.equal(result.failures[0]?.route_id, "route.rpc-to-control");
assert.equal(result.deliveries.length, 1);
assert.equal(result.deliveries[0]?.route_id, "route.control-to-rpc");
```

- [ ] **Step 6: Commit exact paths if authorized**

```bash
git add -- apps/server/src/scm/g6HomeBusLink.ts apps/server/src/scm/g6HomeBusLink.test.ts
git commit -m "feat(scm): link two home buses bidirectionally"
```

---

### Task 3: Add shared fundamental-clock driver

**Files:**

- Create: `apps/server/src/scm/g8SharedClock.ts`
- Create: `apps/server/src/scm/g8SharedClock.test.ts`

**Interfaces:**

- Consumes: `BidirectionalHomeBusLink.advanceFundamentalTimestep()`.
- Produces:
  - `SharedFundamentalClock`.
  - `SharedClockFailure`.
  - `SharedProcessIntervalResult`.
  - `start()`, `stop()`, and `advanceProcessInterval(elapsedFundamentalTimesteps)`.

- [ ] **Step 1: Write clock lifecycle tests**

Create `g8SharedClock.test.ts`:

```ts
import { assert, describe, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";

import { checkW1Word } from "./g4Word.ts";
import { InProcessOpenLoopBus } from "./g5OpenLoop.ts";
import { BidirectionalHomeBusLink } from "./g6HomeBusLink.ts";
import { SharedFundamentalClock } from "./g8SharedClock.ts";

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
});
```

- [ ] **Step 2: Run clock test and confirm red**

Run:

```bash
vp test run src/scm/g8SharedClock.test.ts
```

Expected: missing `g8SharedClock.ts` module.

- [ ] **Step 3: Implement shared driver**

Create `g8SharedClock.ts`:

```ts
import * as Effect from "effect/Effect";

import {
  type BridgeAdvanceResult,
  type BridgeDelivery,
  type BridgeRouteFailure,
  type HomeBusLinkFailure,
} from "./g6HomeBusLink.ts";

export class SharedClockFailure extends Error {
  readonly _tag = "SharedClockFailure";
}

export interface SharedProcessIntervalResult {
  readonly deliveries: ReadonlyArray<BridgeDelivery>;
  readonly failures: ReadonlyArray<BridgeRouteFailure>;
}

export interface FundamentalTimestepTarget {
  advanceFundamentalTimestep(): Effect.Effect<BridgeAdvanceResult, HomeBusLinkFailure>;
}

export class SharedFundamentalClock {
  currentFundamentalTimestep = 0;
  private running = false;
  private advancing = false;

  constructor(private readonly link: FundamentalTimestepTarget) {}

  start(): void {
    if (this.running) {
      throw new SharedClockFailure("fundamental clock already started");
    }
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  advanceProcessInterval(
    elapsedFundamentalTimesteps: number,
  ): Effect.Effect<SharedProcessIntervalResult, SharedClockFailure | HomeBusLinkFailure> {
    if (!this.running) {
      return Effect.fail(new SharedClockFailure("fundamental clock is not running"));
    }
    if (!Number.isInteger(elapsedFundamentalTimesteps) || elapsedFundamentalTimesteps < 0) {
      return Effect.fail(
        new SharedClockFailure("elapsed fundamental timesteps must be a non-negative integer"),
      );
    }
    if (this.advancing) {
      return Effect.fail(new SharedClockFailure("process interval advance already active"));
    }

    this.advancing = true;
    const self = this;
    return Effect.gen(function* () {
      const deliveries: BridgeDelivery[] = [];
      const failures: BridgeRouteFailure[] = [];
      for (let index = 0; index < elapsedFundamentalTimesteps; index += 1) {
        const result = yield* self.link.advanceFundamentalTimestep();
        deliveries.push(...result.deliveries);
        failures.push(...result.failures);
        self.currentFundamentalTimestep += 1;
      }
      return { deliveries, failures };
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          self.advancing = false;
        }),
      ),
    );
  }
}
```

`0` is valid and performs no work. Negative, fractional, NaN, and infinite values fail. If local project style prefers zero to fail, do not change silently: design says a process interval may contain multiple timesteps but does not require at least one. Keep zero as no-op and add explicit assertion.

- [ ] **Step 4: Add overlap and cleanup tests**

Use a structurally typed target and Deferred synchronization. No sleep or polling:

```ts
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

    const first = yield* Effect.fork(clock.advanceProcessInterval(1));
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
```

Also test:

```ts
const zero = yield * clock.advanceProcessInterval(0);
assert.deepEqual(zero, { deliveries: [], failures: [] });
assert.equal(clock.currentFundamentalTimestep, 0);
```

- [ ] **Step 5: Run clock and link suites**

Run:

```bash
vp test run src/scm/g8SharedClock.test.ts src/scm/g6HomeBusLink.test.ts
```

Expected: all tests pass without timers or sleeps.

- [ ] **Step 6: Commit exact paths if authorized**

```bash
git add -- apps/server/src/scm/g8SharedClock.ts apps/server/src/scm/g8SharedClock.test.ts
git commit -m "feat(scm): drive linked buses with shared clock"
```

---

### Task 4: Prove provenance, failure isolation, and T2 telemetry

**Files:**

- Modify: `apps/server/src/scm/g6HomeBusLink.ts`
- Modify: `apps/server/src/scm/g6HomeBusLink.test.ts`

**Interfaces:**

- Consumes: `observeBridgeForward`, `BridgeDelivery`, isolated `T2Observability` test layer.
- Produces: verified `t2.scm.bridge.forward` span contract and transport-first failure behavior.

- [ ] **Step 1: Add in-memory exporter fixture**

Add imports:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { trace } from "@opentelemetry/api";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";

import { T2Observability, layerTest } from "../t2Observability/T2Observability.ts";
import { observePublish, observeReceive } from "./g5OpenLoop.ts";
```

Add helper:

```ts
const tracePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "t2-scm-link-")), "t2.trace.ndjson");
```

- [ ] **Step 2: Add bridge telemetry test**

```ts
it.effect("observes one forward per delivery on isolated T2 provider", () => {
  const exporter = new InMemorySpanExporter();
  const before = trace.getTracerProvider();
  const { busA, busB, link } = fixture();

  return Effect.gen(function* () {
    const source = checkedWord("bus.rpc", "node.rpc", "need-control");
    yield* observePublish(
      source,
      Effect.sync(() => busA.publish(source)),
    );
    const result = yield* link.advanceFundamentalTimestep();
    yield* link.advanceFundamentalTimestep();
    const received = yield* observeReceive(Effect.sync(() => busB.read("node.rpc")));
    assert.deepEqual(received, source);
    const t2 = yield* T2Observability;
    yield* t2.forceFlush;

    const spans = exporter.getFinishedSpans();
    const publishes = spans.filter((span) => span.name === "t2.scm.publish");
    const forwards = spans.filter((span) => span.name === "t2.scm.bridge.forward");
    const receives = spans.filter((span) => span.name === "t2.scm.receive");
    assert.equal(publishes.length, 1);
    assert.equal(forwards.length, 1);
    assert.equal(receives.length, 1);
    assert.equal(forwards[0]?.attributes["t2.scm.route_id"], "route.rpc-to-control");
    assert.equal(forwards[0]?.attributes["t2.scm.bridge_hop"], 1);
    assert.equal(forwards[0]?.attributes["t2.scm.word_id"], result.deliveries[0]?.word_id);
    assert.equal(
      publishes[0]?.attributes["t2.scm.word_id"],
      forwards[0]?.attributes["t2.scm.word_id"],
    );
    assert.equal(
      receives[0]?.attributes["t2.scm.word_id"],
      forwards[0]?.attributes["t2.scm.word_id"],
    );
    assert.equal(trace.getTracerProvider(), before);
  }).pipe(Effect.provide(layerTest({ exporter, filePath: tracePath() })));
});
```

- [ ] **Step 3: Add transport-before-observation proof**

Add transport-before-observation test with complete setup:

```ts
it.effect("does not retract destination write when wrapped effect fails afterward", () =>
  Effect.gen(function* () {
    const destination = new InProcessOpenLoopBus();
    const source = checkedWord("bus.rpc", "node.rpc", "need-control");
    const delivery: BridgeDelivery = {
      route_id: "route.rpc-to-control",
      source_bus_id: "bus.rpc",
      destination_bus_id: "bus.control",
      origin_node_id: "node.rpc",
      origin_bus_id: "bus.rpc",
      origin_timestep: 0,
      forwarded_at_timestep: 1,
      bridge_hop: 1,
      word_id: w1WordId(source),
      word: source,
    };

    const exit = yield* observeBridgeForward(
      delivery,
      Effect.sync(() => destination.publish(delivery.word)).pipe(
        Effect.flatMap(() => Effect.fail("observer-down")),
      ),
    ).pipe(Effect.exit);
    assert.equal(Exit.isFailure(exit), true);
    destination.advanceFundamentalTimestep();
    assert.deepEqual(destination.read(delivery.origin_node_id), delivery.word);
  }),
);
```

Import `Exit` from `effect/Exit`, `BridgeDelivery` from `./g6HomeBusLink.ts`, and `w1WordId` from `./g5OpenLoop.ts`.

- [ ] **Step 4: Add exact provenance assertions**

For an A-to-B delivery assert:

```ts
assert.equal(delivery.source_bus_id, "bus.rpc");
assert.equal(delivery.destination_bus_id, "bus.control");
assert.equal(delivery.origin_bus_id, "bus.rpc");
assert.equal(delivery.origin_node_id, "node.rpc");
assert.equal(delivery.bridge_hop, 1);
assert.deepEqual(delivery.word, sourceWord);
assert.equal(delivery.word.bus_id, "bus.rpc");
assert.equal(delivery.word.node_id, "node.rpc");
```

Assert bridge-route and bus instances expose none of these property names:

```ts
for (const forbidden of [
  "ack",
  "acknowledge",
  "nack",
  "retry",
  "retryCount",
  "halt",
  "mute",
  "codec",
]) {
  assert.equal(forbidden in link, false, forbidden);
}
```

- [ ] **Step 5: Run telemetry suite**

Run:

```bash
vp test run src/scm/g6HomeBusLink.test.ts src/scm/g5OpenLoop.test.ts
```

Expected: bridge span exists only under test-provided T2 layer; global tracer provider identity is unchanged; all words remain delivered when observation wrapper fails after write.

- [ ] **Step 6: Commit exact paths if authorized**

```bash
git add -- apps/server/src/scm/g6HomeBusLink.ts apps/server/src/scm/g6HomeBusLink.test.ts
git commit -m "test(scm): prove bridge provenance and observation"
```

---

### Task 5: Document bounded prototype and verify full authorized scope

**Files:**

- Create: `docs/scm/home-bus-link/README.md`
- Verify only: G1-G5 artifacts and manifests

**Interfaces:**

- Consumes: tested route, clock, and telemetry behavior.
- Produces: accurate contributor-facing status document; no completion manifest.

- [ ] **Step 1: Write status document**

Create `docs/scm/home-bus-link/README.md` with this content:

```markdown
# Bidirectional home-bus link prototype

Status: bounded prototype; does not complete G6 or G8.

Two fixed inverse routes connect two in-process home buses under one shared fundamental clock. A locally originated W1 word published at T becomes readable on its source bus and is forwarded at T+1, then becomes readable on the destination bus at T+2.

The route preserves W1 content, origin node, origin bus, and content-derived `word_id`. W1 carries no `authority_class`; preserved governed source identity remains the basis for later authority evaluation, and the bridge adds none. Delivery-instance identity also includes route and origin timestep, so identical cyclic content crosses once per timestep. Imported words are never re-forwarded.

T2 OpenTelemetry observes successful forwarding with `t2.scm.bridge.forward`. Observation does not admit, route, mute, satisfy, halt, acknowledge, retry, or retract delivery.

Not implemented or authorized here: DIP mute, G7 halt/freeze, independent or production clock sources, clock-domain crossing, dynamic or multi-hop routing, a manifold node, codec, physical transport, semantic parity, live cutover, G6 completion, or G8 completion.
```

- [ ] **Step 2: Run focused implementation suites**

```bash
cd /Users/maxholden/T2-SQUARED/apps/server
vp test run \
  src/scm/g6HomeBusLink.test.ts \
  src/scm/g8SharedClock.test.ts \
  src/scm/g5OpenLoop.test.ts \
  src/scm/g4Word.test.ts
```

Expected: all four files pass.

- [ ] **Step 3: Run G1-G3 regression suites**

```bash
vp test run \
  src/scm/g3Topology.test.ts \
  src/scm/g2Disposition.test.ts \
  src/scm/g1aCompleteness.test.ts \
  src/scm/g1bCompleteness.test.ts
```

Expected: all four files pass; no manifest flag changes.

- [ ] **Step 4: Run scoped checks**

Run repository-supported lint/type inspection on only changed TypeScript paths:

```bash
cd /Users/maxholden/T2-SQUARED
vp lint --type-check \
  apps/server/src/scm/g5OpenLoop.ts \
  apps/server/src/scm/g5OpenLoop.test.ts \
  apps/server/src/scm/g6HomeBusLink.ts \
  apps/server/src/scm/g6HomeBusLink.test.ts \
  apps/server/src/scm/g8SharedClock.ts \
  apps/server/src/scm/g8SharedClock.test.ts
```

Expected: exit 0 with no diagnostics in listed files.

Then run:

```bash
cd /Users/maxholden/T2-SQUARED
git diff --check
git status --short
```

Expected: diff check clean. Status may still list the three preserved Forge files; no task may stage or alter them.

- [ ] **Step 5: Independent completion review**

Reviewer must verify:

- T+2 visibility in both directions.
- One route delivery per local-origin publication instance.
- Identical content on later timesteps is not suppressed.
- Imported words cannot loop.
- W1 content, origin, and `word_id` stay unchanged; no authority field is invented or elevated.
- Shared clock advances every declared fundamental timestep in order.
- No overlapping advances or extra advance after stop.
- T2 provider isolation and bridge span correlation.
- No ACK, retry, DIP, halt, codec, manifold node, multi-hop, parity, or cutover.
- No G1-G5 authorization flags changed.
- No claim that G6 or G8 is complete.

Resolve P0-P2 contract findings before claiming prototype completion. Leave any gate-completion state untouched.

- [ ] **Step 6: Commit exact documentation path if authorized**

```bash
git add -- docs/scm/home-bus-link/README.md
git commit -m "docs(scm): record bounded home-bus link prototype"
```

Do not push or open a PR unless separately authorized.

---

## Final Handoff Contract

Execution report must state:

```text
result: complete | withheld | blocked
base checkpoint:
implementation commits:
routes:
clock:
T+2 proof:
loop proof:
identity proof:
telemetry proof:
focused tests:
G1-G5 regressions:
scoped lint/type result:
diff check:
G6 complete: no
G8 complete: no
G7/G9/G10 authorized: no
codec/DIP/halt/live cutover: absent
Forge files: preserved
push/PR: none
```

No runtime implementation begins until Max Holden explicitly authorizes execution of this plan.

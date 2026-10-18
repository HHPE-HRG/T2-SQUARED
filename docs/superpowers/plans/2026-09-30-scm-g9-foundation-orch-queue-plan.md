# SCM G9 Foundation and ORCH-QUEUE Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a test-complete, non-production-activated G9 core and prove `INV-T2-ORCH-QUEUE` / `queue-offered` through FIFO, one fundamental timestep, W1 on `bus.control`, receiver-aware same-bus `hearAs` at T+1, and closed Effectful G9 observation — without failing live `OrchestrationEngine.dispatch` after a successful `Queue.offer`.

**Architecture:** Load all runtime integers, bus IDs, and node classes from G3/G9 JSON. Coordinator owns attempt sequence, overload episodes, retained current, snapshot→preflight→synchronous commit. Live G8 `SharedFundamentalClock` / `FundamentalTimestepTarget` are **not** generic (error is `HomeBusLinkFailure` only). Task 2 makes them `<E>` so G9 can fail `G9InvariantFault` without wrapping as G8. Live `OrchestrationEngine.dispatch` has no capture service. Task 11 adds optional `t3/scm/G9CaptureService` with error channel `never` so a G9 fault cannot fail dispatch after a successful offer.

**Tech Stack:** TypeScript, Effect v4 (`Context.Service`, `Layer`, `Queue`, `Option`, `Effect.gen`), `@effect/vitest`, existing G4–G8 modules, `withOwnedSpan` / `layerTest` in `apps/server/src/t2Observability/T2Observability.ts`.

## Execution precondition (not solved in this editor session)

Approved design artifacts and this plan currently sit in a dirty working tree. **Do not begin implementation until those artifacts are committed or otherwise pinned.** The implementation worker must create an isolated worktree using `using-git-worktrees` (native isolation first, git worktree fallback). Do not start from an ambiguous dirty base. This planning editor does not commit and does not execute.

**Authorization mode (RFC-021/022):** Creating `apps/server/src/scm/g9*.ts` (Tasks 1–14) requires **authorized mode**: human-authored `docs/scm/g9/authorization.md` with validated body (`gate: G9`, `date: YYYY-MM-DD`, non-empty `human`, `scope: WP1–WP8 runtime`) **and** regen has emitted `implementation_authorized: true` (empty/invalid auth file ⇒ regen fails). Unauthorized hygiene (Task 13 Mode A) does not authorize code work.

## Global Constraints

- Design approved: `docs/superpowers/specs/2026-09-26-scm-g9-shadow-parity-design.md`. Record: `docs/scm/g9/design-approval.md`.
- Until a human authorizes runtime: `implementation_authorized: false` (derived by regen from absent `authorization.md`). Do not invent `docs/scm/g9/authorization.md` in a definition pass.
- Package integers live only in `docs/scm/g9/runtime-parameters.json`. After Task 1, TypeScript may re-export **validated** fields from `G9Package`; it must not define a second source of 64/100/1.
- Bus IDs come from `docs/scm/g3/bus-roster.json` `buses[].bus_id` and must equal `Object.keys` of `docs/scm/g9/governed-classes.json` `buses` as **sets** (order is not law).
- Capture outcomes: `enqueued` | `rejected-capacity` | `rejected-bus-withheld`. Never `rejected-muted`, never `rejected-withheld`, never `invalid` W1, never a fault variant on `G9CaptureResult`.
- Attempt sequence: node-local, coordinator-owned, allocated once **before** admission, advances on enqueue, capacity reject, and `rejected-bus-withheld`. First allocation is **0**. `number` must `G9InvariantFault` `"sequence-overflow"` before `Number.MAX_SAFE_INTEGER`; no wrap. Do not put sequence in JSON/OTEL.
- FIFO: one per G3 `node_id`; max from package JSON; reject new at capacity; never drop queued; no coalescing; no overflow freeze.
- Clock: `process_interval_wake_ms` and `live_process_interval_fundamental_timesteps` from package JSON; no catch-up; skip-if-busy only in G9 waker; states `stopped | armed-idle | armed-in-flight | faulted`.
- Topology: ten runtime buses; no runtime `bus.scm.authority`; reserved `node.observer.404` not in runtime node map; parent not in runtime maps; empty initial DIP; `hearAs` requires receiving **node and bus** G3 binding.
- Preflight throws G9InvariantFault and does not call admitPublish, bus.publish, bus.advanceFundamentalTimestep, or setBusPosition. Commit then, on the same fiber, yield\* observePublish(word, Effect.sync(() => admitPublish(bus, store, word.bus_id, word))) for each already-accepted candidate. Do not wrap that loop in Effect.sync. G9FaultController never calls setBusPosition. admitPublish itself freezes the target bus on an unknown node_id or word.bus_id before it throws, so preflight must reject those identities before commit. After commit, advance only buses whose DIP position is live.
- Observation catalog exact names. Adapters never import `g9Observation.ts`.
- Slice `G9CaptureOccurrenceInput` is a closed union of one member. No `unknown` input. No generic `Record<string, string>` public A. Public equality type name for `INV-T2-ORCH-QUEUE` / `queue-offered` is `G9OrchQueueEqualityA` only (ledger `equality_type` string and TypeScript identifier). A is `{ command_type: "client" | "internal" }` via `Schema.is(DispatchableClientOrchestrationCommand)` on the command `dispatch` receives.
- Vertical slice is not completed G9. No WP5–WP8, no Effect patch, no `server.ts` G9 Layer, no production timer, no validation-count fixture runner (WP8), no new npm deps.
- Tests: `vp test run <path>` from repo root. Never wall-sleep. Comment new modules for later agents (intended vs observed).
- Never `git add .`. Restricted HHPE stays out of git.

### Live alignment (2026-10-02)

Checked against live `feat/t2-opentelemetry` sources. PASS = the plan’s claim already holds on live code or JSON. FAIL = live does not yet match; the matching Task is the planned change, not a hidden “already true” fact. Do not “fix” live `OrchestrationEngine` Queue constructor. Do not invent a second 64/100/1 in TypeScript.

| Verdict | Claim                                                                                                        | Live symbol                                                                                                                          | Plan                                                                                                                                                                                                                                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASS    | Production `commandQueue` is `Queue.unbounded`. `dispatch` calls `Queue.offer` and does not branch on false. | `apps/server/src/orchestration/Layers/OrchestrationEngine.ts` `commandQueue` / `dispatch`                                            | Unbounded offer is not a false path. Do not change the production constructor.                                                                                                                                                                                                                                                                                                    |
| —       | Live false-offer tests                                                                                       | no `Queue.dropping` under `apps/server`                                                                                              | `Queue.dropping(1)` is a Task 11 test constraint. No live false-offer test exists under `apps/server`.                                                                                                                                                                                                                                                                            |
| FAIL    | Capture after `accepted === true` must not fail `dispatch`; `G9CaptureService` error channel `never`         | `OrchestrationEngine.ts` `dispatch` offers then `Deferred.await`; no `G9CaptureService`                                              | Planned Task 11: optional `t3/scm/G9CaptureService` (`G9CaptureServiceShape.captureOccurrence` → `Effect<…, never>`), `G9LiveSafeCaptureLayer` fault sink. Not already wired.                                                                                                                                                                                                     |
| FAIL    | G8 clock target is generic `<E>` so G9 can fail `G9InvariantFault`                                           | `g8SharedClock.ts` `FundamentalTimestepTarget` / `SharedFundamentalClock` / `advanceProcessInterval` error `HomeBusLinkFailure` only | Planned Task 2: `FundamentalTimestepTarget<E = HomeBusLinkFailure>`. Live is not generic. Do not claim `FundamentalTimestepTarget` or `SharedFundamentalClock` is already generic.                                                                                                                                                                                                |
| PASS    | Export `ClientOrchestrationCommand` exists                                                                   | `packages/contracts/src/orchestration.ts` `ClientOrchestrationCommand`                                                               | Schema export only. `apps/server/src/orchestration/Normalizer.ts` `normalizeDispatchCommand` is typed with that schema; it does not call `Schema.is`.                                                                                                                                                                                                                             |
| —       | `Schema.is(ClientOrchestrationCommand)` for `command_type`                                                   | no `Schema.is(ClientOrchestrationCommand)` under `apps/`                                                                             | Task 11 exports DispatchableClientOrchestrationCommand and calls Schema.is on that schema. Schema.is(ClientOrchestrationCommand) classifies the pre-normalization body, not the offered command.                                                                                                                                                                                  |
| PASS    | Ten G3 `buses[]`; ten `governed-classes.json` `buses` keys; no runtime `bus.scm.authority` key               | `docs/scm/g3/bus-roster.json` `buses[]` (10); `docs/scm/g9/governed-classes.json` `buses` (10, no authority key)                     | Coordinator instantiates those ten buses. Parent is `authority_bus_id` string only.                                                                                                                                                                                                                                                                                               |
| —       | G6 `hear` / `hearObserved` vs Task 9 same-bus                                                                | `apps/server/src/scm/g6DipMute.ts` `hear` / `hearObserved`; `DipMuteStore.lookupRow`; `admitPublish`; `DipMuteStore.setBusPosition`  | `hear` and `hearObserved` in `apps/server/src/scm/g6DipMute.ts` take `receiving_bus_id` and call `DipMuteStore.lookupRow(receiving_bus_id, word.bus_id, word.node_id)`. They do not require those bus ids to be equal. Same-bus is Task 9 `hearAs`: `pkg.nodeHomeBus.get(receiving_node_id) === receiving_bus_id`, then `hearObserved`. G9 faults must not call `setBusPosition`. |
| PASS    | FIFO/wake/N loadable from `docs/scm/g9/runtime-parameters.json`                                              | `docs/scm/g9/runtime-parameters.json`                                                                                                | TypeScript may only re-export validated `G9Package` fields. Do not put `64`, `100`, or `1` in a TypeScript literal.                                                                                                                                                                                                                                                               |
| PASS    | `admitPublish` freezes unknown identity before throwing                                                      | `g6DipMute.ts` `admitPublish` calls `setBusPosition(bus_id, "frozen", STEWARD_ACTOR)` then throws `DipMuteFailure`                   | G9 preflight must reject that identity before commit.                                                                                                                                                                                                                                                                                                                             |
| PASS    | `observePublish` is Effect, after the publish effect                                                         | `g5OpenLoop.ts` `observePublish`                                                                                                     | Commit `yield*`s it. Not `Effect.sync`.                                                                                                                                                                                                                                                                                                                                           |
| PASS    | Bus advance calls `mutationGuard` before the timestep swap                                                   | `g5OpenLoop.ts` `InProcessOpenLoopBus.advanceFundamentalTimestep`                                                                    | Skip frozen and halted buses. Do not catch `DipMuteFailure` from advancing them.                                                                                                                                                                                                                                                                                                  |
| PASS    | a thrown `G9InvariantFault` is not on the Effect error channel until `Effect.try` catches it                 | `admitPublish` and `assertMutable` throw `DipMuteFailure`; `Effect.sync` does not type that throw                                    | preflight uses `Effect.try` and latches only `G9InvariantFault`.                                                                                                                                                                                                                                                                                                                  |

---

## Shared types (created in Tasks 1–3; later tasks consume these names unchanged)

```ts
export type G9OverloadReason = "capacity";

export type G9WakerState = "stopped" | "armed-idle" | "armed-in-flight" | "faulted";

export type G9FaultCode =
  | "placement"
  | "reserved-identity"
  | "authority-parent"
  | "w1-invalid"
  | "preflight"
  | "clock-overlap"
  | "sequence-overflow"
  | "capture-defect" // RFC-018: isolated capture-boundary defect (never reuse preflight)
  | "waker-defect"; // RFC-018: isolated waker/tick defect (never reuse preflight / clock-overlap)

export class G9InvariantFault extends Error {
  readonly _tag = "G9InvariantFault";
  constructor(
    readonly code: G9FaultCode,
    message: string,
  ) {
    super(message);
    this.name = "G9InvariantFault";
  }
}

// Agent: Tasks 1–13 slice literal. Task 14 (RFC-017) replaces this with a closed
// union of all 184 ledger (comm_id, phase_id) members + phase-bounded input.
export type G9CaptureOccurrenceInput = {
  readonly comm_id: "INV-T2-ORCH-QUEUE";
  readonly phase: "queue-offered";
  readonly input: { readonly command_type: "client" | "internal" };
};

export type G9OrchQueueEqualityA = {
  readonly command_type: "client" | "internal";
};

export type G9CaptureResult =
  | { readonly status: "enqueued"; readonly occurrence: G9Occurrence }
  | { readonly status: "rejected-capacity"; readonly attempt_sequence: number }
  | { readonly status: "rejected-bus-withheld"; readonly attempt_sequence: number };

export interface G9EqualityMapping {
  readonly equality_bearing_side: "request" | "state";
  readonly A_field: string;
  readonly finite_domain: "request_label" | "state_label";
  readonly rule: string;
}

export interface G9PhaseDeclaration {
  readonly phase_id: string;
  readonly family: string;
  readonly capture_strategy: string;
  readonly semanticKind: "request" | "state";
  readonly equality_projection_A: ReadonlyArray<string>;
  readonly liveToEquality: G9EqualityMapping;
  readonly shadowToEquality: G9EqualityMapping;
  readonly request_label: ReadonlyArray<string>;
  readonly state_label: ReadonlyArray<string>;
  readonly retainCurrentAfterPublish: boolean;
  readonly sensitive_data_exclusions: ReadonlyArray<string>;
  readonly aggregate_member_or_capture_site_id: string;
  readonly fixture_driver_class?: "declaration-absence" | "dormant-prototype";
}

export interface G9RowDeclaration {
  readonly comm_id: string;
  readonly node_id: string;
  readonly origin_bus_id: string;
  readonly home_bus_id: string;
  readonly placementStatus: string;
  readonly origin_relationship: string;
  readonly intended_bus_relationship: string;
  readonly phases: ReadonlyArray<G9PhaseDeclaration>;
}

// Agent: Tasks 1–13 may keep a slice-narrow OrchQueueOccurrence alias locally.
// Task 14 (RFC-017) makes this the sole live shape — ledger-projected for all 184 phases.
export interface G9Occurrence {
  readonly comm_id: string;
  readonly phase_id: string;
  readonly node_id: string;
  readonly origin_bus_id: string;
  readonly attempt_sequence: number;
  // Agent: Task 14 — closed union of named phase A types from g9EqualityA.generated.ts
  // (G9-Generator-Owner). Not a public Record<string,string> fallback (Global Constraints).
  readonly equality_A: G9EqualityA;
  readonly semanticKind: "request" | "state";
  readonly request_label: string;
  readonly state_label: string;
  readonly retainCurrentAfterPublish: boolean;
}

/** Generated closed union of per-phase public A types (Task 14 / RFC-017/019). */
export type G9EqualityA = G9OrchQueueEqualityA; // slice placeholder; Task 14 replaces with generated union

export interface G9RuntimeParameters {
  readonly schemaVersion: number;
  readonly fifo_max_occurrences_per_node: number;
  readonly process_interval_wake_ms: number;
  readonly live_process_interval_fundamental_timesteps: number;
}

export interface G9FaultSink {
  readonly deliver: (fault: G9InvariantFault) => Effect.Effect<void, never>;
}
```

Tasks **1–13** implement and test the ORCH-QUEUE slice only (local narrow aliases allowed). **Task 14 (RFC-017)** widens `G9CaptureOccurrenceInput`, `G9Occurrence`, coordinator validation, and `toW1` inputs to the full ledger projection before WP5/WP6/WP8 non-slice capture. Test-only retained declarations in Task 5 use a **test helper type** `TestRetainOccurrence` inside `g9Promotion.test.ts`, not a second live family.

---

## File Map

| File                                                               | Role                                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `docs/scm/g9/runtime-parameters.json`                              | Sole source of the three runtime integers.                                                               |
| `apps/server/src/scm/g9Package.ts`                                 | Load + validate all G9/G3/G1B package JSON                                                               |
| `apps/server/src/scm/g9Package.test.ts`                            | Set equality, SHA pins, invalid parameter classes                                                        |
| `apps/server/src/scm/g8SharedClock.ts`                             | Generic `FundamentalTimestepTarget<E>` / `SharedFundamentalClock<E>`                                     |
| `apps/server/src/scm/g8SharedClock.test.ts`                        | Existing tests unchanged + custom `E` not converted to `HomeBusLinkFailure`                              |
| `apps/server/src/scm/g9Occurrence.ts`                              | Fault class, freeze helper, capture input/result types                                                   |
| `apps/server/src/scm/g9Occurrence.test.ts`                         | Freeze + fault `_tag`                                                                                    |
| `apps/server/src/scm/g9Fifo.ts`                                    | Atomic admit, sequence, overload episode flags                                                           |
| `apps/server/src/scm/g9Fifo.test.ts`                               | Capacity, sequence, two comm_ids, overload episode flags                                                 |
| `apps/server/src/scm/g9Promotion.ts`                               | Candidates, retained current, `nextAges`                                                                 |
| `apps/server/src/scm/g9Promotion.test.ts`                          | Retain vs FIFO head priority                                                                             |
| `apps/server/src/scm/g9Observation.ts`                             | Effectful catalog emitters + sandbox                                                                     |
| `apps/server/src/scm/g9Observation.test.ts`                        | Allowlist, dying observer, no protocol rollback                                                          |
| `apps/server/src/scm/g9Fault.ts`                                   | Shared latch/controller                                                                                  |
| `apps/server/src/scm/g9Fault.test.ts`                              | First-fault, no G7 mutation, no self-resume                                                              |
| `apps/server/src/scm/g9Coordinator.ts`                             | Ten buses from package, capture, preflight/commit, clock target                                          |
| `apps/server/src/scm/g9Coordinator.test.ts`                        | Withheld spelling, skip frozen bus, all-or-nothing                                                       |
| `apps/server/src/scm/g9HearAs.ts`                                  | Receiver-aware wrap of G6 `hearObserved`                                                                 |
| `apps/server/src/scm/g9HearAs.test.ts`                             | Binding, 404, mute                                                                                       |
| `apps/server/src/scm/g9Waker.ts`                                   | Four-state waker using `SharedFundamentalClock<G9InvariantFault>`                                        |
| `apps/server/src/scm/g9Waker.test.ts`                              | Skip-if-busy, clock-overlap, n from runtime-parameters.json live_process_interval_fundamental_timesteps. |
| `apps/server/src/scm/g9OrchQueueCapture.ts`                        | `command_type` from `Schema.is(DispatchableClientOrchestrationCommand)`; live-safe Layer                 |
| `apps/server/src/scm/g9OrchQueueCapture.test.ts`                   | dropping(1) false; invariant does not fail dispatch                                                      |
| `apps/server/src/orchestration/Layers/OrchestrationEngine.ts`      | Optional `G9CaptureService` after offer; ignore capture result                                           |
| `apps/server/src/orchestration/Layers/OrchestrationEngine.test.ts` | Absent service noninterference                                                                           |
| `apps/server/src/scm/g9VerticalSlice.test.ts`                      | End-to-end slice                                                                                         |

Do not create empty WP5 family files.

---

### Task 1: Package loader, runtime parameters, G3 bus/node sets

**Files:**

- Already exists: `docs/scm/g9/runtime-parameters.json`
- Create: `apps/server/src/scm/g9Package.ts`
- Create: `apps/server/src/scm/g9Package.test.ts`

**Consumes:** `createHash("sha256")` file-bytes pattern from `apps/server/src/scm/g3Topology.ts`. Ledger header `g1b_inventory_sha256` / `g3_topology_sha256`.

**Produces:** `loadG9Package(repoRoot: string): G9Package` used by every later G9 module.

```ts
export interface G9Package {
  readonly parameters: G9RuntimeParameters;
  readonly runtimeBusIds: ReadonlySet<string>;
  readonly placedNodeIds: ReadonlySet<string>;
  readonly nodeHomeBus: ReadonlyMap<string, string>;
  readonly rowsByCommId: ReadonlyMap<string, G9RowDeclaration>;
  readonly g1bInventorySha256: string;
  readonly g3TopologySha256: string;
  readonly governed: GovernedClasses;
}

export const loadG9Package = (repoRoot: string): G9Package;
```

`GovernedClasses` is the existing type from `g6DipMute.ts`: `buses`/`nodes` maps **runtime only** (ten buses, 29 placed nodes), `authority_bus_id: "bus.scm.authority"`.

**Validation (throw `Error` with code in message, not G9InvariantFault — package load is init-time):**

Parameters: missing field, non-number, `NaN`/`Infinity`, non-integer, `<= 0`, string, `null`, `schemaVersion !== 1` each fail. The parser accepts `schemaVersion === 1` and three finite positive integers. It does not compare them to literals. The committed `docs/scm/g9/runtime-parameters.json` is the only copy of those values.

Sets: `|runtimeBusIds| === 10`; `runtimeBusIds` equals G3 `buses[].bus_id` and G9 governed `buses` keys; placed nodes from G3 `placementStatus === "placed"` count 29 and class-equal G9 governed `nodes` (compare `baseline_authority` / G9 `class` as sets of pairs); `node.observer.404` absent from `placedNodeIds` and `governed.nodes`; no `bus.scm.authority` / `node.scm.authority` in runtime maps; G1B/G3/G9 `comm_id` sets equal size 74; each G9 row `node_id`/`origin_bus_id` equals G3 mapping; each pair is in `nodeBusBindings`; ledger SHA fields equal recomputed file hashes.

Empty DIP: `new DipMuteStore(governed)` in later tasks starts with no rows — Task 1 only documents that governed tables are empty of DIP rows.

**ORCH-QUEUE row projection fields** copied from `coverage-ledger.json` into `G9RowDeclaration` (`equality_type` `G9OrchQueueEqualityA`, semanticKind request, A field `command_type`, labels client|internal / offered, retain false, exclusions array, capture site `command_type`).

- [ ] **Step 1: Write failing tests** in `g9Package.test.ts`: happy path reads `docs/scm/g9/runtime-parameters.json` and asserts the loaded `parameters` equal `parseRuntimeParameters` of that file, and `runtimeBusIds.size === 10` and `placedNodeIds.size === 29` and ORCH-QUEUE `phases[0].liveToEquality.A_field === "command_type"`. Separate `it` per invalid parameter class using `writeFileSync` to a temp copy **or** export `parseRuntimeParameters(json: unknown)` tested with literals: `{}`, `{schemaVersion:1,fifo_max_occurrences_per_node:"x",...}`, `null` field, `0`, `-1`, `1.5`, `schemaVersion:2`.

- [ ] **Step 2:** `vp test run apps/server/src/scm/g9Package.test.ts`  
      Expected: FAIL (`g9Package.ts` missing).

- [ ] **Step 3: Minimal loader**

```ts
const sha256File = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

export const parseRuntimeParameters = (value: unknown): G9RuntimeParameters => {
  if (!isRecord(value) || value.schemaVersion !== 1)
    throw new Error("g9-runtime-parameters: schemaVersion");
  const n = (k: string): number => {
    const v = value[k];
    if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v) || v <= 0) {
      throw new Error(`g9-runtime-parameters: ${k}`);
    }
    return v;
  };
  return {
    schemaVersion: value.schemaVersion,
    fifo_max_occurrences_per_node: n("fifo_max_occurrences_per_node"),
    process_interval_wake_ms: n("process_interval_wake_ms"),
    live_process_interval_fundamental_timesteps: n("live_process_interval_fundamental_timesteps"),
  };
};
```

Load G3 bus/node/topology/bindings, G1B rows, ledger, governed-classes. Compare with `setEqual`. No `G9_RUNTIME_BUS_IDS` array.

- [ ] **Step 4:** Same command. Expected: PASS.

- [ ] **Step 5:** Commit only the three files in this task (when execution is authorized).

---

### Task 2: Generic G8 clock target error

**Files:**

- Modify: `apps/server/src/scm/g8SharedClock.ts`
- Modify: `apps/server/src/scm/g8SharedClock.test.ts`

**Produces:** Default type still `HomeBusLinkFailure` so G6/G8 tests need no call-site edits.

```ts
export interface FundamentalTimestepTarget<E = HomeBusLinkFailure> {
  advanceFundamentalTimestep(): Effect.Effect<BridgeAdvanceResult, E>;
}

export class SharedFundamentalClock<E = HomeBusLinkFailure> {
  constructor(private readonly link: FundamentalTimestepTarget<E>) {}
  advanceProcessInterval(
    elapsedFundamentalTimesteps: number,
  ): Effect.Effect<SharedProcessIntervalResult, SharedClockFailure | E> {
    // Keep existing start/stop/overlap/zero/N-loop body.
    // yield* link.advanceFundamentalTimestep() already unions E.
  }
}
```

Do not wrap `E` as `HomeBusLinkFailure`. Do not throw defects.

#### Live body

Live `FundamentalTimestepTarget.advanceFundamentalTimestep` is `Effect.Effect<BridgeAdvanceResult, HomeBusLinkFailure>`. Task 2 adds type parameter `E = HomeBusLinkFailure` on that interface and on `SharedFundamentalClock`. Default stays `HomeBusLinkFailure`. Existing `HomeBusLinkFailure` tests stay. The new test is the `ProbeFault` case already in this task.

Live `advanceProcessInterval` (`g8SharedClock.ts`):

- Not running: `Effect.fail(new SharedClockFailure("fundamental clock is not running"))`. Task 2 leaves this branch alone.
- `elapsedFundamentalTimesteps` is not a non-negative integer: `Effect.fail(new SharedClockFailure("elapsed fundamental timesteps must be a non-negative integer"))`. Task 2 leaves this branch alone.
- `this.advancing`: `Effect.fail(new SharedClockFailure("process interval advance already active"))`. Task 2 leaves this branch alone.
- Otherwise sets `advancing`, then `Effect.gen` loops `elapsedFundamentalTimesteps` times. Zero elapsed runs the loop zero times and still `Effect.ensuring` clears `advancing`. Task 2 leaves that success path alone, including `bumpTimestep` after each successful link call, concatenating `deliveries`/`failures`, and `ensuring(clearAdvancing)`.
- Inside the loop, `yield* link.advanceFundamentalTimestep()` is the only place Task 2 changes: its error channel becomes `E` so the method return type is `SharedClockFailure | E`. Task 2 must not wrap `E` as `HomeBusLinkFailure` and must not change that yield’s success path.
- Loop failure: `bumpTimestep` runs only after that yield succeeds. If call `k` fails, calls `0..k-1` have already returned and `currentFundamentalTimestep` has already moved for those successes. `Effect.ensuring` still runs `clearAdvancing`, so `advancing` is false after the failure. The clock does not roll back those earlier calls. G9 all-or-nothing is inside one coordinator `advanceFundamentalTimestep`, not across this process-interval loop. `elapsedFundamentalTimesteps` is the loop count (`live_process_interval_fundamental_timesteps` when G9 supplies `n`). The clock does not special-case the JSON file’s value.

`start` and `stop` are not this method. Task 2 does not change their `SharedClockFailure` throws.

- [ ] **Step 1:** Add test: class `ProbeFault extends Error { readonly _tag = "ProbeFault" }`; target `Effect.fail(new ProbeFault())`; `advanceProcessInterval(1)` after `start()` fails with `ProbeFault`; `assert.equal(err instanceof HomeBusLinkFailure, false)`. Existing producer-name / overlap tests remain.

- [ ] **Step 2:** `vp test run apps/server/src/scm/g8SharedClock.test.ts`  
      Expected: FAIL until generic signature compiles and ProbeFault test exists.

- [ ] **Step 3:** Apply the generic signatures; constructor stores `FundamentalTimestepTarget<E>`; method return type includes `E`.

- [ ] **Step 4:** Same command. Expected: PASS (all prior G8 tests + ProbeFault).

- [ ] **Step 5:** Commit those two files only.

---

### Task 3: Occurrence freeze and capture result types

**Files:**

- Create: `apps/server/src/scm/g9Occurrence.ts`
- Create: `apps/server/src/scm/g9Occurrence.test.ts`

**Produces:** `freezeOccurrence`, `G9InvariantFault`, types from Shared types.

```ts
export const freezeOccurrence = (occurrence: G9Occurrence): G9Occurrence => {
  Object.freeze(occurrence.equality_A);
  return Object.freeze(occurrence);
};
```

- [ ] **Step 1:** Test `Object.isFrozen(occurrence)` and `Object.isFrozen(occurrence.equality_A)` after freeze; mutating throws in strict mode. Test `new G9InvariantFault("preflight", "x")._tag === "G9InvariantFault"`.

- [ ] **Step 2:** `vp test run apps/server/src/scm/g9Occurrence.test.ts` — FAIL (missing module).

- [ ] **Step 3:** Add the class and freeze helper exactly as above. No `unknown` input type.

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

---

### Task 4: FIFO, atomic admit, sequence, overload episode flags

**Files:**

- Create: `apps/server/src/scm/g9Fifo.ts`
- Create: `apps/server/src/scm/g9Fifo.test.ts`

**Consumes:** `G9Package.parameters.fifo_max_occurrences_per_node`, `freezeOccurrence`.

**Produces:** coordinator later calls **one** method `admit`.

```ts
export type G9OverloadEvent =
  | { readonly kind: "none" }
  | {
      readonly kind: "overload-start";
      readonly node_id: string;
      readonly bus_id: string;
      readonly fifo_depth: number;
      readonly reason: "capacity";
    }
  | {
      readonly kind: "overload-recovered";
      readonly node_id: string;
      readonly bus_id: string;
      readonly fifo_depth: number;
      readonly reason: "capacity";
    };

export class G9NodeFifos {
  constructor(readonly max: number) {}
  /**
   * Allocate sequence, then enqueue or reject. Never two public steps.
   * bus_id is the origin bus of the candidate (for overload attrs).
   */
  admit(args: {
    node_id: string;
    bus_id: string;
    build: (attempt_sequence: number) => G9Occurrence;
  }): { result: G9CaptureResult; overload: G9OverloadEvent; depth: number } {
    const seq = this.nextSequence(args.node_id);
    if (seq > Number.MAX_SAFE_INTEGER - 1) {
      throw new G9InvariantFault("sequence-overflow", args.node_id);
    }
    const depth = this.depth(args.node_id);
    if (depth >= this.max) {
      const start = !this.overloaded.get(args.node_id);
      if (start) this.overloaded.set(args.node_id, true);
      return {
        result: { status: "rejected-capacity", attempt_sequence: seq },
        overload: start
          ? {
              kind: "overload-start",
              node_id: args.node_id,
              bus_id: args.bus_id,
              fifo_depth: depth,
              reason: "capacity",
            }
          : { kind: "none" },
        depth,
      };
    }
    const occ = freezeOccurrence(args.build(seq));
    this.queues.get(args.node_id)!.push(occ);
    const recovered = this.overloaded.get(args.node_id) === true;
    if (recovered) this.overloaded.set(args.node_id, false);
    const newDepth = this.depth(args.node_id);
    return {
      result: { status: "enqueued", occurrence: occ },
      overload: recovered
        ? {
            kind: "overload-recovered",
            node_id: args.node_id,
            bus_id: args.bus_id,
            fifo_depth: newDepth,
            reason: "capacity",
          }
        : { kind: "none" },
      depth: newDepth,
    };
  }
  recordWithheld(node_id: string): { attempt_sequence: number } {
    const seq = this.nextSequence(node_id);
    return { attempt_sequence: seq };
  }
  dequeueHead(node_id: string): G9Occurrence | undefined;
  depth(node_id: string): number;
  peekHead(node_id: string): G9Occurrence | undefined;
}
```

`nextSequence` starts at 0 and increments after returning current. Capacity and withheld both call it. Overload-recovered only on **successful enqueue after overloaded===true**, not on dequeue.

Withheld does not set `overloaded`.

- [ ] **Step 1: Tests** (all in `g9Fifo.test.ts`): first success `attempt_sequence === 0`; load `max` from `docs/scm/g9/runtime-parameters.json` field `fifo_max_occurrences_per_node`; fill `max` successes (sequences `0` through `max - 1`); the next admit is `rejected-capacity` with sequence `max`; the following reject is sequence `max + 1`; after one dequeue, the next successful admit is `overload-recovered` with sequence `max + 2`; two comm_ids same `node_id` share sequence (enqueue A then B → sequences 0 and 1); withheld via `recordWithheld` then enqueue uses next number; `Object.isFrozen` on enqueued occurrence.

- [ ] **Step 2:** `vp test run apps/server/src/scm/g9Fifo.test.ts` — FAIL.

- [ ] **Step 3:** Implement the class with `Map<string, G9Occurrence[]>` and `Map<string, number>` next-seq and `Map<string, boolean>` overloaded. The constructor `max` comes from the loaded parameter. Tests must not write a numeric capacity literal.

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

---

### Task 5: Promotion, retained current, ages

**Files:**

- Create: `apps/server/src/scm/g9Promotion.ts`
- Create: `apps/server/src/scm/g9Promotion.test.ts`

**Consumes:** `nextAges` from `g8SharedClock.ts`, `checkW1Word`, `loadG8FramingParameters`, `CANONICAL_ABSENCE` unused for request-bearing ORCH-QUEUE.

**Law (bind here):**

- At most one queued occurrence promotes per active **live** node per fundamental timestep.
- FIFO head beats repeating retained current.
- Successful publication of a new occurrence replaces previous current.
- `retainCurrentAfterPublish: true` ⇒ that occurrence remains retained current.
- `false` ⇒ current empty after successful publication.
- FIFO empty + retained current ⇒ repeat retained projection (`nextAges` from last **successfully published** W1).
- FIFO empty + current empty ⇒ node inactive (no candidate).
- A non-retained occurrence does not retire another `comm_id` still sitting in FIFO.
- Failed preflight / withheld timestep does not call `nextAges` and does not update last-published snapshot.

```ts
export interface NodeShadowState {
  fifo: G9NodeFifos;
  lastPublished: Map<string, W1Word>;
  retained: Map<string, G9Occurrence>;
}

export const selectPromotion = (
  node_id: string,
  state: NodeShadowState,
):
  | { kind: "fifo"; occurrence: G9Occurrence }
  | { kind: "repeat"; word: W1Word }
  | { kind: "inactive" } => {
  const head = state.fifo.peekHead(node_id);
  if (head !== undefined) return { kind: "fifo", occurrence: head };
  const cur = state.retained.get(node_id);
  if (cur !== undefined) {
    const prev = state.lastPublished.get(node_id);
    // repeat: rebuild W1 from retained occurrence + nextAges(prev, ...)
    return { kind: "repeat", word: /* built in coordinator using toW1 */ prev! };
  }
  return { kind: "inactive" };
};

export const toW1 = (
  occurrence: G9Occurrence,
  prev: W1Word | undefined,
  framing: G8FramingParameters,
): W1Word => {
  const ages = nextAges(
    prev === undefined
      ? undefined
      : {
          fundamental_state: prev.fundamental_state,
          fundamental_request: prev.fundamental_request,
          state_age: prev.state_age,
          request_age: prev.request_age,
        },
    occurrence.state_label,
    occurrence.request_label,
  );
  const word = {
    bus_id: occurrence.origin_bus_id,
    node_id: occurrence.node_id,
    fundamental_state: occurrence.state_label,
    fundamental_request: occurrence.request_label,
    state_age: ages.state_age,
    request_age: ages.request_age,
    modifier_start: framing.modifier_start,
    null: framing.null,
    modifiers: [] as const,
  };
  const checked = checkW1Word(word);
  if (!checked.ok) throw new G9InvariantFault("w1-invalid", checked.failures[0]?.message ?? "w1");
  return checked.word;
};
```

Repeat-current uses `toW1` on the retained occurrence with `prev = lastPublished`.

- [ ] **Step 1:** Tests with **test-only** `G9Occurrence`-shaped objects (cast in test file) `retainCurrentAfterPublish: true` vs false: (a) FIFO head promotes while retained of other comm_id stays queued; (b) after publishing retain-true, empty FIFO repeats same request/state with incremented ages via `nextAges`; (c) after retain-false, empty FIFO is inactive; (d) failed `checkW1Word` path throws `w1-invalid` and test stub lastPublished unchanged.

- [ ] **Step 2:** `vp test run apps/server/src/scm/g9Promotion.test.ts` — FAIL.

- [ ] **Step 3:** Implement `toW1` / `selectPromotion` as specified. Do not dequeue here — dequeue only in coordinator commit.

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

---

### Task 6: Effectful observation + dying observer

**Files:**

- Create: `apps/server/src/scm/g9Observation.ts`
- Create: `apps/server/src/scm/g9Observation.test.ts`

**Consumes:** catalog JSON names; `withOwnedSpan` from `T2Observability.ts`; Effect `Metric`.

```ts
export interface G9Observation {
  readonly overloadStart: (attrs: {
    readonly node_id: string;
    readonly bus_id: string;
    readonly fifo_depth: number;
    readonly reason: G9OverloadReason;
  }) => Effect.Effect<void, never>;
  readonly overloadRecovered: (attrs: {
    readonly node_id: string;
    readonly bus_id: string;
    readonly fifo_depth: number;
    readonly reason: G9OverloadReason;
  }) => Effect.Effect<void, never>;
  // Agent RFC-020: exact five-key allowlist for t2.scm.shadow.fault. fault_code + waker_state
  // always required. Identity attrs optional only when no associated occurrence (omit — never
  // fabricate). Capture faults include identities whenever a package row is available.
  readonly fault: (attrs: {
    readonly fault_code: G9FaultCode;
    readonly waker_state: G9WakerState;
    readonly comm_id?: string;
    readonly node_id?: string;
    readonly bus_id?: string;
  }) => Effect.Effect<void, never>;
  readonly incWakeSkipped: () => Effect.Effect<void, never>;
  readonly setFifoDepth: (
    node_id: string,
    bus_id: string,
    depth: number,
  ) => Effect.Effect<void, never>;
  readonly incRejectedCapacity: () => Effect.Effect<void, never>;
  readonly incRejectedWithheld: () => Effect.Effect<void, never>;
}

export const sandboxObserve = (effect: Effect.Effect<void, never>): Effect.Effect<void, never> =>
  effect.pipe(Effect.catchAllCause(() => Effect.void));
```

Span attribute keys **exactly** catalog `attribute_allowlist` for each G9-owned span. Metric names exact catalog strings.

Coordinator always `yield* sandboxObserve(obs.overloadStart(...))` **after** FIFO mutation.

- [ ] **Step 1:** Tests using `layerTest` / NativeSpan capture like `T2Observability.test.ts`: overload-start attrs only allowlisted keys; dying observer `Effect.die("obs")` inside `sandboxObserve` still leaves a FIFO depth assertion (test: admit then observe-die, depth still 1). No command-body keys in attrs. Fault span: waker-style call with only `fault_code` + `waker_state` emits exactly those two keys (no fabricated identities); capture-style call with package-row identities emits all five allowlisted keys; no sixth attribute (including no `scope`).

- [ ] **Step 2:** `vp test run apps/server/src/scm/g9Observation.test.ts` — FAIL.

- [ ] **Step 3:** Implement emitters with `withOwnedSpan` / Metric; wrap body in `sandboxObserve` internally so callers cannot forget — **or** document coordinator must wrap; this plan requires **internal** catch in each method so methods already return `never`.

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

---

### Task 7: Shared G9 fault controller

**Files:**

- Create: `apps/server/src/scm/g9Fault.ts`
- Create: `apps/server/src/scm/g9Fault.test.ts`

```ts
export class G9FaultController {
  constructor(
    private readonly observation: G9Observation,
    private readonly sink: G9FaultSink,
    private wakerDisarm: () => void,
    private setWakerFaulted: () => void,
  ) {}
  latched(): G9InvariantFault | undefined;
  latch(
    fault: G9InvariantFault,
    ctx: {
      waker_state: G9WakerState;
      // Agent RFC-019/020: identity attrs only when a package row / occurrence exists.
      // Never fabricate 404/authority. Waker/clock faults omit them.
      // scope is latch call-site bookkeeping only — NEVER an observation attribute
      // (exact five-key allowlist; optional = omit key, not accept arbitrary attrs).
      comm_id?: string;
      node_id?: string;
      bus_id?: string;
      scope?: "capture" | "waker";
    },
  ): Effect.Effect<void, never> {
    // Design Faults 1–9. First-fault: if already latched, no second observation and no second sink.
    // 1 Publish nothing: latch does not publish and does not call admitPublish.
    // 2 Retain evidence: keep the first G9InvariantFault (latched()).
    // 3 Latch G9 faulted: setWakerFaulted.
    // 4 Disarm future wakes: wakerDisarm.
    // 5 Emit metadata-only fault observation: sandboxObserve(observation.fault(...)).
    //    Always pass fault_code + waker_state. Pass comm_id/node_id/bus_id only when present
    //    in ctx. Never emit scope or any key outside the five-key allowlist.
    // 6 Deliver typed fault and finite fault code to the supervisor: sink.deliver(fault).
    //    If deliver Dies, emit metadata-only observation then succeed (never fail latch caller).
    // 7 Propagate: callers of latch treat return as never-failing (LiveSafe / tick).
    // 8 Wider stack disposition: supervisor, not this class.
    // 9 No self-freeze, self-halt, live shutdown, resume, or silent swallow without evidence.
  }
}
```

Never import `DipMuteStore.setBusPosition`.
The Task 7 spy proves G9FaultController does not call setBusPosition. It does not prove admitPublish is free of setBusPosition. admitPublish freezes unknown identities itself.

- [ ] **Step 1:** Tests: first latch calls sink once; second latch no second sink; spy store `setBusPosition` never called; `arm` after fault is tested in Task 10 together with waker (`latch` leaves a flag waker reads).

- [ ] **Step 2:** `vp test run apps/server/src/scm/g9Fault.test.ts` — FAIL.

- [ ] **Step 3:** Implement first-fault latch as specified.

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

---

### Task 8: Coordinator capture, preflight, commit

**Files:**

- Create: `apps/server/src/scm/g9Coordinator.ts`
- Create: `apps/server/src/scm/g9Coordinator.test.ts`

**Consumes:** `loadG9Package`, fifos, `toW1`, `selectPromotion`, `admitPublish`, `observePublish`, `G9FaultController`, observation.

```ts
export class G9RosterCoordinator implements FundamentalTimestepTarget<G9InvariantFault> {
  captureOccurrence(
    input: G9CaptureOccurrenceInput,
  ): Effect.Effect<G9CaptureResult, G9InvariantFault>;
  preflightShadowPublish(): {
    readonly candidates: ReadonlyArray<{ node_id: string; word: W1Word; fromFifo: boolean }>;
  };
  commitShadowPublish(
    candidates: ReadonlyArray<{ node_id: string; word: W1Word; fromFifo: boolean }>,
  ): void;
  advanceFundamentalTimestep(): Effect.Effect<BridgeAdvanceResult, G9InvariantFault>;
}
```

**`captureOccurrence` order:** validate `input` equals slice union and loaded row `INV-T2-ORCH-QUEUE` / `queue-offered` / `command_type` in `request_label`; derive `equality_A = { command_type: input.input.command_type }`; if `store.busPosition(row.origin_bus_id)` is `frozen` or `halted`: `seq = fifo.recordWithheld(node)`; then `sandboxObserve(incRejectedWithheld)` + `setFifoDepth`; return `{ status: "rejected-bus-withheld", attempt_sequence: seq }` — **no** overload episode; else `fifo.admit`; then observation for overload-start/recovered/capacity counter/depth **after** mutation.

Wrong `comm_id`/`phase`/`command_type` → `G9InvariantFault` `"placement"` (not a capture result).

**Effect channel:** wrap the body in `Effect.try` / typed Fail so synchronous `G9InvariantFault` throws (e.g. Task 4 `sequence-overflow`) stay **Fail(G9InvariantFault)** with the original code — never Die that RFC-018 would relabel as `capture-defect`.

**`advanceFundamentalTimestep`:** preflightShadowPublish is a plain function. It throws G9InvariantFault or returns the candidates. It does not call admitPublish, bus.publish, bus.advanceFundamentalTimestep, or setBusPosition. advanceFundamentalTimestep calls it with Effect.try and keeps only G9InvariantFault. On that failure: latch once, then fail the Effect. Zero admitPublish, zero bus advances, zero dequeues, zero setBusPosition. Do not use Effect.sync for preflight. A throw that is not G9InvariantFault, including DipMuteFailure, stays a defect.

**Preflight:** for each placed node with live origin bus, `selectPromotion`; skip inactive; skip if that node’s origin bus is frozen or halted (those nodes stay queued; that bus is not in the participating set). Build the candidate word with `toW1`. Then run the design `admitShadowPublish` checks on that word, in this order, before any `admitPublish`: (1) `word.bus_id === row.origin_bus_id ===` the coordinator bus-map key being written; (2) `word.node_id === row.node_id`; (3) G3 node/bus binding matches the row (`node_id`, `origin_bus_id`); (4) identity is placed and non-reserved (`node.observer.404` rejected); (5) identity is not the authority parent (`node.scm.authority` / `bus.scm.authority` rejected); (6) `checkW1Word` succeeds on the candidate word. Check 6 is not inside `toW1`. If any check fails, throw `G9InvariantFault` with the matching code. Precheck failure does not call `admitPublish` and does not mutate G7 freeze/halt.

**Commit:** Commit runs only after preflight accepts every candidate. On that same fiber, for each candidate, yield\* observePublish(word, Effect.sync(() => admitPublish(bus, store, word.bus_id, word))). No later candidate is preflighted in between. Then call bus.advanceFundamentalTimestep() only for buses whose position is live. Do not call it on frozen or halted buses: mutationGuard runs assertMutable and throws DipMuteFailure. Dequeue the FIFO head only for fromFifo nodes. Update lastPublished. Set or clear retained from retainCurrentAfterPublish. Return { deliveries: [], failures: [] }. Sandbox the later G9 observations. Effect.sync around admitPublish is only legal after preflight has already accepted that candidate. A throw from admitPublish is a defect, not a G9 fault. Do not catch it. The returned BridgeAdvanceResult is { deliveries: [], failures: [] }. Do not copy g6HomeBusLink delivery routing into this coordinator.

Public `admitShadowPublish(word, row)` remains the ordered checks 1–6 from design, throwing `G9InvariantFault` without G7 mutation; commit calls those checks only inside preflight.

- [ ] **Step 1: Tests:** (1) Two nodes, one bad W1. The Effect fails with G9InvariantFault, the fault controller latched once, the first bus read is empty, fifo depths are unchanged, and fundamentalTimestep is unchanged. The failure is not a defect. (2) freeze `bus.control`; capture on orchestration is `rejected-bus-withheld` (spell exactly); sequence advanced; no overload-start. (3) freeze one bus, enqueue on a **live** other node, commit advances 9 live buses not the frozen one; frozen fifo unchanged. (4) ten `InProcessOpenLoopBus` instances, `coordinator.buses.size === 10`, no authority key. (5) Preflight of a 404 or parent identity throws G9InvariantFault, does not call admitPublish, and leaves every bus position unchanged. Do not satisfy this test by calling admitPublish and catching DipMuteFailure.

- [ ] **Step 2:** `vp test run apps/server/src/scm/g9Coordinator.test.ts` — FAIL.

- [ ] **Step 3:** Implement snapshot→preflight→commit as above. Instantiate buses with `mutationGuard: () => store.assertMutable(busId)`. Empty DIP at construct.

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

---

### Task 9: Receiver-aware `hearAs`

**Files:**

- Create: `apps/server/src/scm/g9HearAs.ts`
- Create: `apps/server/src/scm/g9HearAs.test.ts`

```ts
export interface G9HearInput {
  readonly receiving_node_id: string;
  readonly receiving_bus_id: string;
  readonly origin_node_id: string;
}

export const hearAs = (
  pkg: G9Package,
  coordinator: G9RosterCoordinator,
  store: DipMuteStore,
  input: G9HearInput,
): Effect.Effect<W1Word | undefined, never, T2Observability> => {
  const bound =
    pkg.runtimeBusIds.has(input.receiving_bus_id) &&
    pkg.placedNodeIds.has(input.receiving_node_id) &&
    pkg.nodeHomeBus.get(input.receiving_node_id) === input.receiving_bus_id;
  // reserved 404 is not in placedNodeIds → fail closed
  if (!bound) return Effect.succeed(undefined);
  const bus = coordinator.buses.get(input.receiving_bus_id);
  if (bus === undefined) return Effect.succeed(undefined);
  return hearObserved(bus, store, input.receiving_bus_id, input.origin_node_id);
};
```

No cross-bus search. Use G6 `hearObserved` (muted-hear span). Provide `T2Observability` via `layerTest` in tests.

- [ ] **Step 1:** After commit of one ORCH-QUEUE word on control: bound `node.orchestration`+`bus.control` hears; same node + `bus.rpc` undefined; other placed node on rpc cannot hear orchestration origin on rpc; invent `node.observer.404` receiving → undefined; mute-source suppresses; mute-modifiers `modifiers.length === 0`.

- [ ] **Step 2:** `vp test run apps/server/src/scm/g9HearAs.test.ts` — FAIL.

- [ ] **Step 3:** Implement exactly the binding predicate + `hearObserved`.

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

---

### Task 10: Waker

**Files:**

- Create: `apps/server/src/scm/g9Waker.ts`
- Create: `apps/server/src/scm/g9Waker.test.ts`

```ts
export class G9Waker {
  constructor(
    private readonly clock: SharedFundamentalClock<G9InvariantFault>,
    private readonly faults: G9FaultController,
    private readonly observation: G9Observation,
    private readonly n: number, // pkg.parameters.live_process_interval_fundamental_timesteps
  ) {}
  state(): G9WakerState;
  arm(): void;
  // stopped -> armed-idle. Does not call start() if this waker already started this clock.
  // faulted: no-op, stay faulted. Does not call start() or the clock. No resume.
  disarm(): void;
  // This waker stops calling the clock. Not clock.stop(). stop() only clears running.
  // From armed-idle or armed-in-flight: state becomes stopped. The in-flight clock call is not
  // cancelled. ensuring still clears advancing when that call ends. Timesteps that already
  // succeeded stay committed. When the Effect settles, write armed-idle only if state is still
  // armed-in-flight; if disarm already set stopped, leave stopped.
  // From faulted: stay faulted. Not a path back to stopped. stopped can arm() again; faulted cannot.
  // disarm and latch must not call clock.stop(); that would fight start-once on a later legal arm.
  tick(): Effect.Effect<void, never> {
    // Returns never. Typed G9InvariantFault, SharedClockFailure, AND defects are isolated here.
    // Agent (RFC-018/019): Task 8 commit still must not catch admitPublish defects on the coordinator
    // fiber. tick wraps advanceProcessInterval / link advance in Effect.exit. On Failure(G9InvariantFault)
    // → latch that fault (ctx: { scope: "waker", waker_state } — scope latch-only; observation
    // omits identity keys), state=faulted. On SharedClockFailure
    // ("process interval advance already active") → latch clock-overlap with same waker ctx.
    // On any other Fail/Die/defect → G9InvariantFault("waker-defect", bounded message) → latch →
    // sink.deliver (sandboxed) → state=faulted. No comm_id/node_id/bus_id fabrication (RFC-020).
    // Interruption-only causes do not latch. Never leave armed-in-flight after a defect.
    // stopped / faulted: void, no clock call.
    // skip-if-busy: set armed-in-flight before advanceProcessInterval; second tick while
    // armed-in-flight increments skipped and does not enter the clock.
    // start() once per clock; later ticks/arm from stopped do not call start() again.
    // success: if still armed-in-flight → armed-idle; if disarm set stopped → stay stopped;
    // if fault landed in flight → stay faulted.
  }
}
```

**Law (RFC-018):** Waker defect supervision = **isolate at `tick` + supervise fiber** (WP7 `forkScoped` under bootstrap scope that owns `G9FaultSink`). Task 8 “do not catch admitPublish defect” remains on the coordinator fiber; the waker boundary converts that die into `waker-defect` + sink delivery.

No `setTimeout`. Missed ticks do not increase `n`. process_interval_wake_ms stays in docs/scm/g9/runtime-parameters.json as the later live cadence. Task 10 does not read it. tick() does not sleep. The test calls tick().

- [ ] **Step 1:** Tests: stopped and faulted ticks do not call the clock; `tick` stays `Effect<void, never>` when the link fails `G9InvariantFault` or the clock fails `SharedClockFailure`; **admitPublish defect / Die during advance → sink.deliver once with code `waker-defect`, state `faulted`, tick `never`, not stuck `armed-in-flight`**; `start()` once per clock; skip-if-busy; `arm()` after G9 fault leaves `faulted`; success path calls `advanceProcessInterval` once with `live_process_interval_fundamental_timesteps` from runtime-parameters.json. `"fundamental clock is not running"` and non-negative-integer `SharedClockFailure` are not clock-overlap. `disarm` while hung does not call `clock.stop()`. `disarm` from `faulted` stays `faulted`.

- [ ] **Step 2:** `vp test run apps/server/src/scm/g9Waker.test.ts` — FAIL.

- [ ] **Step 3:** Implement the state machine as specified. n is pkg.parameters.live_process_interval_fundamental_timesteps. The test reads that same JSON field and expects advanceProcessInterval to be called with it. The test does not contain its own timestep literal.

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit.

---

### Task 11: ORCH-QUEUE helper and live-safe capture service

**Files:**

- Create: `apps/server/src/scm/g9OrchQueueCapture.ts`
- Create: `apps/server/src/scm/g9OrchQueueCapture.test.ts`
- Modify: `apps/server/src/orchestration/Layers/OrchestrationEngine.ts` only around `Queue.offer`

**Consumes:** `dispatch` receives `OrchestrationCommand`. Task 11 exports the schema value `DispatchableClientOrchestrationCommand` from `packages/contracts/src/orchestration.ts`. `Schema.is(DispatchableClientOrchestrationCommand)(command)` is `"client"`. Every other `OrchestrationCommand` is `"internal"`. `ClientOrchestrationCommand` is the pre-normalization body. Do not use it at the offer.

```ts
export const commandTypeOf = (command: OrchestrationCommand): "client" | "internal" =>
  Schema.is(DispatchableClientOrchestrationCommand)(command) ? "client" : "internal";

export const captureIfOfferAccepted = (
  accepted: boolean,
  command: OrchestrationCommand,
  capture: (input: G9CaptureOccurrenceInput) => Effect.Effect<G9CaptureResult | undefined, never>,
): Effect.Effect<void, never> => {
  if (!accepted) return Effect.void;
  const input: G9CaptureOccurrenceInput = {
    comm_id: "INV-T2-ORCH-QUEUE",
    phase: "queue-offered",
    input: { command_type: commandTypeOf(command) },
  };
  return capture(input).pipe(Effect.asVoid);
};

export interface G9CaptureServiceShape {
  readonly captureOccurrence: (
    input: G9CaptureOccurrenceInput,
  ) => Effect.Effect<G9CaptureResult | undefined, never>;
}

export class G9CaptureService extends Context.Service<G9CaptureService, G9CaptureServiceShape>()(
  "t3/scm/G9CaptureService",
) {}

// Agent: cause-level isolation (RFC-016/018). Typed G9InvariantFault alone is not enough.
export const G9LiveSafeCaptureLayer = (
  coordinator: G9RosterCoordinator,
  faults: G9FaultController,
  pkg: G9Package,
  waker: { readonly state: () => G9WakerState },
): Layer.Layer<G9CaptureService> =>
  Layer.succeed(G9CaptureService, {
    captureOccurrence: (input) =>
      coordinator.captureOccurrence(input).pipe(
        Effect.exit,
        Effect.flatMap((exit) => {
          if (Exit.isSuccess(exit)) return Effect.succeed(exit.value);
          if (Cause.isInterruptedOnly(exit.cause)) {
            // Interruption is not a G9 invariant. Do not latch / do not disarm waker.
            return Effect.interrupt;
          }
          const typed = Cause.failureOption(exit.cause);
          const fault = Option.isSome(typed)
            ? typed.value
            : new G9InvariantFault("capture-defect", "G9 capture defect isolated at live boundary");
          const row = pkg.rowsByCommId.get(input.comm_id);
          const resolvedFault =
            row === undefined && fault.code !== "placement"
              ? new G9InvariantFault("placement", "capture input has no package row")
              : fault;
          const ctx =
            row === undefined
              ? { scope: "capture" as const, comm_id: input.comm_id, waker_state: waker.state() }
              : {
                  scope: "capture" as const,
                  comm_id: input.comm_id,
                  node_id: row.node_id,
                  bus_id: row.origin_bus_id,
                  waker_state: waker.state(),
                };
          // Live caller never fails. Task 7 latch sandboxes sink.deliver and emits a metadata-only
          // observation if deliver dies (design Faults #9 — no silent swallow without evidence).
          return faults.latch(resolvedFault, ctx).pipe(Effect.zipRight(Effect.succeed(undefined)));
        }),
      ),
  });
```

**Law (RFC-016/018):** `G9CaptureServiceShape.captureOccurrence` error channel is **`never`**. Isolate via `Effect.exit` → latch → `succeed(undefined)`. Defects use code **`capture-defect`** (never `"preflight"`). No `Cause.pretty` in fault messages. Fault `node_id`/`bus_id` only when the package row exists — **never** fabricate `node.observer.404` / `bus.scm.authority`. Missing row after closed-union validation → latch `placement` with `{ comm_id }` only. Latch/sink sandboxed with `catchAllCause`.

Engine `dispatch`:

```ts
const result = yield * Deferred.make<{ sequence: number }, OrchestrationDispatchError>();
const accepted =
  yield *
  Queue.offer(commandQueue, {
    command,
    result,
    startedAtMs: yield * Clock.currentTimeMillis,
  });
const capture = yield * Effect.serviceOption(G9CaptureService);
if (Option.isSome(capture)) {
  yield *
    captureIfOfferAccepted(accepted, command, (input) => capture.value.captureOccurrence(input));
}
return yield * Deferred.await(result);
```

Live `Queue.offer` success is independent of capture. Do not `Effect.fail` dispatch on G9InvariantFault **or** on capture defects (layer isolates both).

False-offer: `Queue.dropping(1)`, fill with one offer, second `offer` is `false`. Do not use `Queue.bounded(1)`.

- [ ] **Step 1:** Tests: dropping-queue second offer → capture fn call count 0; first true → 1 call with `{command_type}` only; coordinator fails `placement` → sink.deliver once, dispatch stub still succeeds; **coordinator Die/defect → sink.deliver once with code `capture-defect`, dispatch still succeeds, no reserved-identity attrs**; `OrchestrationEngine.test.ts` without G9 layer still passes (run in this task after engine edit).

- [ ] **Step 2:** `vp test run apps/server/src/scm/g9OrchQueueCapture.test.ts` — FAIL until files exist.

- [ ] **Step 3:** Implement helper + Layer + optional serviceOption in `dispatch` immediately after `Queue.offer`. Do not inject `G9RosterCoordinator` into the engine module.

- [ ] **Step 4:** `vp test run apps/server/src/scm/g9OrchQueueCapture.test.ts` and `vp test run apps/server/src/orchestration/Layers/OrchestrationEngine.test.ts` both PASS.

- [ ] **Step 5:** Commit those files.

---

### Task 12: Vertical slice

**Files:**

- Create: `apps/server/src/scm/g9VerticalSlice.test.ts`

Compose `loadG9Package`, store, coordinator, observation, fault sink, waker. Call `captureIfOfferAccepted(true, clientCmd, ...)`, assert FIFO depth 1, `hearAs` empty, `tick` once, `hearAs` bound hears W1 with `fundamental_request` `client` or `internal`, unbound bus undefined, observation attrs have no envelope keys. Optional: memory sqlite `OrchestrationEngineLive` + `G9LiveSafeCaptureLayer` without `server.ts`.

- [ ] **Step 1:** Write the assertions listed in Global Constraints slice list (including false dropping-queue in this file or already in Task 11).

- [ ] **Step 2:** `vp test run apps/server/src/scm/g9VerticalSlice.test.ts` — FAIL until composition works.

- [ ] **Step 3:** Wire test-only Layers. No production timer. Comment: not completed G9.

- [ ] **Step 4:** PASS.

- [ ] **Step 5:** Commit the test file.

---

### Task 13: Focused verification (slice Tasks 1–12)

<!-- Agent RFC-021/022: two modes. Mode A = unauthorized hygiene (no g9*.ts). Mode B = authorized close after Tasks 1–12. -->

**Mode A — unauthorized hygiene (definition / CI; does not authorize Tasks 1–12):**

```bash
test ! -e docs/scm/g9/authorization.md
python3 docs/scm/g9/regen_coverage_ledger.py
# Expect coverage-ledger.json + coverage-validation.json: implementation_authorized == false
# Exact-set 74/184 and counted_fixture_vector_count match validation (currently 763)
# Second regen with unchanged sources: no diff on ledger/fixtures/validation/changelog (RFC-022)
git diff --stat -- patches/effect@4.0.0-beta.103.patch
# Expect empty Effect patch diff while foundation slice remains unauthorized
```

**Mode B — authorized verification (only after valid human `authorization.md` + regen true; Tasks 1–12 already landed):**

```bash
test -e docs/scm/g9/authorization.md
python3 docs/scm/g9/regen_coverage_ledger.py
# Expect exit 0 and implementation_authorized == true (validated body; empty/invalid fails regen)
vp test run apps/server/src/scm/g9Package.test.ts
vp test run apps/server/src/scm/g9Occurrence.test.ts
vp test run apps/server/src/scm/g9Fifo.test.ts
vp test run apps/server/src/scm/g9Promotion.test.ts
vp test run apps/server/src/scm/g9Observation.test.ts
vp test run apps/server/src/scm/g9Fault.test.ts
vp test run apps/server/src/scm/g9Coordinator.test.ts
vp test run apps/server/src/scm/g9HearAs.test.ts
vp test run apps/server/src/scm/g9Waker.test.ts
vp test run apps/server/src/scm/g9OrchQueueCapture.test.ts
vp test run apps/server/src/scm/g9VerticalSlice.test.ts
vp test run apps/server/src/scm/g3Topology.test.ts
vp test run apps/server/src/scm/g4Word.test.ts
vp test run apps/server/src/scm/g5OpenLoop.test.ts
vp test run apps/server/src/scm/g6DipMute.test.ts
vp test run apps/server/src/scm/g7HaltFreeze.test.ts
vp test run apps/server/src/scm/g8SharedClock.test.ts
vp test run apps/server/src/orchestration/Layers/OrchestrationEngine.test.ts
vp run --filter t3 typecheck
git diff --stat -- patches/effect@4.0.0-beta.103.patch
```

Expected (Mode B): every `vp test run` PASS; `t3` typecheck exit 0; regen exit 0 with `implementation_authorized: true`, exact-set `74`/`184` and `counted_fixture_vector_count` matching `coverage-validation.json` (currently **763**); Effect patch diff empty until WP6 is authorized to land hunks.

- [ ] **Step 0:** Confirm mode. If unauthorized, run Mode A only and stop (do not create `g9*.ts`). If authorized, proceed Mode B.

- [ ] **Step 1:** Run the chosen block. Any FAIL in Mode B is a defect in Tasks 1–12, not a new task.

- [ ] **Step 2:** If FAIL, fix the owning G9/G8/engine file from the failing command (do not drop tests).

- [ ] **Step 3:** Re-run the full Mode B block until PASS.

- [ ] **Step 4:** Confirm regen counts and flags (`true` only when `authorization.md` is present **and** valid per RFC-022).

- [ ] **Step 5:** Commit only if verification required a code fix (authorized mode only).

---

### Task 14: Full ledger capture projection widen (blocks WP5/WP6/WP8 capture)

<!-- Agent: RFC-017 supersedes incomplete RFC-015. Sole widen of input + occurrence + toW1. -->

**Owner (serial; cohesion §2):**

| File                                                               | Sole owner                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `g9Occurrence.ts`, `g9Fifo.ts`, `g9Promotion.ts` (`toW1` / retain) | **WP2-Foundation-Owner**                                                       |
| `g9EqualityA.generated.ts`, `g9CaptureInput.generated.ts`          | **G9-Generator-Owner** (regen emits; WP2 imports; no hand edits)               |
| `g9Package.ts` row/phase lookup helpers                            | **WP1-Foundation-Owner** (WP2 consumes; no dual commit)                        |
| `g9Coordinator.ts` package-backed validation + enqueue             | **WP2+WP3-Foundation-Owner**                                                   |
| `g9OrchQueueCapture.ts`                                            | **Slice-Foundation-Owner** (ORCH-QUEUE helper only; not occurrence-type widen) |

**Not** WP5/WP6/WP8 — those bind after this task completes.

**When:** After Task 13 slice verification PASS; **before** any WP5 family or WP6 hook lands a non-slice `captureOccurrence` call; **before** WP8 live-success drivers execute non-slice vectors.

**Widen set (all required — input-only is not sufficient):**

1. `G9CaptureOccurrenceInput` — closed union of all **184** ledger `(comm_id, phase_id)` members + phase-bounded `input`. Union members **set-equal** the ledger phase set via **generated** TS from `regen_coverage_ledger.py` (**G9-Generator-Owner**); **no** hand-maintained second list.
2. `G9Occurrence` — ledger-projected fields; `equality_A: G9EqualityA` is the **generated closed union** of named phase A types (not `Record<string,string>`).
3. `toW1` / promotion — accept widened occurrence labels/equality/retain (no ORCH-QUEUE-only literals).
4. Coordinator — validate against loaded package; wrong `comm_id`/phase → `placement`. Driver-class law (**RFC-019**):
   - **`declaration-absence`:** never enqueue; `captureOccurrence` fails `placement`. WP8 absence driver does **not** call `captureOccurrence` (declaration assert only).
   - **`dormant-prototype`:** enqueue **allowed** for B6/WP8 fixture wiring (ledger W1 vector); **forbidden** from production bootstrap / live server paths (WP7).
5. Live-safe layer keeps package-keyed fault context (RFC-018/019). `G9PhaseDeclaration.fixture_driver_class` is projected from the ledger.

**Tests (Create: `apps/server/src/scm/g9CaptureWiden.test.ts`):**

- Union `(comm_id, phase_id)` set-equals ledger 184 pairs.
- Live-success sample phases enqueue typed `G9Occurrence` with correct named `equality_A`/labels/retain.
- Declaration-absence inputs → `placement` (no enqueue); WP8-style absence assert does not call capture.
- Dormant-prototype inputs **do** enqueue under fixture/test coordinator wiring; production bootstrap never invokes them.
- Illegal inputs → `placement`.
- Live-safe layer still `never` on defects (`capture-defect`); typed `sequence-overflow` Fail keeps its code.

**Non-goals:** WP5/WP6 editing core `g9*.ts`; hand-edited ledger JSON; flipping `implementation_authorized`.

- [ ] **Step 1:** Tests FAIL (slice still narrow).
- [ ] **Step 2:** Implement full widen.
- [ ] **Step 3:** PASS Task 14 tests + re-run Task 13 block (still green).
- [ ] **Step 4:** Commit when execution authorized.

Verify addendum (run after Task 14):

```bash
vp test run apps/server/src/scm/g9CaptureWiden.test.ts
```

Any FAIL in that file is a defect in Task 14 (not Tasks 1–12).

---

## Self-review

- WP1 = Task 1; WP2 = Tasks 3–5; WP3 = Tasks 8–9; WP4 = Tasks 6–7, 10; G8 generic = Task 2; slice = Tasks 11–12; verify slice = 13; **Task 14 full widen** (RFC-017) before WP5/WP6/WP8 non-slice capture.
- No WP5–WP8 in this foundation execution, no `server.ts`, no Effect patch, no WP8 validation-count fixture runner.
- `rejected-bus-withheld` spelling only.
- Live dispatch cannot see `G9InvariantFault`.
- Sequence 0-based, advances on all three outcomes, atomic `admit`.

---

## Remaining execution blockers

- Design + this plan are not pinned/committed; implementer needs a clean isolated worktree.
- Runtime implementation remains unauthorized until a human creates validated `docs/scm/g9/authorization.md` (`gate: G9`, `date: YYYY-MM-DD`, non-empty `human`, `scope: WP1–WP8 runtime`) **and** regen emits `implementation_authorized: true` (RFC-021/022); then Tasks 1–14 run in authorized Mode B.
- Production `Queue.unbounded` never returns false. Task 11 false-offer tests must use `Queue.dropping(1)`; no such live test exists under `apps/server`.

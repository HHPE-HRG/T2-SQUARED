# SCM G7 Halt vs 404 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put freeze/halt on each receiving bus’s DIP as a bus-level position (`live` / `frozen` / `halted`), make the home-bus bridge obey those positions, and keep 404 recommend-stop observational only.

**Architecture:** Extend `DipMuteStore` with per-bus safety position. No campaign object and no new SCM identity. `InProcessOpenLoopBus` stays G5-safe via an optional `mutationGuard`; G7 tests attach a guard that calls `store.assertMutable(busId)`. `BidirectionalHomeBusLink` takes an optional DIP store and skips forward (isolated failure) when source or dest is not `live`. OTEL records `t2.scm.freeze`, `t2.scm.halt`, `t2.scm.recommend_stop` after SCM decisions.

**Tech Stack:** TypeScript, Effect, `@effect/vitest`, existing T2 `withOwnedSpan` / `layerTest`.

## Global Constraints

- Branch: `feat/t2-opentelemetry` at or after `ac87e78ec`.
- Binding design: `docs/superpowers/specs/2026-09-20-scm-g7-halt-freeze-design.md` (human-approved 2026-09-20).
- Auth/decisions: `docs/scm/g7/authorization.md`, `docs/scm/g7/decisions.md`.
- SCM is agnostic of campaigns/workloads. Do not add a campaign controller, safety node, or OTEL-owned identity.
- DIP owns freeze/halt (bus-level). Bridge obeys. Mute rows stay hear-only (G6 unchanged).
- 404 recommend-stop must not write DIP. Observer class and `node.observer.404` cannot set `frozen`/`halted`.
- Do not flip G4/G5 `g6toG10Authorized` or G6 `g7toG10Authorized`. G7 manifest uses `g8toG10Authorized: false`.
- Do not set G3 `halt_initiator` to `yes`.
- `g5OpenLoop.ts` must not import `g6DipMute.ts` (no reverse gate import). Use an optional guard callback on the bus.
- OTEL observational only. No `setGlobalTracerProvider`. No T3 `server.trace.ndjson`.
- No unfreeze/unhalt. No D16 freeze-store product. No new dependency.
- Never `git add .`. Leave Forge handoff files untracked.
- Focused tests only. Commit `feat(scm):` / `test(scm):` / `docs(scm):`.
- Comment modules and exported processes (Parameters/Returns/Example) for other agents.

---

## File Map

- Modify `apps/server/src/scm/g6DipMute.ts`: bus-level position, `setBusPosition`, `assertMutable`, observer denial, freeze/halt/recommend-stop observers, unknown-identity freeze helper.
- Modify `apps/server/src/scm/g5OpenLoop.ts`: optional `mutationGuard` on `InProcessOpenLoopBus` publish/advance only.
- Modify `apps/server/src/scm/g6HomeBusLink.ts`: optional `dip: DipMuteStore`; skip routes when either bus not live; do not advance frozen buses.
- Create `apps/server/src/scm/g7HaltFreeze.test.ts`: G7 proof matrix (DIP + bus + bridge + OTEL).
- Modify `apps/server/src/scm/g6DipMute.test.ts` / `g5OpenLoop.test.ts` / `g6HomeBusLink.test.ts` only if needed to keep default-live behavior.
- Create `docs/scm/g7/README.md`, `docs/scm/g7/manifest.json`.
- Existing `docs/scm/g7/authorization.md`, `decisions.md`; spec/plan as listed.

No new SCM `node_id`.

---

### Task 1: DIP bus-level position

**Files:**

- Modify: `apps/server/src/scm/g6DipMute.ts`
- Create: `apps/server/src/scm/g7HaltFreeze.test.ts`

**Interfaces:**

```ts
export type DipBusPosition = "live" | "frozen" | "halted";

export interface DipActor {
  readonly node_id: string;
  readonly authority_class: AuthorityClass;
}

export const STEWARD_ACTOR: DipActor; // node_id "steward.test", class A2 or a dedicated steward that is NOT observer

// on DipMuteStore:
busPosition(bus_id: string): DipBusPosition; // unknown bus → throw DipMuteFailure (must be governed bus)
setBusPosition(bus_id: string, position: DipBusPosition, actor: DipActor): void;
assertMutable(bus_id: string): void; // throw if frozen|halted
```

Rules:

- Default position for a **governed** bus is `live` until set.
- `setBusPosition` to `frozen`/`halted` rejected if `actor.authority_class === "observer"` or `actor.node_id === "node.observer.404"`. Prior position retained.
- Steward actor allowed. Use governed bus ids from `docs/scm/g6/governed-classes.json`.
- Unknown `bus_id` (not in governed.buses) → throw, no write.
- `setDip` / `removeDip` for a receiving bus that is frozen|halted → throw, rows unchanged.
- `live` → `frozen`/`halted` allowed. `frozen`/`halted` → any other position → throw (no unhalt). Idempotent `halted`→`halted` and `frozen`→`frozen` succeed without changing state.
- Mute rows still work when bus is `live`.

- [ ] **Step 1: Write failing tests** in `g7HaltFreeze.test.ts` (store only): default live; steward freeze; observer rejected; 404 rejected; unknown bus rejected; setDip after freeze fails; mute still settable while live.

- [ ] **Step 2: Run red**

```bash
cd /Users/maxholden/T2-SQUARED/apps/server
vp test run src/scm/g7HaltFreeze.test.ts
```

- [ ] **Step 3: Implement bus-level map on `DipMuteStore`** (private `Map<string, DipBusPosition>`). JSDoc on new APIs. Do not implement OTEL, bus guard, or bridge yet.

- [ ] **Step 4: Green** `vp test run src/scm/g7HaltFreeze.test.ts src/scm/g6DipMute.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/scm/g6DipMute.ts apps/server/src/scm/g7HaltFreeze.test.ts
git commit -m "$(cat <<'EOF'
feat(scm): add DIP bus-level live/frozen/halted positions

EOF
)"
```

---

### Task 2: Bus mutationGuard

**Files:**

- Modify: `apps/server/src/scm/g5OpenLoop.ts`
- Modify: `apps/server/src/scm/g7HaltFreeze.test.ts`
- Modify: `apps/server/src/scm/g5OpenLoop.test.ts` only if constructor signature needs a default-arg test (existing `new InProcessOpenLoopBus()` must keep working).

**Interfaces:**

```ts
export class InProcessOpenLoopBus {
  constructor(options?: { mutationGuard?: () => void });
  publish(word: W1Word): void; // call mutationGuard before write
  advanceFundamentalTimestep(): void; // call mutationGuard before advance
  read(nodeId: string): W1Word | undefined; // never calls guard
}
```

`mutationGuard` throw aborts the write/advance. Do not import G6 from G5.

G7 wiring in tests:

```ts
const guard = () => store.assertMutable("bus.scm.a");
const busA = new InProcessOpenLoopBus({ mutationGuard: guard });
```

- [ ] **Step 1: Failing tests** — freeze then publish/advance throw; read/hear still see pre-freeze snapshot; unguarded G5 bus still publishes.

- [ ] **Step 2: Red** `vp test run src/scm/g7HaltFreeze.test.ts src/scm/g5OpenLoop.test.ts`

- [ ] **Step 3: Implement optional guard**

- [ ] **Step 4: Green** those two files

- [ ] **Step 5: Commit** `feat(scm): refuse publish/advance when DIP bus is frozen`

---

### Task 3: Bridge obeys DIP

**Files:**

- Modify: `apps/server/src/scm/g6HomeBusLink.ts`
- Modify: `apps/server/src/scm/g7HaltFreeze.test.ts`

**Interfaces:**

```ts
constructor(config: {
  buses: ReadonlyMap<string, InProcessOpenLoopBus>;
  routes: readonly [BridgeRoute, BridgeRoute];
  dip?: DipMuteStore; // optional; absent → treat all as live (existing G6 tests)
});
```

In `advanceFundamentalTimestep`:

1. For each bus id in `config.buses`, if `dip` present and `busPosition(id)` is frozen|halted, **do not** call `bus.advanceFundamentalTimestep()` for that bus.
2. For each enabled route, if source or dest position is frozen|halted, push `BridgeRouteFailure` with message `source or destination DIP is frozen or halted` and **do not** `destination.publish`.
3. Live buses still advance and live-to-live routes still forward.

`g6HomeBusLink.ts` may import `DipMuteStore` from `./g6DipMute.ts`.

Reuse home-bus fixture buses `bus.scm.a` / `bus.scm.b` with DIP store from governed-classes.json. Attach mutationGuards per bus id.

- [ ] **Step 1: Failing it.effect tests** — freeze A: A does not accept dest publish; B still publishes; after T+2, A.read peer is absent (no forward into A); B.read of A may still hold last snapshot if A was frozen after a prior delivery (design: freeze A before publish — neither direction delivers). Mute-source on live buses: bridge still forwards (regression).

- [ ] **Step 2: Red** `vp test run src/scm/g7HaltFreeze.test.ts src/scm/g6HomeBusLink.test.ts`

- [ ] **Step 3: Implement dip consult + skip advance**

- [ ] **Step 4: Green**

- [ ] **Step 5: Commit** `feat(scm): skip home-bus forward when DIP bus is frozen`

---

### Task 4: OTEL + 404 recommend-stop

**Files:**

- Modify: `apps/server/src/scm/g6DipMute.ts`
- Modify: `apps/server/src/scm/g7HaltFreeze.test.ts`

**Interfaces:**

```ts
export const observeBusPosition = <A, E, R>(
  attrs: { bus_id: string; position: DipBusPosition; reason: string; node_id: string },
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R>;
// span name t2.scm.freeze when position frozen, t2.scm.halt when halted
// do not emit for live

export const recommendStop = (
  from_node_id: string,
  reason: string,
): Effect.Effect<void, never, T2Observability>;
// span t2.scm.recommend_stop; does not call setBusPosition
```

Wrap successful steward `setBusPosition` in tests with `observeBusPosition`.

Tests (`layerTest` + `InMemorySpanExporter` like G6): recommend-stop does not freeze; freeze/halt spans; tracer provider identity unchanged; illegal observer set emits no freeze span.

- [ ] **Steps 1–5:** TDD then commit `feat(scm): observe DIP freeze, halt, and 404 recommend-stop`

---

### Task 5: Unexpected identity freeze

**Files:**

- Modify: `apps/server/src/scm/g6DipMute.ts`
- Modify: `apps/server/src/scm/g7HaltFreeze.test.ts`

**Interfaces:**

```ts
export const admitPublish = (
  bus: InProcessOpenLoopBus,
  store: DipMuteStore,
  bus_id: string,
  word: W1Word,
): void;
```

`admitPublish`: `store.assertMutable(bus_id)`; if `word.node_id` not in `store.governedClasses().nodes` or `word.bus_id` not in buses, `setBusPosition(bus_id, "frozen", STEWARD_ACTOR)` (or a system steward actor that is not observer) and throw **without** `bus.publish`. If identity ok, `bus.publish(word)`.

Do not halt other buses.

- [ ] **Steps 1–5:** TDD then commit `feat(scm): freeze DIP bus on unknown publish identity`

---

### Task 6: Proof matrix + G7 package

**Files:**

- Modify: `apps/server/src/scm/g7HaltFreeze.test.ts`
- Create: `docs/scm/g7/README.md`, `docs/scm/g7/manifest.json`
- Modify: `apps/server/src/scm/g6DipMute.ts` (`loadG7Package` / `checkG7` **or** put loaders in a small section of g6DipMute — prefer `g7HaltFreeze.ts` **only** as DIP/bridge function re-exports if file needed; otherwise keep loaders in `g6DipMute.ts` next to G6 loaders to avoid a fake controller. **Preferred:** add `loadG7Package`/`checkG7` in a new `g7HaltFreeze.ts` that imports DipMuteStore helpers and contains recommendStop if that keeps g6DipMute smaller. If Task 4 already put observers in g6DipMute, G7 loaders can live in `g7HaltFreeze.ts` as package check only.)

Keep it simple: put `loadG7Package`/`checkG7` in `apps/server/src/scm/g7HaltFreeze.ts` as package metadata only (not a campaign class).

Manifest:

```json
{
  "schemaVersion": 1,
  "gate": "G7",
  "status": "completed",
  "authorized": true,
  "completed": true,
  "doesNotAuthorizeLaterGates": true,
  "g8toG10Authorized": false,
  "plan": "docs/superpowers/plans/2026-09-20-scm-g7-halt-freeze.md",
  "authorization": {
    "identity": "human-operator",
    "scope": "G7 halt vs 404",
    "note": "Human authorized G7 on 2026-09-20. DIP bus-level freeze/halt; bridge obeys; 404 recommend-stop observational. G8–G10 locked. Not human A7 attestation."
  }
}
```

Proof cases remaining: halt both homes via two DIP writes; mute ≠ freeze; G4/G5 still `g6toG10Authorized` false; G6 still `g7toG10Authorized` false; G3 `halt_initiator` still never `yes` (read node-roster.json).

README: DIP owns G7, bridge obeys, no campaign identity, OTEL observes.

- [ ] **Step 4 regression**

```bash
cd /Users/maxholden/T2-SQUARED/apps/server
vp test run src/scm/g4Word.test.ts src/scm/g5OpenLoop.test.ts src/scm/g6HomeBusLink.test.ts src/scm/g6DipMute.test.ts src/scm/g7HaltFreeze.test.ts src/scm/g8SharedClock.test.ts
vp lint --type-check src/scm/g5OpenLoop.ts src/scm/g6DipMute.ts src/scm/g6HomeBusLink.ts
```

- [ ] **Step 5: Commit** docs + tests + any loader. Also stage `docs/scm/g7/authorization.md`, `docs/scm/g7/decisions.md`, spec, and this plan if still untracked.

```
docs(scm): package G7 halt/freeze on DIP without unlocking G8-G10
```

Never stage Forge handoff files.

---

## Spec coverage

| Design                                             | Task |
| -------------------------------------------------- | ---- |
| DIP bus-level live/frozen/halted                   | 1    |
| Observer/404 cannot halt                           | 1, 4 |
| Publish/advance fail when frozen                   | 2    |
| Bridge obeys both ends; skip advance               | 3    |
| Recommend-stop OTEL only                           | 4    |
| Unknown identity freezes that bus                  | 5    |
| Mute ≠ freeze                                      | 3, 6 |
| Halt is per-bus DIP (two writes to stop two homes) | 6    |
| No campaign identity; flags stay locked            | 6    |

## Execution

Subagent-driven-development: one implementer per task, TDD, commit, then next task.

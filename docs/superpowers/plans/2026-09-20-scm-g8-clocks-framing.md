# SCM G8 Clocks and Framing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Name the in-process fundamental-timestep producer, publish the integer age/repeat table, and record framing parameters without encodings or a new SCM identity.

**Architecture:** Extend existing `g8SharedClock.ts` / `g8SharedClock.test.ts` (canonical `gNName.ts` gate file). Add `docs/scm/g8/framing-parameters.json`. `nextAges` and `loadG8Package` live in that same module. DIP/bridge unchanged except G8 tests proving a frozen bus is not clocked.

**Tech Stack:** TypeScript, Effect, `@effect/vitest`, T2 `withOwnedSpan` / `layerTest`.

## Global Constraints

- Branch: `feat/t2-opentelemetry` at or after `d992dfb40`.
- Design: `docs/superpowers/specs/2026-09-20-scm-g8-clocks-framing-design.md`.
- Auth: `docs/scm/g8/authorization.md`, `docs/scm/g8/decisions.md`.
- Canonical names: `apps/server/src/scm/g8SharedClock.ts`, `g8SharedClock.test.ts`, `docs/scm/g8/*`. Do **not** create `g8Ages.ts`.
- Producer name: `scm.fundamental-clock` (not a `node_id`).
- No codec, nibble, wire values for `modifier_start`/`null`.
- Do not flip G7 `g8toG10Authorized`. G8 manifest uses `g9toG10Authorized: false`.
- OTEL observes only. No `setGlobalTracerProvider`. No T3 `server.trace.ndjson`.
- Never `git add .`. Leave Forge handoff files untracked.
- Comment new exports (Parameters/Returns/Example).
- Focused `vp test run` only.

---

## File Map

- Create `docs/scm/g8/framing-parameters.json`
- Modify `apps/server/src/scm/g8SharedClock.ts` — `PRODUCER_NAME`, `nextAges`, `observeClockAdvance`, `loadG8Package`/`checkG8`
- Modify `apps/server/src/scm/g8SharedClock.test.ts`
- Create `docs/scm/g8/README.md`, `docs/scm/g8/manifest.json`
- Existing auth/decisions/spec/plan

---

### Task 1: Framing fixture + producer name

**Files:**

- Create: `docs/scm/g8/framing-parameters.json`
- Modify: `apps/server/src/scm/g8SharedClock.ts`
- Modify: `apps/server/src/scm/g8SharedClock.test.ts`

**Interfaces:**

```ts
export const G8_PRODUCER_NAME = "scm.fundamental-clock" as const;

export interface G8FramingParameters {
  readonly producer_name: typeof G8_PRODUCER_NAME;
  readonly modifier_start: "modifier_start";
  readonly null: "null";
  readonly words_per_node_per_fundamental_timestep: 1;
}

export const loadG8FramingParameters = (repoRoot: string): G8FramingParameters;
```

`SharedFundamentalClock` exposes `readonly producer_name = G8_PRODUCER_NAME`.

JSON:

```json
{
  "producer_name": "scm.fundamental-clock",
  "modifier_start": "modifier_start",
  "null": "null",
  "words_per_node_per_fundamental_timestep": 1
}
```

Existing interval/overlap/zero tests must stay green.

- [ ] **Step 1:** Failing test: `new SharedFundamentalClock(link).producer_name === "scm.fundamental-clock"` and fixture JSON matches.

- [ ] **Step 2:** `cd /Users/maxholden/T2-SQUARED/apps/server && vp test run src/scm/g8SharedClock.test.ts`

- [ ] **Step 3:** Implement fixture load + property.

- [ ] **Step 4:** Green.

- [ ] **Step 5:** Commit `feat(scm): name G8 fundamental-clock producer`

---

### Task 2: Age/repeat table `nextAges`

**Files:**

- Modify: `apps/server/src/scm/g8SharedClock.ts`
- Modify: `apps/server/src/scm/g8SharedClock.test.ts`

**Interfaces:**

```ts
export interface AgePair {
  readonly state_age: number;
  readonly request_age: number;
}

export const nextAges = (
  previous: { fundamental_state: string; fundamental_request: string; state_age: number; request_age: number } | undefined,
  nextState: string,
  nextRequest: string,
): AgePair;
```

Rules from the design table. First word (`previous` undefined) → `{ state_age: 0, request_age: 0 }`.

Pure function. Do not change G5 `publish` to auto-apply (G8 proves the table; tests call `nextAges`).

- [ ] **Steps 1–5:** TDD cases: first word; repeat request same state; state change; request change; both change. Commit `feat(scm): add G8 state_age and request_age table`

---

### Task 3: Observe clock advance + frozen bus

**Files:**

- Modify: `apps/server/src/scm/g8SharedClock.ts`
- Modify: `apps/server/src/scm/g8SharedClock.test.ts`

**Interfaces:**

```ts
export const observeClockAdvance = <A, E, R>(
  attrs: { elapsed_fundamental_timesteps: number; producer_name: string },
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R>;
```

Span `t2.scm.clock.advance` after success (same `withOwnedSpan` pattern as G6). Tests: `layerTest` + exporter; tracer provider identity unchanged.

Frozen-bus case: DIP store + mutationGuards + `BidirectionalHomeBusLink` with `dip` + `SharedFundamentalClock`. Freeze `bus.scm.a`. Publish on B while live. `advanceProcessInterval(1)` must not throw solely because A is frozen (link skips A). A remains frozen/unadvanced; B still advances.

Keep overlap/zero tests.

- [ ] **Steps 1–5:** TDD. Commit `feat(scm): observe G8 clock advance and skip frozen buses`

---

### Task 4: G8 package

**Files:**

- Create: `docs/scm/g8/README.md`, `docs/scm/g8/manifest.json`
- Modify: `apps/server/src/scm/g8SharedClock.ts` (`loadG8Package`, `checkG8`)
- Modify: `apps/server/src/scm/g8SharedClock.test.ts`
- Stage: `docs/scm/g8/authorization.md`, `decisions.md`, spec, this plan, `framing-parameters.json`

Manifest: gate G8, completed, `g9toG10Authorized: false`, `doesNotAuthorizeLaterGates: true`, plan path `docs/superpowers/plans/2026-09-20-scm-g8-clocks-framing.md`. No review hash (same as G6/G7 slice completeness).

Assert G7 still `g8toG10Authorized === false`. Encoding keys still rejected via `checkW1Word`.

README: producer name, age table, placeholders not encodings, precursor is now this package, G9–G10 locked.

```bash
cd /Users/maxholden/T2-SQUARED/apps/server
vp test run src/scm/g4Word.test.ts src/scm/g5OpenLoop.test.ts src/scm/g6HomeBusLink.test.ts src/scm/g6DipMute.test.ts src/scm/g7HaltFreeze.test.ts src/scm/g8SharedClock.test.ts
vp lint --type-check src/scm/g8SharedClock.ts src/scm/g5OpenLoop.ts
```

Commit `docs(scm): package G8 clocks without unlocking G9-G10`

Never stage Forge handoff files.

---

## Spec coverage

| Requirement                      | Task               |
| -------------------------------- | ------------------ |
| Producer name                    | 1                  |
| Age/repeat table                 | 2                  |
| Framing placeholders / fixture   | 1, 4               |
| Process interval / overlap / N=0 | existing tests + 3 |
| Frozen bus not clocked           | 3                  |
| OTEL                             | 3                  |
| Package; G9–G10 locked           | 4                  |

## Execution

Subagent-driven-development, one task at a time, TDD, commit.

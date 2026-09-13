# SCM G6 DIP Mute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce D12 DIP mute law on in-process receiving buses (`mute-source` and `mute-modifiers`) with steward DIP position mutation, proven on the existing two-home-bus surface without muting publish or bridge forward.

**Architecture:** Keep G5 storage and `BidirectionalHomeBusLink` forwarding unchanged. Add an injectable governed-class table plus a DIP store that validates mute law at `setDip`. Add `hear(origin_node_id)` that applies one winning DIP row (concrete `source_node_id` overrides `*`) on the receive path only. Optional W1 `modifiers` is a prototype semantic field for `mute-modifiers` proofs only.

**Tech Stack:** TypeScript, Effect, `@effect/vitest`, existing T2 `withOwnedSpan` / `layerTest`, Node crypto/fs/path.

## Global Constraints

- Branch: `feat/t2-opentelemetry` at or after `4e4571e30`.
- Binding design: `docs/superpowers/specs/2026-09-11-scm-g6-dip-mute-design.md` (human-approved 2026-09-12).
- Auth/decisions: `docs/scm/g6/authorization.md`, `docs/scm/g6/decisions.md`.
- Read `AGENTS.md`, `g4Word.ts`, `g5OpenLoop.ts`, `g6HomeBusLink.ts`, and their tests before editing.
- G6 is human-authorized. Do **not** flip G4/G5 `g6toG10Authorized` to true. Do not authorize G7–G10.
- Mute only on hear/read. Publish and bridge forward stay invariant.
- Bridge is not DIP-controlled. W1 has no `authority_class`. Never elevate via bridge.
- Suppressive modes = `mute-source` | `mute-modifiers`. Both fail closed when source class > receiving class, and when targeting the authority parent.
- DIP/governed class mismatch fails at `setDip` (retain prior DIP). Stale hear-time mismatch: skip suppression (fail-open hear); never mute.
- DIP row key `(receiving_bus_id, source_bus_id, source_node_id)` is unique; `setDip` is **explicit upsert-by-key** after validation (needed for mute one/both/none position changes).
- Concrete node row overrides `*` for the same source bus; no mode merging.
- Authority proof surface uses injectable classes (not G3 pin churn in this plan):
  - `bus.scm.authority` / `node.scm.authority` → `A0` (unmutable parent)
  - `bus.scm.a` / `node.scm.home-a` → `A2`
  - `bus.scm.b` / `node.scm.home-b` → `A2`
- `modifiers` is prototype semantic representation only — not codec/wire.
- OTEL observational only; no `setGlobalTracerProvider`; no T3 `server.trace.ndjson`.
- No new dependency. No ACK/retry. Use “fundamental timestep,” never “tick.”
- Unrelated Forge handoff files stay untracked. Never `git add .`. Stage exact paths only when commit authority exists.
- Focused tests only (`vp test run` on touched SCM tests). Do not run repo-wide CI.
- Commit message style: `feat(scm): …` / `test(scm): …` / `docs(scm): …` matching recent SCM commits.
- Plan existence alone does not complete G6; completion requires green proof matrix + package docs.

---

## File Map

- Modify `apps/server/src/scm/g4Word.ts`: optional prototype `modifiers: ReadonlyArray<string>` (default `[]`).
- Modify `apps/server/src/scm/g4Word.test.ts`: accept/reject modifiers; still reject encoding keys.
- Modify `apps/server/src/scm/g5OpenLoop.ts`: leave `read`/`publish` unchanged; optionally leave `w1WordId` **excluding** modifiers (fundamentals-only correlation).
- Create `apps/server/src/scm/g6DipMute.ts`: governed lookup, DIP store, mute law, `hear`, OTEL helpers.
- Create `apps/server/src/scm/g6DipMute.test.ts`: mute-law, precedence, mismatch, proof matrix, OTEL.
- Create `docs/scm/g6/README.md`, `docs/scm/g6/manifest.json`, `docs/scm/g6/governed-classes.json`.
- Modify `docs/superpowers/specs/2026-09-11-scm-g6-dip-mute-design.md`: status → design-approved; lock plan choices (authority id, hear beside read, OTEL names).
- Do **not** edit Forge handoff untracked files. Do **not** flip G4/G5 manifests’ `g6toG10Authorized`.

---

### Task 1: Prototype W1 `modifiers` field

**Files:**

- Modify: `apps/server/src/scm/g4Word.ts`
- Modify: `apps/server/src/scm/g4Word.test.ts`

**Interfaces:**

- Consumes: existing `checkW1Word` / `W1Word`.
- Produces: `W1Word.modifiers?: ReadonlyArray<string>` normalized to `[]` when absent; accepted when present as an array of non-empty strings.

- [ ] **Step 1: Write failing modifiers tests**

Add to `g4Word.test.ts`:

```ts
it("accepts optional prototype modifiers between placeholders", () => {
  const result = checkW1Word({ ...validWord, modifiers: ["attn-low"] });
  assert.equal(result.ok, true, result.ok ? "" : result.failures.map((f) => f.message).join("\n"));
  assert.ok(result.ok === true);
  assert.deepEqual(result.word.modifiers, ["attn-low"]);
});

it("defaults missing modifiers to empty array", () => {
  const result = checkW1Word(validWord);
  assert.ok(result.ok === true);
  assert.deepEqual(result.word.modifiers, []);
});

it("rejects non-array or empty-string modifiers", () => {
  assert.equal(checkW1Word({ ...validWord, modifiers: "x" }).ok, false);
  assert.equal(checkW1Word({ ...validWord, modifiers: [""] }).ok, false);
});
```

- [ ] **Step 2: Run red**

```bash
cd /Users/maxholden/T2-SQUARED/apps/server
vp test run src/scm/g4Word.test.ts
```

Expected: FAIL on unknown field `modifiers` and/or missing `modifiers` on word.

- [ ] **Step 3: Minimal implementation**

In `g4Word.ts`:

- Add `readonly modifiers: ReadonlyArray<string>` to `W1Word`.
- Allow key `modifiers` in addition to `REQUIRED_W1_SLOTS` (keep required slots unchanged; do not add `modifiers` to `REQUIRED_W1_SLOTS`).
- Validate: absent → `[]`; present → array of non-empty strings; else failure code `modifiers`.
- Include `modifiers` in returned word.
- Comment: prototype semantic representation for G6 mute-modifiers only; not codec/wire.

- [ ] **Step 4: Run green**

```bash
vp test run src/scm/g4Word.test.ts
```

Expected: PASS. Also run `vp test run src/scm/g5OpenLoop.test.ts src/scm/g6HomeBusLink.test.ts` — word helpers that omit `modifiers` must still pass via defaulting in `checkW1Word`.

- [ ] **Step 5: Commit**

```bash
cd /Users/maxholden/T2-SQUARED
git add apps/server/src/scm/g4Word.ts apps/server/src/scm/g4Word.test.ts
git commit -m "$(cat <<'EOF'
feat(scm): add prototype W1 modifiers for G6 mute-modifiers

EOF
)"
```

---

### Task 2: DIP store, mute law, governed class mismatch

**Files:**

- Create: `apps/server/src/scm/g6DipMute.ts`
- Create: `apps/server/src/scm/g6DipMute.test.ts`
- Create: `docs/scm/g6/governed-classes.json`

**Interfaces:**

- Consumes: authority order `A0 > A1 > A2 > observer`.
- Produces:

```ts
export type AuthorityClass = "A0" | "A1" | "A2" | "observer";
export type DipMode = "hear" | "mute-source" | "mute-modifiers";

export interface DipRow {
  readonly receiving_bus_id: string;
  readonly receiving_authority_class: AuthorityClass;
  readonly source_bus_id: string;
  readonly source_node_id: string; // concrete or "*"
  readonly source_authority_class: AuthorityClass;
  readonly mode: DipMode;
  readonly steward: string;
  readonly runtime_mutable: boolean;
}

export interface GovernedClasses {
  readonly buses: ReadonlyMap<string, AuthorityClass>;
  readonly nodes: ReadonlyMap<string, AuthorityClass>;
  readonly authority_bus_id: string; // "bus.scm.authority"
}

export class DipMuteFailure extends Error {}

export class DipMuteStore {
  constructor(governed: GovernedClasses);
  setDip(row: DipRow): void; // upsert-by-key after validation
  removeDip(receiving_bus_id: string, source_bus_id: string, source_node_id: string): void;
  listDip(receiving_bus_id: string): ReadonlyArray<DipRow>;
  resolveMode(receiving_bus_id: string, origin_bus_id: string, origin_node_id: string): DipMode;
}
```

`resolveMode` implements concrete-over-wildcard; default `hear` when no row.

- [ ] **Step 1: Write failing mute-law / precedence / mismatch tests**

Create `g6DipMute.test.ts` with helpers loading `docs/scm/g6/governed-classes.json` (or inline map matching that fixture). Cover at minimum:

1. `setDip` accepts A2 mute-source of A2 peer.
2. `setDip` rejects mute-source when source class > receiving class.
3. `setDip` rejects mute-modifiers when source class > receiving class.
4. `setDip` rejects any mute targeting `bus.scm.authority`.
5. `setDip` rejects DIP class ≠ governed class (receiver and source).
6. Invalid `setDip` leaves prior rows intact.
7. Wildcard + concrete: concrete wins for that node; wildcard for others.
8. `setDip` upsert replaces same key mode (hear → mute-source).
9. `runtime_mutable: false` row cannot be mutated via `setDip`/`removeDip` after install (install of immutable fixture rows allowed once).

Use `@effect/vitest` `assert`/`describe`/`it` like sibling tests.

- [ ] **Step 2: Run red**

```bash
cd /Users/maxholden/T2-SQUARED/apps/server
vp test run src/scm/g6DipMute.test.ts
```

Expected: module missing / failures.

- [ ] **Step 3: Implement store + fixture**

`docs/scm/g6/governed-classes.json`:

```json
{
  "authority_bus_id": "bus.scm.authority",
  "buses": {
    "bus.scm.authority": "A0",
    "bus.scm.a": "A2",
    "bus.scm.b": "A2"
  },
  "nodes": {
    "node.scm.authority": "A0",
    "node.scm.home-a": "A2",
    "node.scm.home-b": "A2"
  }
}
```

Implement validation before mutate; throw `DipMuteFailure` with clear messages. Class compare uses fixed order map. For `source_node_id === "*"`, compare `source_authority_class` to governed **bus** class; for concrete id, to governed **node** class (and node must be known).

- [ ] **Step 4: Run green**

```bash
vp test run src/scm/g6DipMute.test.ts
```

Expected: PASS for Task 2 cases (hear projection tests may still be absent).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/scm/g6DipMute.ts apps/server/src/scm/g6DipMute.test.ts docs/scm/g6/governed-classes.json
git commit -m "$(cat <<'EOF'
feat(scm): add G6 DIP store with D12 mute-law validation

EOF
)"
```

---

### Task 3: `hear` projection on receiving bus

**Files:**

- Modify: `apps/server/src/scm/g6DipMute.ts`
- Modify: `apps/server/src/scm/g6DipMute.test.ts`

**Interfaces:**

- Consumes: `InProcessOpenLoopBus.read`, `DipMuteStore.resolveMode`, `W1Word`.
- Produces:

```ts
export const hear = (
  bus: InProcessOpenLoopBus,
  store: DipMuteStore,
  receiving_bus_id: string,
  origin_node_id: string,
  options?: { governed?: GovernedClasses },
): W1Word | undefined;
```

Behavior:

1. `const word = bus.read(origin_node_id)`; if absent → undefined.
2. Resolve mode with `(receiving_bus_id, word.bus_id, word.node_id)`.
3. If store row exists but governed class now mismatches DIP classes → treat as no suppression (return full word). Prefer checking via store helper `shouldSuppress(row, governed)`.
4. `mute-source` → undefined.
5. `mute-modifiers` → `{ ...word, modifiers: [] }`.
6. Else → word as stored.
7. `bus.read` remains unfiltered (prove storage unchanged under mute).

- [ ] **Step 1: Write failing hear tests**

- mute-source: publish peer word, advance, `read` still has word, `hear` undefined.
- mute-modifiers: stored modifiers non-empty; `hear` returns empty modifiers; `read` still has modifiers.
- no DIP: `hear` equals `read`.
- restore: upsert mode to `hear`; `hear` returns word without republish.
- stale mismatch: after installing valid mute, swap governed table so classes disagree → `hear` admits (no mute).

- [ ] **Step 2: Run red**

```bash
vp test run src/scm/g6DipMute.test.ts
```

- [ ] **Step 3: Implement `hear`**

Keep `hear` beside `read` (do not replace `InProcessOpenLoopBus.read`).

- [ ] **Step 4: Run green**

```bash
vp test run src/scm/g6DipMute.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/scm/g6DipMute.ts apps/server/src/scm/g6DipMute.test.ts
git commit -m "$(cat <<'EOF'
feat(scm): apply DIP mute on hear path only

EOF
)"
```

---

### Task 4: Two-home bridge proof matrix

**Files:**

- Modify: `apps/server/src/scm/g6DipMute.test.ts`

**Interfaces:**

- Consumes: `BidirectionalHomeBusLink`, `InProcessOpenLoopBus`, `DipMuteStore`, `hear`, `checkW1Word`.
- Produces: integration tests only (no new production types required).

Fixture buses: Map keys `bus.scm.a` / `bus.scm.b`; origins `node.scm.home-a` / `node.scm.home-b`; inverse routes like home-bus tests; optional third bus `bus.scm.authority` with `node.scm.authority` published onto child storage **without** requiring bridge (direct publish onto child bus storage simulating mandatory higher traffic, or publish locally on each child after copying authority word — simplest: publish authority-origin word directly onto child bus writing map via `publish` of a word whose `bus_id`/`node_id` are authority identities).

Proof cases (after T+2 where bridge involved):

| Case                        | Expect                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| No mute                     | each `hear`s the other                                                                   |
| Mute one side               | A mute-source B: A `hear` B undefined; B `hear` A present; both `read`/bridge still hold |
| Mute both                   | neither hears the other; bridge still forwarded (`read` sees peer)                       |
| mute-modifiers              | A hears fundamentals; modifiers `[]` on hear; `read` keeps modifiers                     |
| Authority mute attempt      | `setDip` throws; authority still heard                                                   |
| Higher-class mute-modifiers | `setDip` throws                                                                          |

Also assert publish continues while muted (peer still publishes next timestep).

- [ ] **Step 1: Write failing matrix tests**

- [ ] **Step 2: Run red** (only new cases fail if prior tasks green)

- [ ] **Step 3: Fix only if production gaps appear** (should be test-only if Tasks 2–3 complete)

- [ ] **Step 4: Run green**

```bash
vp test run src/scm/g6DipMute.test.ts src/scm/g6HomeBusLink.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/scm/g6DipMute.test.ts
git commit -m "$(cat <<'EOF'
test(scm): prove G6 DIP mute matrix on two home buses

EOF
)"
```

---

### Task 5: OTEL observe DIP set and muted hear

**Files:**

- Modify: `apps/server/src/scm/g6DipMute.ts`
- Modify: `apps/server/src/scm/g6DipMute.test.ts`

**Interfaces:**

```ts
export const observeDipSet = <A, E, R>(
  row: DipRow,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R>;

export const observeHearMuted = <A, E, R>(
  attrs: {
    receiving_bus_id: string;
    source_bus_id: string;
    source_node_id: string;
    mode: DipMode;
    word_id?: string;
    origin_node_id: string;
    origin_bus_id: string;
  },
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R>;
```

Span names: `t2.scm.dip.set`, `t2.scm.hear.muted`. Use `withOwnedSpan` like `observePublish`. Observation runs after successful decision; must not perform mute.

Wire optional helper:

```ts
export const hearObserved = (...): Effect.Effect<W1Word | undefined, never, T2Observability>
```

that calls `hear` then emits `t2.scm.hear.muted` when mute-source suppresses (and optionally `t2.scm.hear` when admitted — emit muted at minimum).

- [ ] **Step 1: Write failing OTEL tests** using `layerTest` + `InMemorySpanExporter` pattern from `g6HomeBusLink.test.ts` / `g5OpenLoop.test.ts`. Assert span names/attributes; assert `trace.getTracerProvider()` identity unchanged; no writes under a temp T3 path if that pattern exists.

- [ ] **Step 2: Run red**

- [ ] **Step 3: Implement observers**

- [ ] **Step 4: Run green**

```bash
vp test run src/scm/g6DipMute.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/scm/g6DipMute.ts apps/server/src/scm/g6DipMute.test.ts
git commit -m "$(cat <<'EOF'
feat(scm): observe G6 DIP set and muted hear on T2 OTEL

EOF
)"
```

---

### Task 6: G6 package docs + barrier checks

**Files:**

- Create: `docs/scm/g6/README.md`
- Create: `docs/scm/g6/manifest.json`
- Modify: `apps/server/src/scm/g6DipMute.ts` (load/check helpers)
- Modify: `apps/server/src/scm/g6DipMute.test.ts`
- Modify: `docs/superpowers/specs/2026-09-11-scm-g6-dip-mute-design.md` (status + locked plan choices)
- Modify: `docs/scm/g6/decisions.md` (artifact sequence points at this plan)

**Interfaces:**

```ts
export interface G6Manifest {
  schemaVersion: 1;
  gate: "G6";
  status: "authorized" | "in-progress" | "completed";
  authorized: boolean;
  completed: boolean;
  doesNotAuthorizeLaterGates: true;
  g7toG10Authorized: false;
  plan: string;
  authorization: { identity: string; scope: string; note: string };
}

export const loadG6Package = (repoRoot: string): G6Package;
export const checkG6 = (pkg: G6Package): G6CheckResult;
```

Manifest starts as `status: "in-progress"`, `authorized: true`, `completed: false` until final task marks completed (or leave completed false until human completion review — **prefer `in-progress` until proof matrix green, then set `completed: true` with note that G7–G10 remain locked**).

Do **not** add `g6toG10Authorized: true` anywhere. Include `g7toG10Authorized: false`.

Assert in tests:

- `checkG6` ok for legal tuple.
- G4/G5 manifests still `g6toG10Authorized === false`.
- README states hear-only mute, bridge unaffected, prototype modifiers, non-goals.

- [ ] **Step 1: Write package/barrier tests + docs**

- [ ] **Step 2: Run**

```bash
vp test run src/scm/g6DipMute.test.ts src/scm/g4Word.test.ts src/scm/g5OpenLoop.test.ts
```

- [ ] **Step 3: Fill README/manifest/check helpers**

- [ ] **Step 4: Full focused regression**

```bash
cd /Users/maxholden/T2-SQUARED/apps/server
vp test run src/scm/g4Word.test.ts src/scm/g5OpenLoop.test.ts src/scm/g6HomeBusLink.test.ts src/scm/g6DipMute.test.ts src/scm/g8SharedClock.test.ts
vp lint --type-check src/scm/g4Word.ts src/scm/g5OpenLoop.ts src/scm/g6DipMute.ts src/scm/g6HomeBusLink.ts
```

Expected: all PASS / lint 0.

- [ ] **Step 5: Commit**

```bash
git add docs/scm/g6/README.md docs/scm/g6/manifest.json docs/scm/g6/decisions.md \
  docs/superpowers/specs/2026-09-11-scm-g6-dip-mute-design.md \
  apps/server/src/scm/g6DipMute.ts apps/server/src/scm/g6DipMute.test.ts
git commit -m "$(cat <<'EOF'
docs(scm): package G6 DIP mute gate without unlocking G7-G10

EOF
)"
```

---

## Spec coverage (self-review)

| Design requirement                                        | Task |
| --------------------------------------------------------- | ---- |
| Hear-only mute; publish/bridge invariant                  | 3, 4 |
| Authority parent unmutable; same/lower mute               | 2, 4 |
| mute-source + mute-modifiers; both vs higher class        | 2, 4 |
| Precedence concrete > `*`                                 | 2    |
| Class mismatch reject at setDip                           | 2    |
| Steward DIP position mutation / restore without republish | 3, 4 |
| Prototype modifiers                                       | 1    |
| OTEL see mutes                                            | 5    |
| G6 package; no g6toG10Authorized flip                     | 6    |
| Proof matrix one/both/none                                | 4    |

## Locked plan choices (were open in design)

1. Authority bus id: **`bus.scm.authority`** (+ `node.scm.authority`, A0) via injectable `governed-classes.json` (no G3 pin update in this plan).
2. **`hear` beside `read`** — `read` stays raw storage.
3. OTEL: **`t2.scm.dip.set`**, **`t2.scm.hear.muted`** (admit span optional).

---

## Execution

After this plan is saved, execute with **subagent-driven-development**: one fresh implementer subagent per task, review between tasks, continuous until complete unless blocked.

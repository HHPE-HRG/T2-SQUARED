# SCM G9 WP8 exact-set integration proof — definition plan (U5)

<!-- Agent: definition only. No apps/server/src/scm/g9*.ts. No authorization.md. Do not execute. Do not commit in this pass. -->

- Date: 2026-10-17
- Unit: **U5** (G9 Manager charter)
- Governing design: `docs/superpowers/specs/2026-09-26-scm-g9-shadow-parity-design.md` (complete G9 = shadow-label parity on all 74 rows; G10 remains unauthorized live replacement)
- WP7 composition (prerequisite): `docs/superpowers/plans/2026-10-17-scm-g9-wp7-composition-plan.md`
- Integration allocation: `docs/scm/g9/integration-readiness.md` §4 WP8 row, §7 integration gates
- Machine validation: `docs/scm/g9/coverage-validation.json`
- Fixture corpus: `docs/scm/g9/fixture-vectors.json` (generated; **763** `counted_fixture_vector_count` per validation snapshot)

## Authorization

```yaml
implementation_authorized: false
writing_plans_authorized: true # planning definition only; mirrors coverage-validation.json
```

Do **not** create `docs/scm/g9/authorization.md`, flip `g9toG10Authorized`, implement the fixture runner, or claim **complete G9** from the ORCH-QUEUE vertical slice alone.

---

## 1. Outcome

Deliver a **closed definition** for how a future authorized session proves **complete G9** — not the first vertical slice — by exercising **every approved ledger row and finite phase branch** against generated fixtures, while preserving live noninterference and closed G5–G8 law.

When `implementation_authorized` becomes true, WP8 implementation will demonstrate:

1. **All approved rows** — every `comm_id` in the G1B=G3=G9 exact set (**74** unique) has an executable proof path: **production** rows via WP5 family modules and/or WP6 typed hooks under WP7 bootstrap (after foundation Task 14 widen); **dormant-prototype** phases (`dormant_prototype_phases`) and **declaration-absence** phases (`declaration_absence_phases`) via fixture-only drivers — never production fabric or a live writer invented for G9. Do not key those drivers on the `CANONICAL_ABSENCE` request label alone. Init-time registry rejects any hand-maintained second list.
2. **Every phase / finite branch** — each counted fixture vector in `docs/scm/g9/fixture-vectors.json` (**763** vectors at current validation snapshot) is runnable via a **generator-backed runner** that maps `fixture_id` → bounded live projection → expected `expected_equality_A`, labels, retention, and live-failure disposition; **no silent skip** (unmapped, `it.skip`, or empty TODO branches forbidden for counted vectors).
3. **Same-bus hear** — for publish/hear fixtures: bound same-bus receiver hears at T+1 via roster **`hearAs`**; unbound or cross-bus paths do not hear; direct `bus.read` is not substituted for DIP hear.
4. **FIFO overload and recovery** — per-node depth cap **64**; **`rejected-capacity`** on overflow (not `invalid`); recovery after drain without wall catch-up; sequence allocated **before** admission.
5. **Fault-stop** — unexpected invariant → **`G9InvariantFault`**: publish nothing on fault path, evidence retained, waker **`faulted`**, metadata-only fault observation, supervisor delivery; G9 does not freeze/halt the wider live stack; expected capacity/withheld outcomes remain distinct from fault.
6. **Live noninterference** — with G9 Layer **absent**, baseline live suites unchanged; with G9 Layer **present**, successful live RPC/orchestration/MCP/OTLP paths still succeed and hook faults do not rewrite live results (WP6 law).
7. **No wall sleep** — proofs use fake/injected clock, waker test seams, and receipt/event waits; no `setTimeout`/`sleep` as proof of timestep or hear timing.
8. **Dormant non-production** — **`INV-T2-SCM-HOME-BUS-LINK`** remains **`dormant-prototype`** in validation; fixtures for B6 run in **test/fixture-only** wiring (`g9FamilyHomeBusLinkFixtures`); **no** production `BidirectionalHomeBusLink` fabric or live forward re-bridge to create occurrences.
9. **No silent skip** — runner reports explicit pass/fail per vector; CI fails on missing fixture handler, unexecuted counted vector, or digest/set mismatch after regen.

WP8 is the work package that may truthfully claim **complete G9 shadow-label parity** per design purpose. The **`INV-T2-ORCH-QUEUE` / `queue-offered`** slice remains an architecture proof only and is **not** complete G9 (`integration-readiness.md` §5).

---

## 2. Depends on (definition closed)

WP8 proof planning **binds** only after WP7 bootstrap composition is specified and (at implementation time) landable:

| Prerequisite    | Closed artifact                                                       | WP8 consumes                                                                                                                             |
| --------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **WP7**         | `docs/superpowers/plans/2026-10-17-scm-g9-wp7-composition-plan.md`    | `G9ShadowStackLayer` (or equivalent), optional `G9CaptureService`, waker under supervisor, ten-bus coordinator, hook layer merge exports |
| WP1–WP4 + slice | `docs/scm/g9/wp1-wp4-foundation-cohesion.md`, foundation plan         | FIFO, fault, waker, observation, vertical slice laws reused as property tests                                                            |
| **WP5**         | `docs/superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md` | All family capture call sites required to drive fixture projections                                                                      |
| **WP6**         | `docs/superpowers/plans/2026-10-17-scm-g9-wp6-typed-hooks-plan.md`    | `planned_typed_hooks` phases executable post-patch                                                                                       |

WP8 does **not** redefine coordinator, bootstrap, or family law; it **verifies** the composed stack against the generated fixture corpus and global gates.

---

## 3. Fixture runner definition (normative)

### 3.1 Single source of truth

| Artifact                               | Role                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `docs/scm/g9/fixture-vectors.json`     | **Consumed** by the runner; `schemaVersion: 1`; `vectors` map keyed by `fixture_id`   |
| `docs/scm/g9/coverage-ledger.json`     | Row/phase declarations, `capture_strategy`, equality types                            |
| `docs/scm/g9/regen_coverage_ledger.py` | **Only** approved mutator of generated G9 JSON (ledger, fixtures, validation outputs) |

**Never hand-edit** `fixture-vectors.json`, `coverage-ledger.json`, or `coverage-validation.json`. Regenerate from source declarations and steward-closed inventory; re-run package validation.

### 3.2 Runner responsibilities (text)

Proposed implementation surfaces (names RFC at implementation; not authored in this pass):

1. **`G9FixtureRunner`** (or test harness module under `apps/server/src/scm/`) loads `fixture-vectors.json` from repo root at test init (same path as `loadG9Package`).
2. For each **counted** vector (`counted_fixture_vector_count` from `coverage-validation.json`, currently **763**):
   - Resolve `comm_id` / `phase` from vector metadata and ledger.
   - Select **driver** by machine fields (not request-label prose):
     - **`fixture_driver_class: "declaration-absence"`** on the ledger phase, or membership in `coverage-validation.json` → `declaration_absence_phases` — declaration fixture only: assert ledger predicate + zero live writer / zero production occurrence; **do not** invent a writer to satisfy G9; do not require `enqueued`. Vector `expected_live_failure_no_capture_disposition` must match the phase law (not `"success-path"`).
     - **`fixture_driver_class: "dormant-prototype"`** or membership in `coverage-validation.json` → `dormant_prototype_phases` — see §3.4 (not the live-success default).
     - **Forbidden:** keying absence or dormancy solely on request label `CANONICAL_ABSENCE` or on prose status alone when a machine field exists.
     - **live-success** (default when not declaration-absence / dormant-prototype) — family / hook test helper that stimulates a real success boundary, then asserts `captureOccurrence` result (`enqueued` \| `rejected-capacity` \| `rejected-bus-withheld`). Requires foundation **Task 14 full widen** (RFC-017: input + occurrence + `toW1`) before non-slice vectors.
     - **coordinator-only** — not a counted-vector driver class. FIFO/governance/capacity/`hearAs` coverage is via **dedicated property tests** (foundation/WP3/WP8 helpers), not per-vector fields in the ledger.
   - Apply **`bounded_live_projection`** when the driver class requires stimulation (test doubles, injected services, patch hook fakes — no production payload retention).
   - Advance **G9 test clock/waker** when the driver class publishes/hears; assert W1/`expected_equality_A`, labels, retention, hear outcome, and observation allowlist where applicable.
3. Emit a **manifest**: total vectors, executed, failed, and any vector IDs lacking a driver (**must be zero** for WP8 close). Absence/dormant drivers count as executed when their declaration assertions pass.
4. Optional **shard** by family bundle or `comm_id` for CI parallelism; shards must **partition** the full counted set with no overlap and no omission.

### 3.3 Generator provenance

Validation snapshot (`coverage-validation.json` → `fixture_provenance_counts`):

- `independently-extracted-source`: 697
- `g9-ledger-declaration`: 66

Runner must not treat provenance as skip permission; both classes remain **mandatory** executed vectors.

### 3.4 Dormant row execution policy

Machine key: `fixture_driver_class: "dormant-prototype"` / `dormant_prototype_phases` (currently `INV-T2-SCM-HOME-BUS-LINK` / `home-bus-forward-succeeded`). Vectors run only through **`g9FamilyHomeBusLinkFixtures`** (WP5 B6): synthetic/test bus wiring that **may** call `captureOccurrence` and enqueue (ledger W1 / `expected_equality_A`), **not** production bootstrap. WP8 proves parity on the dormant row without activating production home-bus-link fabric. Distinct from **declaration-absence** (no capture call). Vector disposition must match phase law (not `"success-path"`).

---

## 4. Exact-set and package validation gates

Run **before** and **after** WP8 test landings (implementation session):

| Gate                | Source                                         | Pass condition                                                                                                                                                            |
| ------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Set equality        | `coverage-validation.json`                     | `g1b_unique_count` = `g3_unique_count` = `g9_unique_count` = **74**; `top_level_set_equality`: true                                                                       |
| Source exactness    | `coverage-validation.json`                     | `source_exact`: true; `counted_unresolved_phase_count`: 0; `still_structural_count`: 0                                                                                    |
| Shape / steward     | same                                           | `shape-valid`, `source_checked_subset`, `steward-closed`; `unresolved`: []                                                                                                |
| Regen               | `python3 docs/scm/g9/regen_coverage_ledger.py` | Regenerates ledger + fixtures + validation; **no diff** unless source declarations changed                                                                                |
| Implementation flag | same                                           | `implementation_authorized`: false until human `authorization.md` exists **and** passes RFC-022 body validation (WP8 tests may land under authorized future session only) |
| Dormant             | same                                           | `INV-T2-SCM-HOME-BUS-LINK` ∈ `dormant-prototype`; not promoted to production wiring                                                                                       |

Digest-pinned loader init (WP1) must still throw on G1B/G3/G9 mismatch independent of fixture runner.

---

## 5. G5–G8 regression suite (file paths)

WP8 global verification includes **unchanged passing** of existing SCM gate tests (no reopening closed FIFO/topology/DIP/fault/waker/observation/RPC/HTTP/stream law):

| Package                            | Test file                                   |
| ---------------------------------- | ------------------------------------------- |
| G5 open-loop publish               | `apps/server/src/scm/g5OpenLoop.test.ts`    |
| G6 home-bus-link (live module law) | `apps/server/src/scm/g6HomeBusLink.test.ts` |
| G6 DIP mute                        | `apps/server/src/scm/g6DipMute.test.ts`     |
| G7 halt/freeze                     | `apps/server/src/scm/g7HaltFreeze.test.ts`  |
| G8 shared fundamental clock        | `apps/server/src/scm/g8SharedClock.test.ts` |

Note: `apps/server/src/scm/g1aCompleteness.test.ts`, `g1bCompleteness.test.ts`, `g2Disposition.test.ts`, `g3Topology.test.ts` remain part of broader SCM CI; integration-readiness §7 explicitly names **G5–G8 regressions** alongside G9 properties for WP8 close.

Additional WP8-owned tests (future implementation, not this pass):

- G9 core property tests (FIFO 64, fault-stop, waker skip-if-busy, payload exclusion) — modules from WP2–WP4 plan.
- **`G9FixtureRunner`** integration test(s) driving full or sharded **763** vector set.
- Live integration: G9 Layer absent **and** present (`integration-readiness.md` §7).

---

## 6. Verification matrix (WP8 acceptance)

When implementation is authorized, WP8 closes only if **all** rows below pass:

| Area                   | Proof mechanism                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Row coverage           | 74 `comm_id`s each with ≥1 passing vector                                                                             |
| Branch coverage        | 763/763 counted fixtures executed; zero silent skips                                                                  |
| Same-bus hear          | Dedicated `hearAs` property tests (foundation/WP3); not per-vector ledger fields                                      |
| FIFO overload/recovery | Dedicated capacity property tests + shared FIFO injection helper; ledger vectors prove equality/labels/retention only |
| Fault-stop             | Invariant injection tests; no G7 mutation on shadow fault                                                             |
| Live noninterference   | Baseline orchestration/RPC suites absent G9; present G9 without dispatch regression                                   |
| Clock                  | No wall sleep; injected timestep/waker only                                                                           |
| Dormant home-bus-link  | B6 fixtures only; validation `dormant-prototype` unchanged                                                            |
| Observation            | Closed catalog allowlist; no enqueue span; export failure cannot mutate coordinator                                   |
| WP6 hooks              | Absent unchanged; present post-success only; all **21** `planned_typed_hooks` phases covered (RpcServer + MCP/OTLP)   |
| Package                | Regen + validation JSON gates (§4)                                                                                    |
| G5–G8                  | Five test files in §5 green                                                                                           |

---

## 7. Non-goals

| Non-goal                                    | Rationale                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **New mechanism families or comm_ids**      | Exact set frozen at 74; no eleventh bus or unofficial rows                                                          |
| **Reopening closed laws**                   | FIFO, topology, DIP, fault, waker, observation, RPC, HTTP, stream, telemetry-export (`integration-readiness.md` §1) |
| **G10 / `g9toG10Authorized`**               | G9 is shadow-label parity beside live; G10 is live replacement (`shadow-parity-design.md` purpose)                  |
| **Calling ORCH-QUEUE slice “complete G9”**  | Slice is WP1–WP4 architecture proof only (§1 outcome item 9)                                                        |
| **Hand-maintained fixture edits**           | Violates generator contract (§3)                                                                                    |
| **Production home-bus-link fabric**         | Dormant row + WP5 B6 fixture policy                                                                                 |
| **Codec / WORK-000035 losslessness claims** | Design forbids                                                                                                      |
| **Runtime in this definition pass**         | U5 deliverable is markdown only                                                                                     |
| **WP7 bootstrap implementation**            | Prerequisite owner is WP7; WP8 assumes it exists                                                                    |

---

## 8. Proposed implementation sequence (not executed here)

<!-- Agent RFC-021/022: auth-before-code. Flag survives regen via validated authorization.md body. -->

1. **Human authorization (required first):** create `docs/scm/g9/authorization.md` with `gate: G9`, `date: YYYY-MM-DD`, non-empty `human`, `scope: WP1–WP8 runtime`; run `python3 docs/scm/g9/regen_coverage_ledger.py` (exit 0); confirm `implementation_authorized: true` in ledger + validation. Empty/invalid auth ⇒ regen fails. Do not hand-edit generated JSON. Do not start bootstrap/drivers/runner without this step.
2. Foundation Tasks 1–14 (authorized Task 13 Mode B) and WP7 bootstrap owner lands **`G9ShadowStackLayer`**.
3. WP5/WP6 owners complete family and hook drivers needed for vector projections (no missing `comm_id` handlers).
4. Implement **`G9FixtureRunner`** per §3; start with shard per WP5 bundle, then merge to full **763** run.
5. Add WP8 CI entry: regen check + validation JSON (flag remains `true` while a **valid** `authorization.md` exists; second regen no-diff when sources unchanged) + G5–G8 suite + G9 properties + fixture marathon (optionally nightly full shard merge).

---

## 9. Open questions — Manager-answered (as they came up)

| #   | Topic                         | Manager RFC           | Decision                                                                                                 |
| --- | ----------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | Runner placement              | **RFC-010 A**         | One entrypoint `g9FixtureRunner.test.ts`; optional internal shards                                       |
| 2   | Live vs layer-factory drivers | (normative)           | Prefer WP7-exported layer factory; full `server.ts` only for vectors that require HTTP listen            |
| 3   | Failure diagnostics           | (normative)           | Fail-fast per shard; record `fixture_id` + equality diff; no payloads                                    |
| 4   | Shard digest check            | (folded into RFC-010) | Each shard re-checks `counted_fixture_vector_count`                                                      |
| 5   | Hook-dependent vectors        | (normative)           | Stub hook layer OK if same `captureOccurrence` path; patch required only for patch-seam vectors          |
| 6   | Capacity stress               | (normative)           | Shared FIFO injection helper; `rejected-capacity` from property tests (not missing ledger vector fields) |
| 7   | CI G9 present                 | **RFC-003 A**         | Split absent/present jobs; marathon requires opt-in present                                              |
| 8   | Fixture count prose           | **RFC-004 A** + regen | Authoritative `counted_fixture_vector_count` **763**                                                     |

Resolver: G9 Manager. See `docs/scm/g9/rfc-queue.md`.

---

## Authoritative cross-links

| Document                                                           | Role                                       |
| ------------------------------------------------------------------ | ------------------------------------------ |
| `docs/scm/g9/manager-charter.md`                                   | U5 unit; blind consensus                   |
| `docs/scm/g9/integration-readiness.md`                             | WP8 row; §7 global gates                   |
| `docs/scm/g9/fixture-vectors.json`                                 | Generated vector corpus (**763** counted)  |
| `docs/scm/g9/coverage-validation.json`                             | Exact-set and `source_exact` gates         |
| `docs/superpowers/plans/2026-10-17-scm-g9-wp7-composition-plan.md` | Bootstrap prerequisite                     |
| `docs/superpowers/specs/2026-09-26-scm-g9-shadow-parity-design.md` | G9 vs G10 purpose; complete parity meaning |

---

_U5 deliverable: definition only. No runtime files. No commits._

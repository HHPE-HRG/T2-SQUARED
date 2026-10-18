# WP1–WP4 foundation cohesion addendum (U1)

<!-- Agent: definition only. Binds the existing foundation plan to WP1–WP4 + ORCH-QUEUE slice. Do not execute Tasks 1–13 here. -->

- Date: 2026-10-17
- Unit: **U1** (G9 Manager charter)
- Authoritative foundation plan (bind; do not rewrite Tasks 1–13): `docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md`
- Governing design: `docs/superpowers/specs/2026-09-26-scm-g9-shadow-parity-design.md`
- Validation snapshot: `docs/scm/g9/coverage-validation.json` (`implementation_authorized: false`, 74=74=74, 763 fixtures)

## 1. Purpose

This addendum **closes definition contracts** between:

- **WP1** — generated row contract and package loader (`integration-readiness.md` §4),
- **WP2** — core shadow runtime (occurrence, FIFO, promotion, retain),
- **WP3** — ten-bus coordinator, governance, `admitShadowPublish`, roster-aware `hearAs`,
- **WP4** — waker, fault controller, closed observation catalog,
- **First vertical slice** — `INV-T2-ORCH-QUEUE` / `queue-offered` (`integration-readiness.md` §5),

and the **already-written** foundation plan Tasks 1–13.

It does **not** replace Task step text, reorder Tasks, or authorize execution. If a future reader finds a **factual** conflict between this addendum’s binding table and the design or machine ledger, record it under [Open contradictions](#open-contradictions) and resolve via RFC — do not silently edit the foundation plan in a definition pass.

**In scope for U1:** mapping, interface index, file-ownership hints, acceptance gate pointers, explicit non-authorization.

**Out of scope for U1:** running Tasks 1–13, creating `apps/server/src/scm/g9*.ts`, creating `docs/scm/g9/authorization.md`, WP5–WP8 definition (other units).

---

## 2. Foundation Task → work package mapping

Legend: **slice** = ORCH-QUEUE vertical proof; **verify** = Task 13 gate bundle only.

| Task | Title (foundation plan)                              | WP1 | WP2 | WP3 | WP4                 | slice | verify |
| ---- | ---------------------------------------------------- | --- | --- | --- | ------------------- | ----- | ------ |
| 1    | Package loader, runtime parameters, G3 bus/node sets | ✓   |     |     |                     |       |        |
| 2    | Generic G8 clock target error                        |     |     |     | ✓ (G8 prerequisite) |       |        |
| 3    | Occurrence freeze and capture result types           |     | ✓   |     |                     |       |        |
| 4    | FIFO, atomic admit, sequence, overload episode flags |     | ✓   |     |                     |       |        |
| 5    | Promotion, retained current, ages                    |     | ✓   |     |                     |       |        |
| 6    | Effectful observation + dying observer               |     |     |     | ✓                   |       |        |
| 7    | Shared G9 fault controller                           |     |     |     | ✓                   |       |        |
| 8    | Coordinator capture, preflight, commit               |     | ✓   | ✓   |                     |       |        |
| 9    | Receiver-aware `hearAs`                              |     |     | ✓   |                     |       |        |
| 10   | Waker                                                |     |     |     | ✓                   |       |        |
| 11   | ORCH-QUEUE helper and live-safe capture service      |     |     |     |                     | ✓     |        |
| 12   | Vertical slice (end-to-end test composition)         |     | ✓   | ✓   | ✓                   | ✓     |        |
| 13   | Focused verification                                 |     |     |     |                     |       | ✓      |

**Dependency reading (critical path, unchanged from design):** WP1 (Task 1) → WP2 (Tasks 3–5) + WP3 (Tasks 8–9, with Task 1) in parallel after WP1 → WP4 (Tasks 2, 6–7, 10; Task 2 unblocks waker clock typing) → slice (Tasks 11–12) → verify (Task 13).

**Cross-WP note:** Task 8 is intentionally **WP2+WP3** because the coordinator owns capture/FIFO side effects and bus-map/`admitShadowPublish`/preflight/commit. Task 12 is the **integration proof** that stitches WP2–WP4 + slice assertions; it is not “complete G9.”

---

## 3. Closed interface contract index (text only)

Names and meanings as **already fixed** in the foundation plan “Shared types” and Task produces/consumes sections. Later implementation must not rename without RFC.

| Name                                                         | One-line meaning                                                                                                                                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `G9Package`                                                  | Init-time load of runtime parameters, ten runtime bus IDs, 29 placed nodes, node→home bus map, 74-row declarations, governed classes, G1B/G3 SHA pins.                                                                                            |
| `loadG9Package`                                              | Repo-root loader; init throws plain `Error` (not `G9InvariantFault`) on package/shape mismatch.                                                                                                                                                   |
| `parseRuntimeParameters`                                     | Validates `docs/scm/g9/runtime-parameters.json`; sole numeric source for FIFO max, wake ms, fundamental timesteps per N.                                                                                                                          |
| `G9RuntimeParameters`                                        | Three positive integers + `schemaVersion: 1`; no TypeScript literals for 64/100/1.                                                                                                                                                                |
| `G9RowDeclaration` / `G9PhaseDeclaration`                    | Ledger-projected row/phase metadata including equality mappings, labels, retain flag, capture site.                                                                                                                                               |
| `G9Occurrence`                                               | Immutable enqueued shadow unit. **Tasks 1–13:** ORCH-QUEUE slice. **Task 14 (RFC-017):** ledger-projected for all 184 phases (`comm_id`, `phase_id`, `equality_A`, labels, retain).                                                               |
| `freezeOccurrence`                                           | Deep-freezes occurrence and `equality_A` at enqueue boundary.                                                                                                                                                                                     |
| `G9CaptureOccurrenceInput`                                   | Closed union. **Slice (Tasks 1–13):** one member `INV-T2-ORCH-QUEUE` / `queue-offered`. **Task 14 (RFC-017):** full widen — input + occurrence + `toW1` — set-equal to ledger 184 phases before WP5/WP6/WP8 non-slice capture.                    |
| `G9OrchQueueEqualityA`                                       | Public equality `A` for ORCH-QUEUE: `{ command_type: "client" \| "internal" }` only; no command body.                                                                                                                                             |
| `G9CaptureResult`                                            | Expected outcomes only: `enqueued` \| `rejected-capacity` \| `rejected-bus-withheld`; never mute/invalid/fault variants.                                                                                                                          |
| `G9InvariantFault`                                           | Unexpected invariant break with finite `G9FaultCode`; not a capture result.                                                                                                                                                                       |
| `G9FaultCode`                                                | Closed set: placement, reserved-identity, authority-parent, w1-invalid, preflight, clock-overlap, sequence-overflow, **capture-defect**, **waker-defect** (RFC-018).                                                                              |
| `G9NodeFifos` / `admit`                                      | Single atomic allocate-sequence-then-admit-or-reject; overload episode flags on capacity path only.                                                                                                                                               |
| `G9OverloadEvent`                                            | `none` \| `overload-start` \| `overload-recovered` with reason `"capacity"` only.                                                                                                                                                                 |
| `selectPromotion` / `toW1` / `NodeShadowState`               | One candidate per live node per timestep; FIFO beats retained repeat; W1 via `nextAges` + `checkW1Word`.                                                                                                                                          |
| `G9RosterCoordinator`                                        | Ten `InProcessOpenLoopBus` instances; `captureOccurrence`; snapshot preflight → commit; implements `FundamentalTimestepTarget<G9InvariantFault>`.                                                                                                 |
| `admitShadowPublish`                                         | Ordered placement checks (bus, node, G3 bind, placed, non-404, non-parent, W1 valid) before any G6 `admitPublish`.                                                                                                                                |
| `preflightShadowPublish` / `commitShadowPublish`             | All-or-nothing preflight (no G7 mutation); commit `yield*`s `observePublish` + `admitPublish`, advances live buses only, dequeues FIFO heads for promoted-from-FIFO nodes.                                                                        |
| `hearAs`                                                     | Roster-aware same-bus wrapper: receiving node **and** bus must match G3 home binding, then G6 `hearObserved`.                                                                                                                                     |
| `G9HearInput`                                                | `{ receiving_node_id, receiving_bus_id, origin_node_id }` — no cross-bus search.                                                                                                                                                                  |
| `G9Observation`                                              | Closed-catalog Effectful emitters (overload, fault metadata, wake skipped, FIFO depth gauge, rejection counters). Fault span: exact five-key allowlist; `fault_code` + `waker_state` always; identity attrs omitted when no occurrence (RFC-020). |
| `sandboxObserve`                                             | Observation failures cannot roll back protocol state.                                                                                                                                                                                             |
| `G9FaultController`                                          | First-fault latch: disarm waker, fault observation, `G9FaultSink.deliver`; never `setBusPosition`.                                                                                                                                                |
| `G9FaultSink`                                                | Supervisor delivery hook: `Effect<void, never>` per fault.                                                                                                                                                                                        |
| `G9WakerState`                                               | `stopped` \| `armed-idle` \| `armed-in-flight` \| `faulted`.                                                                                                                                                                                      |
| `G9Waker`                                                    | Skip-if-busy on overlapping **waker** ticks; uses `SharedFundamentalClock<G9InvariantFault>`; no wall sleep in tests; `tick` isolates defects as `waker-defect` (RFC-018).                                                                        |
| `FundamentalTimestepTarget<E>` / `SharedFundamentalClock<E>` | G8 clock generic error channel (Task 2); default `E = HomeBusLinkFailure` preserves existing G8 tests.                                                                                                                                            |
| `G9CaptureService` / `G9CaptureServiceShape`                 | Optional `Context.Service` `"t3/scm/G9CaptureService"`; `captureOccurrence` error channel **`never`**.                                                                                                                                            |
| `G9LiveSafeCaptureLayer`                                     | Isolates capture Fail/Die via `Effect.exit`; code **`capture-defect`** for defects; latch/sink sandboxed; package-row fault context only (no 404/authority sentinels); interrupt ≠ latch (RFC-018). Error channel `never`.                        |
| `G9Waker.tick`                                               | Isolates link/clock Fail and Die at tick; code **`waker-defect`** for defects; state → `faulted`; sink delivery; never stuck `armed-in-flight` (RFC-018).                                                                                         |
| `captureIfOfferAccepted` / `commandTypeOf`                   | Post-offer capture only when `accepted === true`; `Schema.is(DispatchableClientOrchestrationCommand)` → `"client"`, else `"internal"`.                                                                                                            |
| `DispatchableClientOrchestrationCommand`                     | Exported schema for offer-time classification (not pre-normalization `ClientOrchestrationCommand`).                                                                                                                                               |
| `GovernedClasses`                                            | G6 type from runtime maps only (ten buses, 29 placed nodes); authority parent string id, not a map entry.                                                                                                                                         |
| `DipMuteStore`                                               | Empty initial DIP at coordinator construct; G9 must not call `setBusPosition` on fault paths.                                                                                                                                                     |
| `BridgeAdvanceResult`                                        | Coordinator timestep returns empty deliveries/failures (no G6 home-bus-link routing in G9 coordinator).                                                                                                                                           |

---

## 4. File ownership for later implementation (serial hotspots)

When `implementation_authorized` becomes true in a **future** human-authorized session, the foundation plan implies **single owners** per hotspot (no concurrent edits across workers):

| Hotspot                                                                           | Owner scope (foundation plan File Map)                               | WP                 |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------ |
| `docs/scm/g9/runtime-parameters.json`                                             | Human/ledger steward; TypeScript only re-exports validated fields    | WP1                |
| Generated G9 JSON (`coverage-ledger.json`, `governed-classes.json`, fixtures)     | Generator `docs/scm/g9/regen_coverage_ledger.py` only; no hand edits | WP1 / WP8 boundary |
| `apps/server/src/scm/g9Package.ts` (+ test)                                       | Task 1 owner                                                         | WP1                |
| `apps/server/src/scm/g8SharedClock.ts` (+ test)                                   | Task 2 owner (G8 generic; blocks WP4 waker)                          | WP4                |
| `apps/server/src/scm/g9Occurrence.ts`, `g9Fifo.ts`, `g9Promotion.ts` (+ tests)    | Tasks 3–5 owner (may be one implementer serially)                    | WP2                |
| `apps/server/src/scm/g9Observation.ts` (+ test)                                   | Task 6 owner                                                         | WP4                |
| `apps/server/src/scm/g9Fault.ts` (+ test)                                         | Task 7 owner                                                         | WP4                |
| `apps/server/src/scm/g9Coordinator.ts` (+ test)                                   | Task 8 owner                                                         | WP2+WP3            |
| `apps/server/src/scm/g9HearAs.ts` (+ test)                                        | Task 9 owner                                                         | WP3                |
| `apps/server/src/scm/g9Waker.ts` (+ test)                                         | Task 10 owner                                                        | WP4                |
| `apps/server/src/scm/g9OrchQueueCapture.ts` (+ test)                              | Task 11 owner                                                        | slice              |
| `apps/server/src/orchestration/Layers/OrchestrationEngine.ts` (capture hook only) | Task 11 owner — minimal `serviceOption` after `Queue.offer`          | slice              |
| `apps/server/src/scm/g9VerticalSlice.test.ts`                                     | Task 12 owner                                                        | slice              |
| Task 13 verification runner                                                       | Whoever fixes failing Task 1–12 artifact; no new feature scope       | verify             |

**Parallel-safe (after contracts frozen):** isolated unit tests that do not share the hotspots above; no second worker on `OrchestrationEngine` or G8 clock during foundation execution.

**Explicitly not foundation-owned:** `patches/effect@4.0.0-beta.103.patch`, `server.ts` G9 Layer, WP5 family modules, 763-fixture runner (WP8).

---

## 5. Acceptance gates (already specified by foundation plan — pointers)

U1 treats these as **closed** for WP1–WP4 + slice; detailed steps live in the cited Task sections.

### WP1 (Task 1 + Task 13 partial)

- Init load: `\|runtimeBusIds\| === 10`, `\|placedNodeIds\| === 29`, G1B/G3/G9 `comm_id` set equality (74), ledger SHA pins, ORCH-QUEUE row projection fields from ledger.
- Invalid runtime-parameters classes fail at parse (not `G9InvariantFault`).
- Pointer: foundation plan Task 1 validation bullets; `g9Package.test.ts` happy/invalid paths.

### WP2 (Tasks 3–5, 8 capture/FIFO side, Task 12)

- Frozen occurrences; capture result union only three statuses; sequence 0-based, advances on enqueue + both rejects; atomic `admit`; capacity from JSON not literals.
- Promotion law: FIFO head over retained repeat; retain flags; failed preflight does not advance ages.
- Coordinator: withheld spelling `rejected-bus-withheld`; no overload episode on withheld; all-or-nothing preflight failure leaves FIFO/timestep unchanged.
- Pointer: Tasks 3–5, 8 Step 1 tests; Global Constraints (FIFO, sequence, capture outcomes).

### WP3 (Tasks 8–9, Task 12)

- Ten coordinator buses, no authority bus key; `admitShadowPublish` order; preflight rejects 404/parent without `admitPublish`.
- `hearAs`: bound node+bus hears; unbound/404/cross-bus undefined; G6 mute behavior via `hearObserved`.
- Pointer: Task 8–9 Step 1 tests; design “Topology” and “admitShadowPublish” sections.

### WP4 (Tasks 2, 6–7, 10, Task 12)

- G8 clock exposes generic `E` without wrapping G9 faults as `HomeBusLinkFailure`.
- Observation: catalog-exact names/attrs; dying observer does not rollback FIFO.
- Fault: first-fault latch, no `setBusPosition`, waker disarm + faulted state.
- Waker: four states, skip-if-busy, `clock-overlap` only for overlapping advance while `advancing`, no catch-up, `n` from JSON.
- Pointer: Tasks 2, 6–7, 10 Step 1 tests; design “Waker”, “Faults”, “Observation”.

### Slice (Tasks 11–12 + `integration-readiness.md` §5)

- Live `Queue.offer` / unbounded production queue unchanged; optional capture after offer; dispatch error channel never sees `G9InvariantFault`.
- One accepted offer → one occurrence in `node.orchestration` FIFO; one timestep → one W1 on `bus.control`; T+1 same-bus `hearAs`; equality `A` finite tag only; `accepted === false` → no capture (test via `Queue.dropping(1)`).
- Pointer: Task 11–12; foundation plan Global Constraints slice bullets; integration-readiness §5 numbered list.

### Verify (Task 13)

- **Mode A (unauthorized hygiene):** `! -e authorization.md` + regen expects `implementation_authorized: false` + empty Effect patch — does not authorize Tasks 1–12.
- **Mode B (authorized):** `authorization.md` present + regen expects `true` + enumerated `vp test run` list for all G9 foundation tests + G3–G8 regressions + `OrchestrationEngine.test.ts` + `vp run --filter t3 typecheck`.
- Pointer: foundation plan Task 13 (RFC-021 dual-mode) and expected outcomes.

### Package validation (frozen snapshot)

- `docs/scm/g9/coverage-validation.json`: `design_approved`, `writing_plans_authorized` true; `implementation_authorized` false; `top_level_set_equality` true; 763 counted fixtures; dormant `INV-T2-SCM-HOME-BUS-LINK`.

---

## 6. Authorization block (explicit)

```yaml
implementation_authorized: false
```

- **Do not execute** foundation plan Tasks 1–14 (authorized Mode B) in this definition pass or any U1 worker session.
- **Do not create** `docs/scm/g9/authorization.md` in this definition pass.
- **Do not flip** `g9toG10Authorized`. Future humans authorize runtime by creating `authorization.md` then regenerating (RFC-021); do not hand-edit generated JSON.
- **Do not begin** implementation on an unpinned dirty tree; foundation plan “Execution precondition” remains in force for future implementers.

Design approval (`docs/scm/g9/design-approval.md`) authorizes **planning** and this cohesion binding only; it does not authorize WP5–WP8 runtime or production G9 Layer wiring.

---

## 7. Non-goals (foundation plan scope boundary)

The foundation plan and this addendum **exclude**:

| Non-goal                                    | Rationale                                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WP5–WP8 runtime                             | Family bundles, Effect/MCP/OTLP hooks, bootstrap composition, 763-fixture exact-set proof — separate definition units (U2–U5) and later authorization. |
| Effect patch edits                          | `patches/effect@4.0.0-beta.103.patch` diff must stay empty at Task 13.                                                                                 |
| `server.ts` G9 Layer / production timer     | Test-only Layer composition in Task 12 optional path; no production activation.                                                                        |
| 763-fixture runner / complete G9 claim      | Vertical slice is architecture proof only (`integration-readiness.md` §5).                                                                             |
| Empty WP5 family stub files                 | Foundation plan File Map forbids.                                                                                                                      |
| Codec, G10, eleventh bus, payload retention | Charter cohesion checks; unchanged.                                                                                                                    |
| `rejected-muted` / capture fault variants   | Global Constraints; design DIP mute is hear-only at G6.                                                                                                |

---

## Open contradictions

| ID  | Topic                                          | Foundation plan / cohesion                                                 | Design or ledger                                                                                     | Status                                                                                                                                   |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Canonical runtime module naming                | Modular `g9Package.ts`, `g9Coordinator.ts`, … per File Map                 | Design header mentions canonical runtime `apps/server/src/scm/g9ShadowParity.ts` plus `docs/scm/g9/` | **Closed — RFC-001 B** — File Map is implementation split; `g9ShadowParity.ts` thin re-export / compose (not a second coordinator body). |
| C2  | Execution precondition vs design approval date | Plan requires committed/pinned artifacts + isolated worktree before Task 1 | Design approved 2026-09-30; tree may be dirty at planning time                                       | **Open for implementer only** — not a law conflict; U1 does not execute.                                                                 |

No other factual contradiction found between Tasks 1–13 step text and `coverage-validation.json` / steward-closed design sections skimmed for U1.

---

## Authoritative cross-links

| Document                                                                 | Role in U1                             |
| ------------------------------------------------------------------------ | -------------------------------------- |
| `docs/scm/g9/manager-charter.md`                                         | Process; U1 unit definition            |
| `docs/scm/g9/planning-scope.md`                                          | WP1–WP8 docs scope; runtime false      |
| `docs/scm/g9/integration-readiness.md`                                   | WP table, slice acceptance, hotspots   |
| `docs/scm/g9/design-approval.md`                                         | First plan scope WP1–WP4 + slice       |
| `docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md` | Tasks 1–13 source of truth for steps   |
| `docs/scm/g9/coverage-validation.json`                                   | Machine gates for 74/184/763 and flags |

---

_U1 deliverable complete. No runtime files created. No commits._

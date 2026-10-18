# G9 cross-WP cohesion index (U6)

<!-- Agent: definition only. Consolidates WP1–WP8 closed definition artifacts. No runtime. No authorization.md. -->

- Date: 2026-10-17
- Unit: **U6** (G9 Manager charter)
- Inputs (closed): U1–U5 definition deliverables + `docs/scm/g9/rfc-queue.md`
- Machine gates: `docs/scm/g9/coverage-validation.json`
- Process: `docs/scm/g9/manager-charter.md`

## Authorization (entire definition package)

```yaml
implementation_authorized: false
writing_plans_authorized: true
g9toG10Authorized: false # charter; do not flip in definition passes
```

- Do **not** create `docs/scm/g9/authorization.md`.
- Do **not** execute foundation Tasks 1–13, family modules, patch edits, `server.ts` joins, or fixture runner implementation in this definition package.
- Design approval authorizes **planning and cohesion binding only** (`docs/scm/g9/design-approval.md`).

---

## 1. Interface index (shared types and services)

Text-only contract names **must not rename without RFC**. **Owner** = work package that **defines or implements** the symbol; **Consumers** = packages that **call, compose, or verify** it (not exhaustive file lists).

### WP1 — package load and ledger projection

| Name                                      | Owner                  | Consumers (text)                                                            |
| ----------------------------------------- | ---------------------- | --------------------------------------------------------------------------- |
| `G9Package`                               | WP1                    | WP2–WP4 coordinator construction; WP7 bootstrap load; WP8 init/digest gates |
| `loadG9Package`                           | WP1                    | WP7 bootstrap; WP8 fixture runner init path                                 |
| `parseRuntimeParameters`                  | WP1                    | WP1 tests; WP2 FIFO capacity; WP4 waker `n`                                 |
| `G9RuntimeParameters`                     | WP1                    | WP2 `G9NodeFifos`; WP4 `G9Waker`                                            |
| `G9RowDeclaration` / `G9PhaseDeclaration` | WP1                    | WP3 coordinator validation; WP5 family routing; WP8 vector→ledger resolve   |
| `GovernedClasses`                         | WP1 (via runtime maps) | WP3 `admitShadowPublish`, `hearAs`                                          |

### WP2 — core shadow runtime

| Name                                           | Owner           | Consumers (text)                                                    |
| ---------------------------------------------- | --------------- | ------------------------------------------------------------------- |
| `G9Occurrence`                                 | WP2             | WP2 promotion/FIFO; WP3 commit dequeue; WP8 assertions              |
| `freezeOccurrence`                             | WP2             | WP2 coordinator enqueue path                                        |
| `G9CaptureOccurrenceInput`                     | WP2             | WP5 all families; WP6 hooks; slice `captureIfOfferAccepted`         |
| `G9OrchQueueEqualityA`                         | WP2 (slice row) | WP5 B1 ORCH-QUEUE helper; foundation Task 11–12                     |
| `G9CaptureResult`                              | WP2             | WP5/WP6 live boundaries; WP8 capture-result vectors                 |
| `G9InvariantFault`                             | WP2             | WP4 fault controller; WP6 hook escalation; WP7 supervisor path      |
| `G9FaultCode`                                  | WP2             | WP4 observation metadata; WP8 fault-stop proofs                     |
| `G9NodeFifos` / `admit`                        | WP2             | WP2–WP3 coordinator; WP8 FIFO/overload vectors                      |
| `G9OverloadEvent`                              | WP2             | WP4 observation catalog                                             |
| `selectPromotion` / `toW1` / `NodeShadowState` | WP2             | WP2–WP3 coordinator commit; WP8 W1/hear fixtures                    |
| `G9RosterCoordinator`                          | WP2+WP3         | WP4 waker target; WP7 bootstrap; WP8 property + integration drivers |
| `BridgeAdvanceResult`                          | WP2+WP3         | WP3 coordinator timestep (empty G6 link routing)                    |

### WP3 — buses, governance, hear

| Name                                             | Owner                       | Consumers (text)                                                 |
| ------------------------------------------------ | --------------------------- | ---------------------------------------------------------------- |
| `admitShadowPublish`                             | WP3                         | WP3 preflight/commit; WP8 governance vectors                     |
| `preflightShadowPublish` / `commitShadowPublish` | WP3                         | WP3 coordinator; WP8 same-bus hear timing                        |
| `hearAs`                                         | WP3                         | WP3 tests; WP8 hear fixtures; foundation slice T+1               |
| `G9HearInput`                                    | WP3                         | WP3 `hearAs` callers                                             |
| `DipMuteStore`                                   | WP3 (G6 type, G9 usage law) | WP3 coordinator construct; WP4 fault paths (no `setBusPosition`) |

### WP4 — waker, fault, observation, G8 clock generic

| Name                                                         | Owner               | Consumers (text)                                                                              |
| ------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------- |
| `G9Observation`                                              | WP4                 | WP4 catalog emitters; WP7 bootstrap (sandboxed)                                               |
| `sandboxObserve`                                             | WP4                 | WP4 coordinator side effects; WP7 composition law                                             |
| `G9FaultController`                                          | WP4                 | WP4 waker disarm; WP6 live-safe latch; WP7 bootstrap                                          |
| `G9FaultSink`                                                | WP4                 | WP7 supervisor wiring; WP8 fault-stop                                                         |
| `G9WakerState` / `G9Waker`                                   | WP4                 | WP7 bootstrap; WP8 waker/clock proofs                                                         |
| `FundamentalTimestepTarget<E>` / `SharedFundamentalClock<E>` | WP4 (G8 Task 2)     | WP4 waker; WP7 G9-dedicated clock (not home-bus-link)                                         |
| `G9CaptureService` / `G9CaptureServiceShape`                 | WP4 (slice Task 11) | WP5 families; WP6 hooks; WP7 `G9LiveSafeCaptureLayer` provider; orchestration `serviceOption` |
| `G9LiveSafeCaptureLayer`                                     | WP4                 | WP6 hook bridge; WP7 sole production capture provider                                         |
| `captureIfOfferAccepted` / `commandTypeOf`                   | WP4 (slice)         | WP5 B1 orchestration surfaces                                                                 |
| `DispatchableClientOrchestrationCommand`                     | WP4 (slice)         | `commandTypeOf` classification at offer boundary                                              |

### WP5 — family capture (callers only)

| Name                                         | Owner                 | Consumers (text)                                            |
| -------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| `captureOccurrence` (coordinator method)     | WP2+WP3 (via service) | WP5 six `g9Family*.ts` modules; WP6 `g9FamilyTypedHooks.ts` |
| `g9FamilyQueuePubSubCallback`                | WP5 B1                | WP7 context (`G9CaptureService`); WP8 B1 shard drivers      |
| `g9FamilyFileDbProcessConfig`                | WP5 B2                | WP7; WP8 B2 shard; B4/B5 integrator handoffs                |
| `g9FamilySubprocessExternalTransport`        | WP5 B3                | WP7; WP8 B3 shard                                           |
| `g9FamilyProviderProtocol`                   | WP5 B4                | WP7; WP8 B4 shard; sole `provider/**` committer             |
| `g9FamilyTerminalLocalStreams`               | WP5 B5                | WP7; WP8 B5 shard; sole `Manager.ts` committer              |
| `g9FamilyHomeBusLinkFixtures`                | WP5 B6                | WP8 dormant-row fixtures only (no production wiring)        |
| `G9DeferredEquality<A>` (ledger projections) | WP1 ledger + WP5 law  | WP5 family `input` shapes; WP8 equality assertions          |

### WP6 — typed hooks (optional services)

| Name                                                          | Owner                                      | Consumers (text)                                                                |
| ------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| `RpcServerRequestHooks` (proposed `Context.Service`)          | WP6                                        | WP6 `ws.ts` consumer; WP6 patch; WP7 hook layer merge exports                   |
| `g9FamilyTypedHooks.ts`                                       | WP6                                        | WP7 bootstrap bridge; WP8 hook-dependent vectors                                |
| `G9RpcAdmitA` / `G9RpcUnarySuccessA` / `G9RpcStreamElementA`  | **WP6** sole capture (RFC-002/012 applied) | `RpcServerRequestHooks` → `g9FamilyTypedHooks` → `captureOccurrence` on `ws.ts` |
| `G9McpDeleteA`                                                | WP6 (ledger)                               | MCP DELETE 204 post-success hook                                                |
| `G9T2OtlpA` / `G9T3OtlpTracesA` / `G9T3OtlpMetricsA`          | WP6 (ledger)                               | T2/T3 OTLP export success hooks                                                 |
| Effect patch hook seams (`RpcServer`, MCP `layerHttp` DELETE) | WP6 **`WP6-Effect-Patch-Owner`**           | WP6 consumers; WP7 merges after patch lands                                     |

### WP7 — bootstrap composition

| Name                                                               | Owner                                                               | Consumers (text)                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `G9ShadowStackLayer` (proposed)                                    | WP7                                                                 | WP7 `server.ts` gated merge; WP8 full-stack drivers                   |
| `g9ShadowParity.ts` (public re-export; RFC-001 **B**)              | WP7 **`WP7-Bootstrap-Owner`** composes; modules stay File Map split | WP7 `server.ts`; WP8 may reuse layer factory                          |
| `g9Bootstrap.ts` (optional internal compose helper under File Map) | WP7 **`WP7-Bootstrap-Owner`**                                       | Re-exported through `g9ShadowParity.ts`                               |
| Hook layer merge exports (from bootstrap)                          | WP7                                                                 | WP6 consumer files (`ws.ts`, `McpHttpServer.ts`, T2/T3 observability) |

### WP8 — exact-set proof harness

| Name                                        | Owner | Consumers (text)                                                         |
| ------------------------------------------- | ----- | ------------------------------------------------------------------------ |
| `G9FixtureRunner` (proposed)                | WP8   | WP8 CI; reads `fixture-vectors.json`; drives WP5/WP6/coordinator helpers |
| Fixture manifest (executed/failed/unmapped) | WP8   | WP8 close gate: zero unmapped counted vectors                            |

### Cross-WP services (external to G9 core, consumed at boundaries)

| Name                                   | Owner              | G9 consumers                                |
| -------------------------------------- | ------------------ | ------------------------------------------- |
| `InProcessOpenLoopBus`                 | G5/G3 runtime      | WP3 coordinator (ten instances)             |
| G6 `admitPublish` / `hearObserved`     | G6                 | WP3 shadow publish/hear                     |
| `"t3/scm/G9CaptureService"` tag        | WP4                | WP5/WP6 optional resolution                 |
| `Queue.offer` / orchestration dispatch | Live orchestration | WP4 slice only (`OrchestrationEngine` hook) |

---

## 2. File-owner index (serial hotspots)

**Single owner role** per hotspot at implementation time. Other WPs may prepare diffs in **non-hotspot** files or deliver **handoff patches** per WP5 integrator rules.

| Hotspot                                                                                                         | Sole owner role                        | WP / bundle                             | Notes                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `docs/scm/g9/runtime-parameters.json`                                                                           | **WP1-Ledger-Steward** (human/ledger)  | WP1                                     | TS validates via `parseRuntimeParameters` only                                                                                      |
| `docs/scm/g9/regen_coverage_ledger.py`                                                                          | **G9-Generator-Owner**                 | WP1 / WP8 boundary                      | Sole mutator of generated JSON + Task 14 `g9EqualityA.generated.ts` / `g9CaptureInput.generated.ts`                                 |
| `docs/scm/g9/coverage-ledger.json`, `governed-classes.json`, `fixture-vectors.json`, `coverage-validation.json` | **G9-Generator-Owner**                 | WP1 load / WP8 proof                    | No hand edits                                                                                                                       |
| `patches/effect@4.0.0-beta.103.patch`                                                                           | **`WP6-Effect-Patch-Owner`**           | WP6                                     | One open patch session; WP7 merges hooks after patch                                                                                |
| `apps/server/src/server.ts` (G9 bootstrap merge)                                                                | **`WP7-Bootstrap-Owner`**              | WP7                                     | WP6 explicitly not `server.ts`                                                                                                      |
| `apps/server/src/scm/g9Bootstrap.ts` (proposed)                                                                 | **`WP7-Bootstrap-Owner`**              | WP7                                     | Composition only; does not re-own WP2–WP4 modules                                                                                   |
| `apps/server/src/scm/g9ShadowParity.ts` (proposed re-export)                                                    | **`WP7-Bootstrap-Owner`**              | WP7                                     | RFC-001 **B** thin re-export; not a second coordinator body                                                                         |
| `apps/server/src/scm/g9Package.ts`                                                                              | **WP1-Foundation-Owner**               | WP1                                     | Task 1; Task 14 lookup helpers (WP2 consumes; no dual commit)                                                                       |
| `apps/server/src/scm/g8SharedClock.ts`                                                                          | **WP4-G8-Clock-Owner**                 | WP4                                     | Task 2; blocks waker typing                                                                                                         |
| `apps/server/src/scm/g9Occurrence.ts`, `g9Fifo.ts`, `g9Promotion.ts`                                            | **WP2-Foundation-Owner**               | WP2                                     | Tasks 3–5; **Task 14** full widen of occurrence/`toW1` (RFC-017)                                                                    |
| `apps/server/src/scm/g9Coordinator.ts`                                                                          | **WP2+WP3-Foundation-Owner**           | WP2+WP3                                 | Task 8; Task 14 package-backed validation + non-enqueue for declaration-absence; dormant-prototype fixture enqueue OK (RFC-019/020) |
| `apps/server/src/scm/g9HearAs.ts`                                                                               | **WP3-Foundation-Owner**               | WP3                                     | Task 9                                                                                                                              |
| `apps/server/src/scm/g9Observation.ts`                                                                          | **WP4-Foundation-Owner**               | WP4                                     | Task 6                                                                                                                              |
| `apps/server/src/scm/g9Fault.ts`                                                                                | **WP4-Foundation-Owner**               | WP4                                     | Task 7                                                                                                                              |
| `apps/server/src/scm/g9Waker.ts`                                                                                | **WP4-Foundation-Owner**               | WP4                                     | Task 10                                                                                                                             |
| `apps/server/src/scm/g9OrchQueueCapture.ts`                                                                     | **Slice-Foundation-Owner**             | WP1–WP4 slice                           | Task 11                                                                                                                             |
| `apps/server/src/orchestration/Layers/OrchestrationEngine.ts` (capture hook only)                               | **Slice-Foundation-Owner**             | slice                                   | Minimal `serviceOption` after offer                                                                                                 |
| `apps/server/src/scm/g9VerticalSlice.test.ts`                                                                   | **Slice-Foundation-Owner**             | slice                                   | Task 12                                                                                                                             |
| `apps/server/src/terminal/Manager.ts` (WP5 capture edits)                                                       | **WP5-B5-Integrator**                  | WP5 B5                                  | B2 handoff → B5 merge → B5 TERM                                                                                                     |
| `apps/server/src/provider/**` (WP5 capture edits)                                                               | **WP5-B4-Integrator**                  | WP5 B4                                  | B2 handoff → B4 merge → B4 protocol rows                                                                                            |
| `apps/server/src/ws.ts` (all G9 capture/hook landings)                                                          | **WP6-Consumer-Owner** (RFC-014 **A**) | WP6 sole lander                         | B1 `INV-T2-ORCH-LIVE` handoff; RpcServer `planned_typed_hooks` (RFC-002 applied)                                                    |
| `apps/server/src/mcp/McpHttpServer.ts` (all G9 capture/hook landings)                                           | **WP6-Consumer-Owner** (RFC-014 **A**) | WP6 sole lander                         | B4 MCP non-hook phases hand off; WP6 owns `mcp-http-session-deleted`                                                                |
| `apps/server/src/t2Observability/T2Observability.ts` (all G9 capture/hook landings)                             | **WP6-Consumer-Owner** (RFC-005 **A**) | WP6 sole lander; B2/B5 hand off patches | Full row `INV-T2-TEL-T2-OTLP`; B2/B5 NDJSON/flag phases via handoff                                                                 |
| `apps/server/src/observability/Layers/Observability.ts` (all G9 capture/hook landings)                          | **WP6-Consumer-Owner** (RFC-014 **A**) | WP6 sole lander                         | Full row `INV-T2-TEL-T3-OTLP`; B5 `INV-T2-TEL-T3-TRACE` via handoff                                                                 |
| `apps/server/src/serverSettings.ts` (WP5 capture edits)                                                         | **WP5-B1-Owner** (RFC-014 **A**)       | WP5 B1                                  | B2 `INV-T2-FILE-SETTINGS` handoff                                                                                                   |
| `apps/server/src/vcs/VcsDriver.ts` (WP5 capture edits)                                                          | **WP5-B3-Owner** (RFC-014 **A**)       | WP5 B3                                  | B2 `INV-T2-FILE-CHECKPOINTS` handoff                                                                                                |
| `packages/shared/src/relayClient.ts` (WP5 capture edits)                                                        | **WP5-B3-Owner** (RFC-014 **A**)       | WP5 B3                                  | B2 `INV-T2-FLAG-CLOUDFLARED` handoff                                                                                                |
| `apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts` (WP5 capture edits)                             | **WP5-B5-Owner** (RFC-014 **A**)       | WP5 B5                                  | B3 `INV-T2-TEL-DESKTOP-CONTROL` handoff                                                                                             |
| `apps/server/src/scm/g9FamilyTypedHooks.ts`                                                                     | **WP6-Hook-Family-Owner**              | WP6                                     | Maps patch callbacks → capture                                                                                                      |
| `apps/server/src/scm/g9Family*.ts` (six modules)                                                                | **WP5-B1…B6-Owner** per bundle plan    | WP5                                     | Capture callers only                                                                                                                |
| `apps/server/src/scm/g9FixtureRunner*` (proposed)                                                               | **WP8-Fixture-Owner**                  | WP8                                     | 763-vector marathon                                                                                                                 |
| `apps/server/src/scm/g6HomeBusLink.ts`                                                                          | **G6-Owner**                           | —                                       | **Not** instantiated by WP7 bootstrap or B6 production                                                                              |

**Explicitly not G9-owned hotspots:** empty WP5 family stubs (forbidden); concurrent second worker on G8 clock or `OrchestrationEngine` during foundation execution (U1).

---

## 3. Forbidden overlaps

Two open implementation streams **must not** commit concurrently to the same hotspot row in §2. Additional **semantic** overlaps forbidden across WPs:

| Overlap                              | Forbidden behavior                                                              | Authoritative rule                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Effect patch                         | WP5 B4 or WP7 editing `patches/effect@*.patch`                                  | WP6 serial owner only                                                                                 |
| Bootstrap                            | WP5/WP6 editing `server.ts` G9 merge                                            | WP7 **`WP7-Bootstrap-Owner`** only                                                                    |
| `Manager.ts`                         | B2/B4 direct commits; parallel B5+B2 edits                                      | B2 patch handoff; **B5** sole commit stream                                                           |
| `provider/**`                        | B1/B3/B5 commits; B2 direct commits                                             | **B4** sole commit stream; B2 handoff                                                                 |
| FIFO / waker / bus map               | WP5/WP6 owning enqueue, promotion, or observation catalog edits                 | Families/hooks → `captureOccurrence` only                                                             |
| RpcServer hook phases                | WP5 B4 capturing admit/unary/stream                                             | WP6 sole `planned_typed_hooks` owner (RFC-002 applied)                                                |
| MCP session delete                   | WP5 capturing `mcp-http-session-deleted`                                        | WP6 `planned_typed_hooks` only                                                                        |
| OTLP post-success rows               | WP5 B3/B5 on `INV-T2-TEL-*-OTLP` comm_ids                                       | WP6 full-row ownership (3 phases)                                                                     |
| Generator JSON                       | Any bundle hand-editing ledger/fixtures/validation                              | **`G9-Generator-Owner`** script only                                                                  |
| Home-bus-link fabric                 | WP7 bootstrap or WP5 production wiring for dormant row                          | B6 fixtures + WP8 test-only                                                                           |
| Coordinator entry                    | Second monolith coordinator body (RFC-001 **C**)                                | Modular File Map + `g9ShadowParity.ts` re-export (RFC-001 **B**)                                      |
| Capture widen                        | WP5/WP6/WP8 inventing unions or editing core `g9*.ts` before Task 14            | Foundation **Task 14** sole **full** widen — input + occurrence + `toW1` (RFC-017); WP5+ bind after   |
| Live-safe defects                    | Typed-only match / uncaught waker Die / preflight mislabel / reserved sentinels | RFC-018: `capture-defect` + `waker-defect`; tick isolation; sandboxed latch; package-row context only |
| G10 / codec                          | Live replacement or lossless codec claims                                       | Design + charter cohesion checks                                                                      |
| Authorization flags                  | Workers flipping `implementation_authorized` or `g9toG10Authorized`             | Human + `authorization.md` only                                                                       |
| Payload retention                    | Command bodies, stream bytes, OTLP/MCP bodies in `A` or observations            | All WPs                                                                                               |
| Eleventh bus / comm_id-keyed bus map | Extra production bus or map shape                                               | WP3/WP7 topology law                                                                                  |

---

## 4. Exact-set, dormant, and authorization invariants

These must remain **true** across all closed definition units unless a steward RFC + ledger regen explicitly changes them.

### Exact set (74 / 184 / 763)

| Invariant                   | Source                         | Requirement                                                                                                                                                                                          |
| --------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1B = G3 = G9               | `coverage-validation.json`     | **74** unique `comm_id`s; `top_level_set_equality: true`                                                                                                                                             |
| Phase count                 | Ledger                         | **184** phases across counted rows                                                                                                                                                                   |
| `closed_count` vs exact set | Ledger header                  | **`closed_count: 73`** = non-dormant closed rows; **`dormant_count: 1`** may still carry `coverage_counted_closed: true` so exact-set size remains **74**. Do not treat 73 as missing a counted row. |
| Counted fixtures            | `counted_fixture_vector_count` | **763** vectors (authoritative over stale prose; was 790 before Bitbucket extract fix)                                                                                                               |
| `source_exact`              | validation JSON                | `true`; `counted_unresolved_phase_count`: 0; `still_structural_count`: 0                                                                                                                             |
| `unresolved`                | validation JSON                | `[]`                                                                                                                                                                                                 |
| Steward closure             | validation JSON                | `shape-valid`, `source_checked_subset`, `steward-closed`                                                                                                                                             |
| Regen                       | `regen_coverage_ledger.py`     | No hand edits to generated artifacts; regen produces no unexpected diff                                                                                                                              |
| Init loader                 | WP1 `loadG9Package`            | Throws plain `Error` on G1B/G3/G9 mismatch or SHA pin failure                                                                                                                                        |
| WP5 partition               | WP5 plan                       | 64 WP5 bundle rows + 10 WP6 full-row deferrals (8 RpcServer + 2 OTLP) = 74; plus B4 partial MCP phase deferral                                                                                       |
| WP8 close                   | WP8 plan                       | **763/763** executed; zero silent skip; 74 rows ≥1 vector each                                                                                                                                       |

### Dormant row

| Invariant                  | Requirement                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `INV-T2-SCM-HOME-BUS-LINK` | Status **`dormant-prototype`** in validation; not production fabric                                |
| Production bootstrap       | **No** `BidirectionalHomeBusLink` as roster fabric or clock target (WP7)                           |
| Occurrences                | **Zero** from production server paths; B6 **`g9FamilyHomeBusLinkFixtures`** + WP8 test wiring only |
| Live forward re-bridge     | **Forbidden** for occurrence creation                                                              |

### Authorization and gates (definition vs runtime)

| Invariant                   | Requirement                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `implementation_authorized` | **`false`** until human creates **validated** `docs/scm/g9/authorization.md` **and** regen derives `true` (RFC-021/022; invalid body fails regen; never hand-edit generated JSON) |
| `writing_plans_authorized`  | **`true`** for definition package (planning only)                                                                                                                                 |
| `g9toG10Authorized`         | **`false`** (HHPE handoff; G10 is live replacement, not G9 shadow parity)                                                                                                         |
| `design_approved`           | **`true`** — does not authorize runtime                                                                                                                                           |
| Auth before code            | Human auth + regen `true` **before** any `g9*.ts`, WP7 bootstrap, WP5/WP6 drivers, or WP8 runner (WP8 §8 step 1)                                                                  |
| Foundation Task 13          | Mode A unauthorized hygiene (`! -e` + expect false); Mode B authorized verify (file + expect true + tests). Empty Effect patch until WP6 authorized                               |
| ORCH-QUEUE slice            | Architecture proof only — **not** “complete G9” (WP8 claim)                                                                                                                       |
| Complete G9 claim           | Only after WP8 exact-set proof under authorized bootstrap                                                                                                                         |

### Closed behavioral laws (must not reopen)

- Capture results: **`enqueued` \| `rejected-capacity` \| `rejected-bus-withheld`** only at live boundaries; faults are **`G9InvariantFault`**, not capture results.
- FIFO max **64** from JSON; sequence allocated before admit; capacity overload episodes only on capacity path.
- Ten coordinator buses; 29 placed nodes; **`hearAs`** same-bus only; no cross-bus search.
- Hook/hook-absent: optional service absent ⇒ **unchanged live**; hook fault ⇒ G9 escalation, **no** live result rewrite (WP6).
- G9 absent bootstrap ⇒ **no** `loadG9Package` side effect, no waker, no shadow buses (WP7 §7.1).

---

## 5. Definition plan pointer table (WP1–WP8)

| WP                  | Unit | Primary definition artifact                                            | Bound / related artifacts                                                                                                                      |
| ------------------- | ---- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **WP1–WP4 + slice** | U1   | `docs/scm/g9/wp1-wp4-foundation-cohesion.md`                           | `docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md` (Tasks 1–13, bind only); `docs/scm/g9/integration-readiness.md` §4–§5 |
| **WP5**             | U2   | `docs/superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md`  | `docs/scm/g9/wp5/bundle-index.md`                                                                                                              |
| **WP6**             | U3   | `docs/superpowers/plans/2026-10-17-scm-g9-wp6-typed-hooks-plan.md`     | `coverage-validation.json` → `planned_typed_hooks`                                                                                             |
| **WP7**             | U4   | `docs/superpowers/plans/2026-10-17-scm-g9-wp7-composition-plan.md`     | `docs/scm/g9/integration-readiness.md` §6                                                                                                      |
| **WP8**             | U5   | `docs/superpowers/plans/2026-10-17-scm-g9-wp8-exact-set-proof-plan.md` | `docs/scm/g9/fixture-vectors.json`; `docs/scm/g9/integration-readiness.md` §7                                                                  |
| **Cross-WP**        | U6   | `docs/scm/g9/cross-wp-cohesion-index.md` (this file)                   | `docs/scm/g9/rfc-queue.md`; `docs/scm/g9/manager-charter.md`                                                                                   |

**Governing spec (all WPs):** `docs/superpowers/specs/2026-09-26-scm-g9-shadow-parity-design.md`, `docs/superpowers/specs/2026-09-26-scm-g9-row-ledger.md`.

**Process and scope:** `docs/scm/g9/planning-scope.md`, `docs/scm/g9/design-approval.md`.

---

## 6. Manager-answered RFCs (constructive batch 10 / 10 + adversarial 011–019)

Resolver: G9 Manager; answers **as they come up**. Open seal-blocking count tracked on `adversarial_seal`. Runtime still unauthorized.

| RFC id      | Manager choice                                                                    | Applied?                                             |
| ----------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **RFC-001** | **B** — `g9ShadowParity.ts` re-exports modular File Map                           | Yes                                                  |
| **RFC-002** | **A** — generator machine hooks before runtime auth                               | **Yes** (regen 2026-10-18; 21 `planned_typed_hooks`) |
| **RFC-003** | **A** — opt-in Layer; default absent                                              | Yes                                                  |
| **RFC-004** | **A** — prose synced to then-authoritative fixture count                          | Yes (superseded count: **763**)                      |
| **RFC-005** | **A** — WP6 owns `T2Observability.ts`                                             | Yes (plans + handoff)                                |
| **RFC-006** | **A** — unary/stream via `ws.ts`; patch for admit                                 | Yes — in force post-regen                            |
| **RFC-007** | **A** — MCP DELETE after 204 in `McpHttpServer.ts`                                | Yes — narrowed by **RFC-013**                        |
| **RFC-008** | **A** — `RuntimeDependenciesLive` + `makeServerLayer`                             | Yes — clarified by **RFC-014**                       |
| **RFC-009** | **A** — fail-fast when G9 opt-in and package load fails                           | Yes (WP7 plan §10)                                   |
| **RFC-010** | **A** — single `g9FixtureRunner.test.ts` entrypoint                               | Yes (WP8 plan §9; close gate = validation count)     |
| **RFC-011** | **A** — Bitbucket failure labels ≠ success `A`                                    | **Yes** (extract_literals fix; 10 ops)               |
| **RFC-012** | **A** — B4 until regen; then WP6                                                  | **Yes** — post-regen WP6 sole RPC capture            |
| **RFC-013** | **A** — MCP hook only on existing-session select-204                              | Yes                                                  |
| **RFC-014** | **A** — sole-lander + handoff tables; absence FILE-LOGS                           | Yes                                                  |
| **RFC-015** | **A** — Task 14 widen owner                                                       | Yes — scope superseded by **RFC-017**                |
| **RFC-016** | **A** — live-safe cause isolation                                                 | Yes — completed by **RFC-018**                       |
| **RFC-017** | **A** — Task 14 full widen                                                        | Yes — dormant rule corrected by **RFC-019**          |
| **RFC-018** | **A** — waker-defect / capture-defect / Layer arity                               | Yes — latch ctx completed by **RFC-019**             |
| **RFC-019** | **A** — absence≠dormant enqueue; optional latch identities; generated A union     | Yes — §2 apply + Task 6 by **RFC-020**               |
| **RFC-020** | **A+C** — cohesion §2 split; fault identity omit (exact five-key; no fabricate)   | Yes                                                  |
| **RFC-021** | **A** — `authorization.md` derives `implementation_authorized`; auth-before-code  | Yes — body validation + ROOT by **RFC-022**          |
| **RFC-022** | **A** — worktree ROOT; validated auth body; changelog retained notes; wave-7 seal | Yes                                                  |
| **RFC-023** | **A** — Engine Slice-only; B1 not on OrchestrationEngine; no empty stubs          | Yes                                                  |

§7 **C2** remains implementer-only (no separate RFC).

---

## 7. Contradictions and tensions (Manager-resolved where applicable)

| ID      | Topic                                            | Artifact A                            | Artifact B                   | Status / action                                                                               |
| ------- | ------------------------------------------------ | ------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------- |
| **C1**  | Canonical runtime module naming                  | U1 File Map modular `g9*.ts`          | Design `g9ShadowParity.ts`   | **Closed** — RFC-001 **B**                                                                    |
| **C2**  | Execution precondition vs planning date          | Foundation: pinned tree before Task 1 | Dirty tree OK at planning    | **Open for implementers only** — not a law conflict                                           |
| **C3**  | Fixture count prose                              | Validation count                      | Stale 788/790                | **Closed** — authoritative `counted_fixture_vector_count` **763** after Bitbucket extract fix |
| **C4**  | RpcServer hook machine set                       | `planned_typed_hooks`                 | WP6 §2.2 RpcServer text      | **Closed** — RFC-002 **applied**; 17 RpcServer phases in machine set; WP6 sole capture        |
| **C5**  | Foundation Task 13 empty patch vs WP6 patch work | Empty patch at foundation close       | WP6 needs hunks after auth   | **Tension, not contradiction** — timeline unchanged                                           |
| **C6**  | Shared `T2Observability.ts`                      | B2/B5 surfaces                        | WP6 OTLP                     | **Closed** — RFC-005 **A** + **RFC-014** handoffs applied in plans                            |
| **C7**  | Third bootstrap mode                             | Two-mode absent/present               | Merged-but-unwired           | **Closed** — RFC-003 **A** (opt-in Layer; default absent; no third mode)                      |
| **C8**  | Bitbucket error strings in success `A`           | Ledger request_label                  | Design Equality / no payload | **Closed** — RFC-011 **applied**; 10 success ops only                                         |
| **C9**  | MCP DELETE site vs ledger                        | RFC-007 harvest                       | Ledger select-204            | **Closed** — RFC-013 **A**                                                                    |
| **C10** | Dual landers on shared live files                | WP5 bundle surfaces                   | Cohesion sole owners         | **Closed** — RFC-014 **A**                                                                    |

---

## Authoritative cross-links

| Document                                     | Role in U6                           |
| -------------------------------------------- | ------------------------------------ |
| `docs/scm/g9/manager-charter.md`             | U6 unit; cohesion checks after U1–U5 |
| `docs/scm/g9/rfc-queue.md`                   | Formal open RFC list                 |
| `docs/scm/g9/wp1-wp4-foundation-cohesion.md` | §3 interface seed; §4 file map seed  |
| `docs/scm/g9/coverage-validation.json`       | Machine invariants §4                |
| `docs/scm/g9/integration-readiness.md`       | Hotspots §2; global gates            |

---

_U6 deliverable: definition only. No runtime files. No commits._

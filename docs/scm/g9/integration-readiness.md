# G9 integration readiness

<!-- Agent: work-allocation brief. Design approved. Planning authorized. Runtime not authorized. Not G1B amendment. -->

## 1. Baseline and remaining decision gates

Provisional implementation baseline (do not restyle phases; correct only demonstrated contradictions):

| Artifact            | Path                                                               |
| ------------------- | ------------------------------------------------------------------ |
| Governing design    | `docs/superpowers/specs/2026-09-26-scm-g9-shadow-parity-design.md` |
| Human ledger        | `docs/superpowers/specs/2026-09-26-scm-g9-row-ledger.md`           |
| Machine ledger      | `docs/scm/g9/coverage-ledger.json`                                 |
| Fixtures            | `docs/scm/g9/fixture-vectors.json`                                 |
| Source report       | `docs/scm/g9/source-validation-report.json`                        |
| Validation          | `docs/scm/g9/coverage-validation.json`                             |
| Observation catalog | `docs/scm/g9/observation-catalog.json`                             |
| Governed classes    | `docs/scm/g9/governed-classes.json`                                |
| Generator           | `docs/scm/g9/regen_coverage_ledger.py`                             |
| Steward brief       | `docs/scm/g9/steward-two-decisions.md`                             |

Validation snapshot after design approval: `shape-valid` true; `source_checked_subset` true; `source_exact` true; `steward-closed` true; `sole_blocker_claim` false; `design_approved` true; `writing_plans_authorized` true; `implementation_authorized` false; 119 source-extracted; 65 manual-source-audit; 0 structural counted; 0 counted unresolved; 763 counted fixtures; 21 planned typed hooks (RpcServer + MCP/OTLP); unresolved rows none; dormant `INV-T2-SCM-HOME-BUS-LINK`.

WP0 inventory decisions are applied. Design is approved. Planning is authorized. Runtime implementation remains unauthorized.

**Execution contract (RFC-021/022):** `implementation_authorized` is derived by `regen_coverage_ledger.py` from a **validated** human-authored `docs/scm/g9/authorization.md` (`gate: G9`, `date: YYYY-MM-DD`, non-empty `human`, `scope: WP1–WP8 runtime`). Absent ⇒ `false`; present-but-invalid ⇒ regen fails; valid ⇒ `true` across regen. Generator ROOT is the checkout containing the script (worktree-local). Changelog curated notes live under `## Retained notes` (WP8 no-diff when sources unchanged). Hand-edits of generated JSON are forbidden. Authorized runtime work starts only after valid auth file + regen `true`.

Hard-closed laws: FIFO, topology, DIP, fault, waker, observation, RPC, HTTP, stream, telemetry-export. Do not reopen.

## 2. Stable implementation contracts

### Already defined in design

- **`captureOccurrence`**: families call `{ comm_id, phase, input }` only. Coordinator validates/enqueues. Families do not enqueue, publish, or own tracers/meters.
- **Occurrence**: immutable after enqueue. Live success enqueues; clock publishes later. Capture count ≠ timestep publication count. No satisfaction.
- **Attempt sequence**: node-local, allocated **before** FIFO admission.
- **FIFO**: one queue per G3 `node_id`; `fifo_max_occurrences_per_node = 64`; depth = queued occurrences; enqueue iff `depth < 64`.
- **Expected capture outcomes**: `rejected-capacity` (overflow, not `invalid`); `rejected-bus-withheld` (frozen/halted, no retained `A`); no `rejected-muted`; typed live failure = no occurrence.
- **Promotion / W1**: `scm.fundamental-clock` process interval N=1; all-or-nothing timestep preflight; `admitShadowPublish` then G6 `admitPublish`; `hearAs` same-bus only; `process_interval_wake_ms = 100`; no wall catch-up.
- **`admitShadowPublish`**: ten **bus ID** map keys; checks bus/node/G3 bind/placed/non-reserved/non-parent/`checkW1Word` in order; failure is `G9InvariantFault` without G7 mutation and without `admitPublish`.
- **`G9InvariantFault`**: unexpected invariants. Named distinction: expected capacity/withheld vs unexpected fault. `clock-overlap` if non-waker G8 overlap. Fault path: publish nothing, retain evidence, latch `faulted`, disarm wakes, metadata-only `t2.scm.shadow.fault`, deliver typed fault+code to authoritative supervisor, propagate. G9 does not freeze/halt/stop the wider live stack.
- **Waker**: `stopped \| armed-idle \| armed-in-flight \| faulted`; skip-if-busy on overlapping **waker** ticks.
- **Roster coordinator**: instantiate exactly ten G3 `InProcessOpenLoopBus` instances; never `BidirectionalHomeBusLink` as fabric or clock target; `node.observer.404` reserved; authority parent not a map entry.
- **`hearAs`**: roster-aware same-bus; direct `bus.read` is not DIP hear.
- **Observation**: closed catalog JSON; publication span remains `t2.scm.publish`; no enqueue span; G9-owned overload+fault spans and four underscored metrics; family adapters get no tracer/meter.
- **Optional typed hooks**: RpcServer admit/unary-success/stream-element; MCP decoded-message/typed-success/session-delete; telemetry-export post-success after filtered batch. Absent hook service = unchanged live behavior. Hook fault follows G9 escalation and must not rewrite a successful live result. No payload retention.
- **Row registry**: init-time G1B=G3=G9 `comm_id` set equality (74), digest-pinned; duplicate `comm_id` fail before `Map`; family is per phase; loader consumes the approved ledger (or code generated **from** it). No second hand-maintained row list.
- **Clock integers**: `live_process_interval_fundamental_timesteps = 1`.

### Generated from ledger

Exact members, phases, families, capture sites, finite labels, retain flags, equality mappings, fixture ids/vectors, `capture_strategy`. Do not edit generated JSON by hand; regenerate from `regen_coverage_ledger.py` / source declarations.

### Left to planner (not missing design)

TypeScript type names, module file split under `apps/server/src/scm/`, Effect Context.Service wiring, test-only injection seams (fake clock, inject FIFO depth, inject DIP position, inject hook services), supervisor process identity already owning G7/G8, serialization of occurrence bytes in tests.

Do not invent extra coordinators, global patches, or an eleventh bus to fill these.

## 3. Critical path

```text
WP0 inventory closure
        |
WP1 registry contract
        |
+-------+---------+
|                 |
WP2 core       WP3 buses/governance
|                 |
+--------+--------+
         |
WP4 waker/fault/observation
         |
first vertical slice (INV-T2-ORCH-QUEUE / queue-offered)
         |
+--------+------------------+
|                           |
WP5 local families       WP6 typed hooks
|                           |
+-------------+-------------+
              |
        WP7 composition
              |
        WP8 exact-set proof
```

Critical path to first architecture proof: WP0 → WP1 → WP2+WP3 → WP4 → ORCH-QUEUE slice. WP8 is complete G9. The slice is not complete G9.

## 4. Work-package allocation

| Work package                           | Outcome                                                                                                                                                                                                        | Depends on                                             | Parallel after                                                             | Primary files/surfaces                                                                                                                                                                                                  | Acceptance gate                                                                                                  | Risk                                                                                                 | Non-goals                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------- |
| WP0 Inventory decision closure         | Steward decisions applied to G1B/G3/G9; ledger/fixtures regenerated; `source_exact` recalculated honestly; inventory set frozen                                                                                | Steward two-decision brief                             | Nothing                                                                    | `docs/scm/g1b/inventory.json`, G3 topology, `regen_coverage_ledger.py`, generated G9 JSON                                                                                                                               | Validation JSON: unresolved set matches steward outcome; PROJECT-QUEUE/TERM-ENV either counted-closed or retired | Wrong amendment silently rebinds queues or invents T3CODE passthrough                                | Runtime capture; unofficial 73/75 sets |
| WP1 Generated row contract and loader  | Typed registry loaded/generated from approved ledger; exact-set + topology equality; family/phase declarations validated; no capture                                                                           | WP0                                                    | WP2 and WP3                                                                | generated registry, `coverage-ledger.json` consumer, SHA pins                                                                                                                                                           | Init fails on G1B/G3/G9 set mismatch; typecheck of registry                                                      | Hand-maintained second row list                                                                      | FIFO, waker, adapters                  |
| WP2 Core shadow runtime                | Immutable occurrence; sequence; per-node FIFO 64; capacity reject/recover; active-node; W1 promotion; retain/retire; all-or-nothing preflight                                                                  | WP1                                                    | WP3 (after WP1)                                                            | `apps/server/src/scm/g9*` core (planner names files)                                                                                                                                                                    | Property tests: depth 64, `rejected-capacity`, no mute result, retain law, no wall sleep                         | Sequence after admission; dropping overflow                                                          | Application adapters; Effect patch     |
| WP3 Ten-bus coordinator and governance | Ten buses; roster `hearAs`; G7 withhold; G6 hear-only mute; governed classes; `admitShadowPublish`; reserved/parent/404 reject; no home-bus-link fabric                                                        | WP1                                                    | WP2 (after WP1)                                                            | G5–G8 buses, `governed-classes.json` loader, DIP consult                                                                                                                                                                | Ten instances; parent/404 reject tests; mute is hear-only                                                        | Eleventh bus; `comm_id`-keyed bus map                                                                | Capture families                       |
| WP4 Waker, supervisor, observation     | Four-state waker; skip-if-busy; no catch-up; fault latch+rethrow; supervisor propagation; closed catalog; export failure cannot mutate coordinator                                                             | WP2, WP3                                               | Vertical slice                                                             | observation module, waker, supervisor join                                                                                                                                                                              | Fault-stop + skip-if-busy + allowlist tests; no G9 self-halt                                                     | G9 dispositions live stack; family tracers                                                           | Full 74-row capture                    |
| WP5 Existing-local-boundary families   | Family modules call only `captureOccurrence`; bundles: queue-pubsub+callback; file/db/process-config; subprocess+external-transport; provider protocol; terminal+local streams; dormant home-bus-link fixtures | WP4 + frozen capture/occurrence/loader/fault contracts | Parallel **family bundles** after those contracts; not parallel JSON edits | family modules; B1 `apps/server/src/orchestration` pub/sub (ledger ORCH-EVENTS — **not** `OrchestrationEngine.ts`); `Manager.ts`; provider runtimes. ORCH-QUEUE Engine hook = **Slice-Foundation-Owner** only (RFC-023) | Per-bundle: one live success → one occurrence; payload excluded                                                  | Collapsing stacked GIT/SQL/TERM; capturing PROJECT-QUEUE/TERM-ENV before WP0; B1 dual-landing Engine | Effect patch; claiming complete G9     |
| WP6 Effect and exporter typed hooks    | Optional RpcServer + MCP + OTLP post-success hooks; absent = live unchanged; hook fail = G9 escalate, no live rewrite                                                                                          | WP4                                                    | Tests/consumers after patch owner assigned; **serial** patch edits         | `patches/effect@4.0.0-beta.103.patch`, Observability/T2Observability, McpHttpServer                                                                                                                                     | Patch applies; hook-absent noninterference; hook-present post-success only                                       | Concurrent patch edits; tracing-dependent capture                                                    | Generic HTTP middleware capture        |
| WP7 Bootstrap and live composition     | Exact roster coordinator; registry; capture service; waker under supervisor; optional hooks only in intended T2 layers; G9 absent ⇒ current live; no eleventh bus                                              | WP5, WP6                                               | None                                                                       | server bootstrap/layers                                                                                                                                                                                                 | Boot with G9 Layer absent and present; live RPC/orch still pass                                                  | Composition ownership; accidental production home-bus-link                                           | Completing WP8 in this package         |
| WP8 Exact-set integration proof        | All approved rows; every phase/branch executable fixtures; same-bus hear; FIFO overload/recovery; fault-stop; live noninterference; no wall sleep; dormant non-production; no silent skip                      | WP7                                                    | None                                                                       | `fixture-vectors.json` (generated), G5–G8 regressions, G9 invariant tests                                                                                                                                               | Package validation + generated fixture runner + G9 core properties                                               | Calling the vertical slice “complete G9”                                                             | New families; reopening closed laws    |

## 5. First vertical slice

After WP1–WP4: **`INV-T2-ORCH-QUEUE` / `queue-offered`**.

Why: local `Queue.offer` in `OrchestrationEngine.ts`; `accepted === true` is an explicit live success; no Effect patch; request-shaped `command_type` in `{client, internal}`; `retainCurrentAfterPublish: false`; origin `node.orchestration` / `bus.control`.

Acceptance (architecture proof only):

1. Live `Queue.offer` behavior unchanged.
2. One successful accepted offer → one occurrence.
3. Occurrence enters `node.orchestration` FIFO.
4. No W1 before clock promotion.
5. One timestep publishes exactly one W1 on `bus.control`.
6. Same-bus bound receiver hears at T+1.
7. Unbound bus does not hear.
8. Equality `A` contains finite command tag only (`client` \| `internal`).
9. No command body in FIFO, W1, or observations.
10. Absent G9 service leaves current orchestration unchanged.
11. `accepted === false` → no occurrence and no invariant fault.

Do not describe this slice as completed G9.

## 6. Parallelization and file-ownership hazards

WP5 bundles parallelize only after `captureOccurrence`, occurrence schema, row-loader, and fault contract freeze.

WP6: **one owner** for `patches/effect@4.0.0-beta.103.patch`. Others may prepare tests and consumers; no concurrent patch edits.

WP7: **one owner** for bootstrap/layer join (coordinator, supervisor, observations, application layers).

Serial hotspots: Effect patch; server bootstrap; central G9 registry/generated artifacts; observation module; generator + fixture JSON (generator owns outputs); shared provider runtimes; `terminal/Manager.ts`.

Parallel: isolated family modules/tests that only call `captureOccurrence`.

Do not have multiple workers edit generated JSON. Do not have multiple workers edit the Effect patch.

## 7. Integration and verification gates

Per package: smallest proof in the table above. Do not list all 763 fixtures here; run `docs/scm/g9/fixture-vectors.json` (or a generator-backed runner) in WP8.

Global gates: typecheck; unit tests without wall sleeps; `python3 docs/scm/g9/regen_coverage_ledger.py` / package validation; exact-set G1B=G3=G9; G5–G8 regressions; G9 core FIFO/fault/waker properties; live integration G9 Layer absent and present; Effect patch application; observation allowlist; payload-exclusion; fault propagation to supervisor.

## 8. Deferred/non-goals

- No G9 runtime in the session that produced this brief.
- No implementation plan yet (`writing-plans` not invoked).
- No G1B amendment without steward decision.
- No unofficial cross-bus observer hear.
- No new control plane; no live-effect replacement; no generic payload capture.
- No completion claim from the vertical slice.
- No proof that 100 ms implies capacity sufficiency; no attempt to eliminate expected overload evidence.
- No production `BidirectionalHomeBusLink` to create occurrences.
- Codec, nibble, G10, `g9toG10Authorized` remain false.

## Recommended first `writing-plans` scope (future session)

WP0 decision **application** (after steward), WP1 registry contract, WP2 core runtime, WP3 bus/governance, WP4 waker/fault/observation, and the single `INV-T2-ORCH-QUEUE` / `queue-offered` vertical slice.

Do not plan WP5–WP8 in that first plan. Later plans allocate remaining families and exact-set proof against a working foundation.

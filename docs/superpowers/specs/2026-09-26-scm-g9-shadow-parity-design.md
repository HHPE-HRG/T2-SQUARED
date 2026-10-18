---
title: SCM G9 shadow-label parity design
date: 2026-09-26
status: design-approved
plan: docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md
scope: G9 Increment 5 shadow labeling of inventoried communications onto W1
ledger: docs/superpowers/specs/2026-09-26-scm-g9-row-ledger.md
coverage: docs/scm/g9/coverage-ledger.json
validation: docs/scm/g9/coverage-validation.json
governed_classes: docs/scm/g9/governed-classes.json
observation: docs/scm/g9/observation-catalog.json
changelog: docs/scm/g9/coverage-changelog.md
approval_ready: true
design_approved: true
writing_plans_authorized: true
implementation_authorized: false
---

# SCM G9 shadow-label parity design

<!-- Agent: G9 is shadow-label parity beside live Effect/HTTP/queue/persistence.
It is not G10 cutover, not a codec, not WORK-000035 losslessness.
Canonical runtime later: apps/server/src/scm/g9ShadowParity.ts plus docs/scm/g9/.
Do not copy restricted HHPE/Issue-9 prose into git. Do not flip g9toG10Authorized.
This document records steward-closed law from the G9 design thread plus
code-grounded remaining family allocations in the 74-row ledger.
Ask a human only if a change would alter SCM anatomy, authority, gate meaning,
or governance scope. -->

## Purpose

Complete G9 as **shadow-label parity**: every G1B `comm_id` maps live decoded
communication onto W1 on its G3 origin bus, observed beside Effect RPC and
other live transports. Equality is `G9DeferredEquality<A>` (G9-local deferred
IR). G10 remains live replacement and stays unauthorized.

Human authorization for implementation is **not** this file. Package
`docs/scm/g9/authorization.md` is created only when G9 is separately authorized
to build.

## Existing constraints

- G0–G8 packages exist. Codec, nibble alphabet, dictionary, English encoding,
  T3 payload encoding, and G10 cutover remain forbidden.
- OTEL is observational. SCM is agnostic of campaign/workloads.
- Fit freeze/halt into DIP + bridge. No extra SCM identities.
- Canonical names: `gNName.ts` + `docs/scm/gN/`.
- Restricted HHPE texts stay in `/Users/maxholden/T2-SQUARED-References`, not
  the git tree.

## Chosen architecture

One coordinator (`g9ShadowParity` / roster clock target) plus mechanism-family
modules. Families only call `captureOccurrence`. Coordinator owns equality
compare, W1 projection, attempt sequence, FIFO, DIP bus-position consult
(`live|frozen|halted` only), publication via `admitShadowPublish` then G6
`admitPublish`, observation catalog, and faults.

```text
live success boundary
  → family captureOccurrence({ comm_id, phase, input })
  → coordinator validate/enqueue
  → scm.fundamental-clock process interval N=1
  → all-or-nothing timestep preflight
  → G5 publish on origin bus
  → G6 hearAs on same bus
```

## Equality law (steward-closed)

Governing object: `G9DeferredEquality<A>` schemaVersion 1.

Proves: existing decoded live communication and its W1 shadow label identify
the same inventoried semantic communication under declared G9 adapter law.

Does **not** prove: WORK-000035 losslessness, byte equality, reconstruction,
production encode/decode, codec/nibble/dictionary, G10 readiness.

`A` is an existing decoded Effect Schema type or a minimal projection derived
from one. No unknown payload bag, JSON stringify of `A`, raw bytes, SQL,
terminal contents, secrets, or generic record fallback.

Comparison: `liveToEquality` / `shadowToEquality` then structural equality
after schema validation. W1 proofs (`checkW1Word`, topology, cadence, `word_id`)
are separate and cannot masquerade as semantic equality.

Mortality: G9-local, non-canonical outside the G9 shadow package. A future
WORK-000035 IR may replace it through separately authorized migration. G9 does
not require that migration. Replacement must preserve or explicitly invalidate
each of the 74 row fixtures; type-name substitution is insufficient.

G2: permit `claiming-g9-shadow-label-parity` against `G9DeferredEquality`.
Continue forbidding unqualified `claiming-g9-semantic-parity` and codec/G10
claims. Documentation says **shadow-label parity**, never bare “035 semantic
parity.”

## W1 projection (steward-closed)

Per-row pair: `state_label` and `request_label` (`CANONICAL_ABSENCE` allowed
only on request). `semanticKind` names which slot owns `value: A`. Labels are
finite governed names, not encodings of `A`. `state_label` has no absence
shortcut. Ages from `nextAges` only. No extra W1 fields. Payload hashes
forbidden in slots; `w1WordId` remains observation correlation of governed W1
fields.

## Capture lifecycle (steward-closed)

Live success **enqueues** an immutable occurrence. Clock **publishes** later.
Capture count ≠ timestep publication count. No satisfaction. Later phases are
new words. Cyclic G5 repeats of current projection are not new captures.

`G9DeferredValue.invalid` is not permission to publish an invalid W1.
Unexpected invariants escalate (below). Expected capacity/withheld/mute/`N=0`
continue.

## Clock, activity, wake (steward-closed)

Independent waker + enqueue-only capture. Live
`process_interval_wake_ms = 100`, `live_process_interval_fundamental_timesteps = 1`.
No wall catch-up. Missed wakes discarded. Coordinator has no hidden wake
default.

Node states: inactive / active / withheld (frozen/halted). G7 freeze/halt is
**latched; no resume**. Retirement only via `retainCurrentAfterPublish: false`
after successful publication of that phase, never from `CANONICAL_ABSENCE`.
One `comm_id` cannot permanently retire a shared G3 node.

Waker states: `stopped | armed-idle | armed-in-flight | faulted`. Skip-if-busy
for overlapping **waker** ticks. G8 overlap from any other caller is
`clock-overlap` invariant. Private production `SharedFundamentalClock`.

## FIFO / overload (steward-closed)

One FIFO per G3 `node_id`. `fifo_max_occurrences_per_node = 64`. Depth counts
queued occurrences only. Enqueue iff `depth < 64`. Attempt sequence allocated
**before** admission. Overflow is `rejected-capacity`, not `invalid`. Frozen
halted capture is `rejected-bus-withheld` without retaining `A`. No silent
drop, no node-local withhold, no round-robin. Bounded overload start/recovery
spans plus rejection **metrics**. Re-accept when depth falls. Hot `comm_id`
starvation is visible, not mitigated in G9.

## DIP mute (steward-closed)

Inherit G6 **hear-only**. Coordinator consults DIP only for `live|frozen|halted`.
No `rejected-muted`. Authority-parent traffic cannot be muted.
`hearAs` is roster-aware same-bus hear. Direct `bus.read` is not DIP hear.

## Topology (steward-closed)

Instantiate **all ten** G3 buses as distinct `InProcessOpenLoopBus` instances.
No G9 routes. `BidirectionalHomeBusLink` is not the roster clock target and is
not fabric. `INV-T2-SCM-HOME-BUS-LINK` is **dormant-prototype**
(`production_instance: false`): fixture-only forward onto shadow `bus.scm.a`;
no production `BidirectionalHomeBusLink` and no live re-bridge. Logical
timestep barrier; JSON order is not protocol law. `node.observer.404` reserved.

## Governed classes (steward-closed)

Exact ten-bus table (runtime `InProcessOpenLoopBus` instances). Copy G3 bus
identities; do not invent an eleventh production bus.

| bus_id            | class    | runtime | notes            |
| ----------------- | -------- | ------- | ---------------- |
| `bus.rpc`         | A1       | yes     | private instance |
| `bus.control`     | A1       | yes     | private instance |
| `bus.provider`    | A2       | yes     | private instance |
| `bus.persistence` | A2       | yes     | private instance |
| `bus.terminal`    | A2       | yes     | private instance |
| `bus.observer`    | observer | yes     | private instance |
| `bus.network`     | A2       | yes     | private instance |
| `bus.vcs`         | A2       | yes     | private instance |
| `bus.scm.a`       | A2       | yes     | private instance |
| `bus.scm.b`       | A2       | yes     | private instance |

Exact 29-node copy rule: copy G3 `node-roster.json` identities. **29 placed nodes**
take `baseline_authority` as class. Reserved identity:

| node_id             | class    | placementStatus | live_g1_comm_ids | G9 origin |
| ------------------- | -------- | --------------- | ---------------- | --------- |
| `node.observer.404` | observer | reserved        | `[]`             | forbidden |

Authority parent is **not** a runtime map entry:

| identity                                   | class | runtime |
| ------------------------------------------ | ----- | ------- |
| `bus.scm.authority` / `node.scm.authority` | A0    | false   |

Loader builds G6 `GovernedClasses` from **runtime maps only**. Parent is
`authority_bus_id` string. Empty initial DIP. Pin:
`docs/scm/g9/governed-classes.json`.

Roster-aware `hearAs` is the sole production read surface. Direct `bus.read` is
not DIP hear. Private production `SharedFundamentalClock`. Roster coordinator
never constructs `BidirectionalHomeBusLink`.

## admitShadowPublish placement checks (steward-closed)

`admitShadowPublish` must verify, in order, before invoking G6 `admitPublish`.
The runtime coordinator map has exactly ten **bus IDs** as keys, not 74
`comm_id`s. Do not create a `comm_id`-keyed runtime bus map.

1. `word.bus_id === row.origin_bus_id === coordinator bus-map key being written`.
2. `word.node_id === row.node_id`.
3. G3 node/bus binding matches the row (`node_id`, `origin_bus_id`).
4. Identity is placed and non-reserved (`node.observer.404` rejected).
5. Identity is not the authority parent (`node.scm.authority` / `bus.scm.authority` rejected).
6. `checkW1Word` succeeds on the candidate word.

Precheck failure raises `G9InvariantFault` without G7 freeze/halt mutation.
It does not call `admitPublish`.

## Faults (steward-closed)

Expected outcomes continue (`rejected-capacity`, `rejected-bus-withheld`,
typed live failure = no occurrence). Unexpected invariants use
`t2.scm.shadow.fault` **and** `G9InvariantFault`.

Fault wording:

1. Publish nothing.
2. Retain evidence.
3. Latch G9 `faulted`.
4. Disarm future wakes.
5. Emit metadata-only fault observation.
6. Deliver typed fault and finite fault code to authoritative supervisor.
7. Propagate.
8. Let supervisor decide wider stack disposition.
9. G9 never self-freezes, self-halts, shuts down live services, resumes, or swallows fault.

G9 does not freeze/halt itself. Timestep is all-or-nothing preflight. Waker
does not swallow faults. Clock-specific codes are distinct from admission.

## Observation (steward-closed)

Closed catalog in `docs/scm/g9/observation-catalog.json`.

Inherited G5–G8 span names: `t2.scm.publish`, `t2.scm.receive`,
`t2.scm.bridge.forward`, `t2.scm.dip.set`, `t2.scm.hear.muted`,
`t2.scm.clock.advance`, `t2.scm.freeze`, `t2.scm.halt`,
`t2.scm.recommend_stop`.

G9-owned spans: `t2.scm.shadow.overload.start`,
`t2.scm.shadow.overload.recovered`, `t2.scm.shadow.fault`.

Successful publication remains inherited `t2.scm.publish`. G9 does not invent
`t2.scm.shadow.publish`. Capture enqueue does not receive a general span.
Capacity rejection is the counter `t2_scm_shadow_rejected_capacity_total` plus
bounded overload start/recovery episodes.

Metrics (underscored): `t2_scm_shadow_wake_skipped_total`,
`t2_scm_shadow_fifo_depth`, `t2_scm_shadow_rejected_capacity_total`,
`t2_scm_shadow_rejected_withheld_total`.

Attribute allowlists are exact per span in the catalog JSON. Fault observation
is metadata-only (`t2.scm.comm_id`, `t2.scm.node_id`, `t2.scm.bus_id`,
`t2.scm.fault_code`, `t2.scm.waker_state`). The allowlist stays exactly those
five keys: optional means a key may be omitted, not that arbitrary attributes
are accepted. `fault_code` and `waker_state` are always emitted. The three
identity attributes are omitted when no associated occurrence exists
(waker/clock faults); capture faults include them whenever a package row is
available. Never fabricate reserved identities for diagnostics. No
payload/SQL/terminal/secret attributes. `t2.scm.word_id` is an attribute join,
not an OTEL SpanLink.
`bridge.forward` never from roster coordinator. Family adapters get no
tracer/meter.

## Exact-set architecture (steward-closed)

Family modules + named row declarations. Families do not enqueue. Family is
**per phase**. Init-time set equality G1B = G3 = G9 declarations, duplicate
`comm_id` fail before `Map`. Pin inventory/topology SHA-256. Count 74 is pinned;
silent expansion forbidden. Aggregates copy exact member IDs, methods,
endpoints, and capture sites—not only 74 top-level IDs. Package validation distinguishes layers in `docs/scm/g9/coverage-validation.json`:

- `shape-valid` — ledger structure, 74-id sets, topology, required fields, fixture-id products.
- `source_checked_subset` — independently extracted unions compared to ledger (WsRpcGroup, EnvironmentHttpApi, ProjectionSnapshotQuery, and other extractors in the generator).
- `source_exact` — true only when every counted phase is `source-extracted` or `manual-source-audit` and no counted unresolved mismatch remains. Token presence and directory modules are not source-extracted.
- `sole_blocker_claim` — remains `false` after WP0 inventory closure. It is not a remaining blocker and must not be set `true`.
- `steward-closed` — observation catalog and governed-class pins.
- `unresolved` / `dormant-prototype` — row statuses.

Per counted phase: `docs/scm/g9/source-validation-report.json`.
Fixture provenance: `independently-extracted-source` vs `g9-ledger-declaration`.
Steward two-decision record: `docs/scm/g9/steward-two-decisions.md`. Historical packets remain under `docs/scm/g9/INV-T2-PROJECT-QUEUE-steward-packet.md` and `docs/scm/g9/INV-T2-FLAG-TERM-ENV-steward-packet.md`. `comm_id` suffixes are stable identities, not mechanism descriptions.

## Families

Closed family **names**:

`rpc` · `http` · `stream` · `queue-pubsub` · `callback-service` · `database` ·
`file-io` · `process-config` · `subprocess` · `external-transport` ·
`telemetry-export` · `home-bus-link`

RPC law (WsRpcGroup in `packages/contracts/src/rpc.ts`):

- Admission for all **98** registered methods.
- Unary success for **81** unary methods only.
- Explicit `stream` variants for Effect-RPC stream elements (17 methods),
  native monitor events (`INV-T2-RES-MONITOR`), and desktop messages
  (`INV-T2-TEL-DESKTOP-IN`). Stream close is not a phase.

Unregistered `projects.list` / `projects.add` / `projects.remove` constants
are excluded.

## retainCurrentAfterPublish

Not a blanket false. Each phase has a phase-specific rationale in the machine
ledger. Momentary success edges remain false. Listening, process-state,
configuration-state, and availability-shaped phases may retain. Current
counted retain-true and momentary phases are generated from the machine ledger
header (`retain_true_count`, `momentary_count`); do not hand-copy. Listening,
process-state, configuration-state, and availability-shaped phases may retain.

## Package files (design intent)

```text
docs/scm/g9/
  authorization.md          # only after human G9 auth
  decisions.md
  README.md
  manifest.json             # g10Authorized: false
  governed-classes.json     # design pin
  observation-catalog.json  # design pin
  coverage-ledger.json
  coverage-validation.json
  coverage-changelog.md
  fixture-vectors.json
  regen_coverage_ledger.py  # design generator; not runtime
  framing / wake+fifo integers
```

G8 `g9toG10Authorized: false` stays false.

## Out of scope

- G10 cutover / replace Effect RPC
- Codec, nibble, dictionary, English, T3 payload encoding
- Satisfaction / ACK / retry
- Unofficial observer cross-bus hear
- Global Queue/PubSub/Effect.fn patches
- Per-byte PTY capture
- Inventing `comm_id`s for uninventoried live paths
- Instantiating production `BidirectionalHomeBusLink` to create a G9 occurrence
- Adding a server logger to satisfy `serverLogPath`
- `writing-plans` in this pass
- Implementation of coordinator/families

## Acceptance (package)

1. Init fails unless G1B, G3, and G9 declaration `comm_id` sets are identical
   (74) and digest-pinned.
2. Every ledger phase has family, capture symbol/module, member or site ID,
   success predicate, bounded `A`, `liveToEquality`, `shadowToEquality`,
   `semanticKind`, finite `request_label`, finite `state_label`, live-failure
   disposition, sensitive exclusions, retain + rationale, fixtures.
3. Every aggregate has structured exact members.
4. Unresolved rows are never counted closed.
5. Shadow never changes live Effect results on expected paths; unexpected
   invariant faults stop G9’s waker, emit bounded evidence, and propagate typed
   fault to the authoritative supervisor; G9 itself does not disposition the
   wider live stack.
6. No codec/G10 claims. Docs say shadow-label parity.

## Status

**Design approved 2026-09-30 for planning.** Runtime implementation is not authorized. Do not create `docs/scm/g9/authorization.md` until a later authorization to build or activate G9. `sole_blocker_claim` remains false. First authorized plan: WP1–WP4 plus `INV-T2-ORCH-QUEUE` / `queue-offered` only. That phase’s public equality type name is `G9OrchQueueEqualityA` (ledger `equality_type` string and later TypeScript identifier). A is `{ command_type: "client" | "internal" }` via `Schema.is(DispatchableClientOrchestrationCommand)` on the OrchestrationCommand passed to dispatch. ClientOrchestrationCommand is the pre-normalization body.

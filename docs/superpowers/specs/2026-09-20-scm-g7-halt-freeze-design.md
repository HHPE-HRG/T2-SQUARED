---
title: SCM G7 halt vs 404 and freeze-behavior design
date: 2026-09-20
status: design-approved
plan: docs/superpowers/plans/2026-09-20-scm-g7-halt-freeze.md
scope: G7 halt/404 split as DIP bus-level switch plus bridge obedience
authorization: docs/scm/g7/authorization.md
decisions: docs/scm/g7/decisions.md
checkpoint: ac87e78ec
---

# SCM G7 halt vs 404 and freeze-behavior design

## Purpose

Prove D10 halt law without adding SCM identities: 404 may recommend stop and
must not halt; freeze/halt are **DIP bus-level positions** on an existing
receiving bus; the **bridge** consults those positions and does not forward
when either end is frozen or halted.

Freeze is behavior (latch + refuse mutation). A freeze-store product is out
(D16). SCM stays agnostic of campaigns and workloads.

Human authorization: `docs/scm/g7/authorization.md`. Binding:
`docs/scm/g7/decisions.md`.

## Existing constraints

- G1–G6 complete as packages. G7 human-authorized 2026-09-20. G8–G10 unauthorized.
- G4/G5 `g6toG10Authorized: false`. G6 `g7toG10Authorized: false`. Do not flip.
- G3: observers and `node.observer.404` have `halt_initiator: no`. No node has
  `halt_initiator: yes`. Ordinary/home halt cells stay `open`.
- Open-loop G5 storage, G6 DIP/hear, home-bus bridge exist.
- OTEL observes only; it must not admit, mute, route, satisfy, halt, or freeze.
- 404 cannot halt (D10). Observer-class nodes cannot set freeze/halt DIP.
- No new SCM node, campaign object, or OTEL-owned controller.
- No new dependency. No codec. No ACK/retry.

## Chosen architecture

Fit G7 into the two surfaces that already exist:

```text
DIP switch set (on a home bus)
  per-source rows:  hear | mute-source | mute-modifiers     (G6)
  bus-level:        live | frozen | halted                  (G7)

bridge (infrastructure)
  if source DIP or dest DIP is frozen|halted → do not forward
  bridge has no halt identity and cannot raise halt
```

```text
steward --> DIP.setBusPosition(bus_id, frozen|halted)
404     --> recommendStop()  -- OTEL only --> DIP unchanged
publish / advance / setDip(rows) --> refuse if this bus frozen|halted
read / hear of latched snapshot --> still allowed
```

Implementation lives as bus-level state on the existing DIP store (extend
`DipMuteStore` / `g6DipMute.ts`, plus bridge checks in `g6HomeBusLink.ts`).
A helper file is allowed only as DIP/bridge code, not as a new manifold role.

## DIP role (robust)

DIP is the stewarded switch set **of one receiving bus**. It does two jobs
that must not be collapsed:

1. **Population (G6):** which origins this bus hears (`mute-source`,
   `mute-modifiers`, `hear`). Mute never stops publish and never stops the
   bridge.
2. **Safety (G7):** whether this bus is still a live communication surface
   (`live` / `frozen` / `halted`). Freeze/halt stop mutation on that bus.

Mute of a peer is not freeze. Freeze of this bus is not mute of a source.

Who may write DIP:

- Per-source rows: steward (existing G6).
- Bus-level freeze/halt: steward only. Observer class and
  `node.observer.404` fail closed; DIP position unchanged.
- After `frozen` or `halted`, further DIP **row** mutation on that bus fails
  closed. Bus-level position itself is not reversed in this slice.

## Bridge role (robust)

The bridge republishes eligible local-origin words between two home buses. It
is not a node, has no authority, and **does not own halt**.

On each forward attempt it reads DIP bus-level position of **source** and
**destination**. If either is `frozen` or `halted`, that route fails closed
for the timestep (isolated route failure, source storage unchanged). Local
publish on an unfrozen peer may continue; it will not appear on a frozen dest
via bridge.

## Why DIP, not a new controller and not halt-on-bridge-only

A freeze on unexpected identity is **local to a bus**. The bridge is optional
on that surface. Halt-only-on-bridge would leave a single bus able to keep
writing after fail-closed. A separate campaign/safety identity would add an
SCM role that is not a bus, DIP, or bridge.

D10 “campaign function” is **steward permission to throw the DIP halt
switch**, not an SCM campaign type.

## Halt, freeze, recommend-stop

| Call                                  | DIP? | Bridge? | OTEL                    | Who                      |
| ------------------------------------- | ---- | ------- | ----------------------- | ------------------------ |
| `recommendStop(from_node_id, reason)` | no   | no      | `t2.scm.recommend_stop` | 404/observer allowed     |
| `setBusPosition(bus, frozen)`         | yes  | obeys   | `t2.scm.freeze`         | steward; reject observer |
| `setBusPosition(bus, halted)`         | yes  | obeys   | `t2.scm.halt`           | steward; reject observer |

Unknown `bus_id` → fail closed, no DIP write.

### Freeze semantics (that bus)

1. Latch current `readable` snapshot in memory (no freeze-store product).
2. `publish` and `advanceFundamentalTimestep` on that bus fail closed.
3. `read` / `hear` of the snapshot still succeed; G6 mute still applies.
4. Per-source `setDip` on that bus fails closed.
5. Bridge will not forward into or out of that bus.

### Halt semantics (that bus)

Same latch as freeze. Observation name is `t2.scm.halt`. Idempotent if already
`halted` (no extra span). No unhalt.

Stopping both home buses is two DIP writes (`bus.scm.a` and `bus.scm.b`), not
one global halt object.

### 404 recommend-stop

OTEL only. DIP stays `live`. Tests must show publish, hear, and bridge still
work after recommend-stop.

Observer `setBusPosition(frozen|halted)` throws; DIP unchanged.

## Unexpected identity fail-closed

On publish or bridge dest write, if `bus_id`/`node_id` is unknown to governed
identity or binding is empty: refuse the write and set **that bus** DIP to
`frozen`. Do not write halt on other buses. Do not emit recommend-stop.

## Telemetry

Observation after successful SCM decision only. Attributes:

```text
t2.scm.reason
t2.scm.node_id     # recommender or rejected caller
t2.scm.bus_id      # DIP bus
t2.scm.dip.bus_position   # live | frozen | halted
```

No `setGlobalTracerProvider`. No T3 `server.trace.ndjson`. Observation failure
must not unlatch DIP.

## Proof matrix

| Case                         | Expect                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| 404 recommend-stop           | span; DIP still live; publish/hear/bridge continue                                            |
| Observer freeze/halt DIP     | throw; DIP still live                                                                         |
| Steward freeze home A        | A rejects publish/advance; B still live; bridge A↔B does not deliver; A read/hear snapshot ok |
| Steward halt home A          | A halted; B live unless its DIP also halted                                                   |
| Halt both homes              | two DIP halt writes; neither mutates                                                          |
| Unexpected unknown node on A | A frozen; word not in writing map; B unchanged                                                |
| Mute ≠ freeze                | mute-source on A of B: A still publishes; bridge still forwards; hear omits B                 |
| OTEL                         | recommend-stop vs freeze vs halt are different names; provider identity unchanged             |

G5/G6 regressions remain green. G6 mute tests must not require bus-level halt.

## Package / files (design intent)

```text
docs/scm/g7/          authorization, decisions, README, manifest
apps/server/src/scm/g6DipMute.ts      bus-level DIP position + guards
apps/server/src/scm/g6HomeBusLink.ts  consult DIP before forward
apps/server/src/scm/g5OpenLoop.ts     publish/advance fail if DIP frozen|halted
apps/server/src/scm/g7HaltFreeze.test.ts
```

No new SCM identity. `g7HaltFreeze.ts` only if it is DIP/bridge functions
without a controller type.

## Out of scope / non-goals

- Campaign or workload objects in SCM
- G8 clocks product, G9/G10, codec, Kuato, D16 store, unhalt
- Setting G3 `halt_initiator` to `yes`
- Flipping compound later-gate flags
- Changing G6 mute law
- OTEL performing halt/freeze

## Acceptance criteria

1. 404 recommend-stop does not change DIP or bus mutation.
2. Observer cannot set freeze/halt DIP positions.
3. Freeze/halt are per-bus DIP positions; bridge obeys both ends.
4. Frozen snapshot remains readable; mutation fails closed.
5. Unexpected identity freezes that bus’s DIP; no freeze-store files.
6. Mute remains hear-only and distinct from freeze/halt.
7. T2 OTEL distinguishes recommend-stop, freeze, and halt.
8. G7 package does not authorize G8–G10.

## Ownership (settled)

SCM DIP (on the bus) owns freeze/halt. SCM bridge obeys. T2 OTEL records.
No extra identity for telemetry alignment.

## Open plan choices

None that change law. Filename split (`g7HaltFreeze.ts` vs only `g6DipMute.ts`)
is plan-owned.

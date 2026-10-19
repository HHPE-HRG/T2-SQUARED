---
title: SCM G10 cutover and rollback design
date: 2026-10-18
status: design-definition-closed
plan: docs/superpowers/plans/2026-10-18-scm-g10-cutover-rollback.md
scope: G10 Increment 6 live fabric replacement and rollback
package: docs/scm/g10/
planning_input: docs/scm/g9/g9-to-g10-recon.md
writing_plans_authorized: true
implementation_authorized: false
g9toG10Authorized: false
---

# SCM G10 cutover and rollback design

<!-- Agent: G10 is live fabric replacement + rollback after G9 shadow equivalence.
It is not shadow capture, not a codec, not WORK-000035 losslessness.
Do not create apps/server/src/scm/g10*.ts until runtime auth.
Do not flip docs/scm/g8/manifest.json g9toG10Authorized from this design.
Restricted HHPE texts stay in /Users/maxholden/T2-SQUARED-References. -->

## Purpose

Complete Increment 6 so **chosen T2 modules communicate through the SCM
manifold** rather than only through wrapped Effect RPC and other live
transports, with **rollback** as a first-class part of the same campaign.

Prerequisite: G9 Mode B shadow-label parity (landed and exact-set proven).
G9 proves inventoried communications can be labeled beside live paths. G10
**replaces** those live paths for the cut-over surfaces.

Human authorization for runtime is **not** this file. Package
`docs/scm/g10/authorization.md` is created only when G10 is separately
authorized to build. Until then `g9toG10Authorized` stays false.

## Product law (binding)

From `docs/plans/2026-08-23-002-feat-scm-dod-gates-plan.md` §G10:

- Cutover/rollback only after G9 shadow equivalence.
- Do not replace Effect RPC in G5–G7; replacement is G10.
- Operational fabric DoD: chosen modules speak through the manifold.

OQ7 narrow live-projection shortcut is **closed**: this design is full
Increment 6 cutover/rollback, not a one-surface MVP deferral.

## Campaign shape (steward-locked 2026-10-18)

- **1A — Full Increment 6.** All chosen surfaces are in scope.
- **2A — Per-surface slices** inside **one** definition workload and later
  **one** runtime session. Not multiple sessions to cut over platforms
  over time. Slices S0–S8 are the unit of cutover, dual-run exit, rollback
  drill, and proof.

## Existing constraints

- G0–G9 packages exist. G9 shadow stack may be reused (coordinator, FIFO,
  hearAs, DIP, waker, family A, Effect observe hooks, ledger/unions).
- Codec, nibble alphabet, dictionary, English encoding remain forbidden
  unless separately authorized.
- Ten buses only. Home-bus-link stays dormant. No eleventh bus.
- OTEL remains observational. SCM stays agnostic of campaign/workloads as
  product identity (G7 decisions stand).
- Restricted HHPE texts stay off-git.

## Chosen architecture

```text
pre-cutover (G9 Mode B default)
  live transport is authority
  optional shadow capture beside (T2CODE_SCM_G9_SHADOW)

per-slice cutover (G10, when runtime-authorized)
  admit → route → replace at named seams
  dual-run window: live + manifold until slice exit criteria
  dual-run exit: live path retired for that surface
  rollback: restore pre-cutover live path for that surface (or campaign)

S8 campaign close
  all slices exited dual-run
  full-campaign rollback drill proven
  G10 proof bar satisfied (not WP8 763)
```

G10 inverts G9 noninterference for cut-over surfaces: manifold failure on a
cut-over path may fail the live user-visible operation. That inversion is
**slice-local** and must be explicit in each slice DoD. Surfaces not yet
cut over keep G9 observe-beside semantics.

## Equality and IR

Cutover equivalence reuses `G9DeferredEquality` labels from G9. WORK-000035
losslessness remains deferred. Type-name substitution alone is not cutover
proof. Byte equality / codec claims stay out.

## False friends (from recon)

- Capture landings ≠ cut over (optional, post-success, live Exit unchanged).
- Complete G9 ≠ G10 ready.
- Effect patch observe hooks ≠ manifold fabric.
- Ledger `capture_module` ≠ every path already live-wired.
- Ten shadow buses under env ≠ “modules speak SCM.”
- G9 `authorization.md` ≠ later-gate unlock.
- Env-off shadow opt-out ≠ Increment 6 rollback drill.

## In scope

- Design and definition of cutover/rollback for surfaces mapped from G9
  WP5/WP6 live seams (orch, ws/settings, git/relay, provider, terminal,
  observability/Effect consumers, persistence/locals).
- Dual-run exit criteria per slice.
- Rollback model per slice and at campaign (S8).
- Proof bar distinct from WP8 763.
- Future runtime auth ceremony design (text only).

## Out of scope

- Runtime implementation in this design pass.
- Flipping `g9toG10Authorized` or writing `authorization.md`.
- Codec / nibble / dictionary.
- Activating home-bus-link or inventing an eleventh bus.
- Multi-session per-platform cutover campaigns.
- Copying restricted HHPE refs into git.

## Acceptance (definition)

Definition is closed when:

1. `docs/scm/g10/` ceremony + decisions + integration-readiness + cohesion
   - runtime-auth-ceremony text exist.
2. This design and the single S0–S8 plan exist under `docs/superpowers/`.
3. `definition-progress.md` seals definition-closed with runtime still
   unauthorized and G8 flag still false.

Runtime acceptance is **not** defined here beyond: each slice must prove
admit/route/replace, dual-run exit, rollback drill, and cutover equivalence
under `G9DeferredEquality` — never by replaying the 763 shadow marathon
alone.

## Hard locks

- `g9toG10Authorized: false` until separate human runtime ceremony.
- No `apps/server/src/scm/g10*` from definition alone.
- No codec/G10 claims from G9 shadow proof.
- HHPE drop-folder only on Mac.

## Binding package pointers

- Decisions: `docs/scm/g10/decisions.md`
- Slice matrix: `docs/scm/g10/integration-readiness.md`
- Cohesion: `docs/scm/g10/cross-slice-cohesion-index.md`
- Auth ceremony (future): `docs/scm/g10/runtime-auth-ceremony.md`
- Plan: `docs/superpowers/plans/2026-10-18-scm-g10-cutover-rollback.md`

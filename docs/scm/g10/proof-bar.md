# G10 proof bar

<!-- Agent: normative cutover/rollback proof shape. Not runtime. ≠ WP8 763. -->

- Date: 2026-10-18
- Unit: **H3**
- Plan: `docs/superpowers/plans/2026-10-18-scm-g10-cutover-rollback.md`
- Design: `docs/superpowers/specs/2026-10-18-scm-g10-cutover-rollback-design.md`
- Inventory: `docs/scm/g10/seam-inventory-completeness.md`
- `runtime_authorized`: **true**

## Purpose

Define what counts as **G10 proof** for each slice and for the campaign.
This bar is intentionally **not** the G9 WP8 763-fixture shadow marathon.

## Ordered proof (in-session)

Normative sequencing for the one-session campaign. Workers must not
“exit then restore” or arm inversion before restore is green. Campaign
**radius set** is defined in `session-runbook.md` §1 (inventory-authoritative;
not resized by these steps).

### S0 gate (before any S1–S7 fabric land)

`docs/scm/g10/evidence/S0-contracts.md` must record:

- substitution model
- per-slice rollback switch contract
- proof harness shape
- inversion **policy** (policy text only; inversion **not** armed)

S0 green is required before any S1–S7 admit/route/replace land.

### Per-slice sequence (S1–S7)

For each activatable slice, evidence order is **mandatory**:

1. admit/route/replace land (runtime)
2. **live-authoritative rehearsal** green (see below)
3. **cutover-equivalence** green under `G9DeferredEquality`
4. **rollback-drill** green (restore pre-cutover live; re-prove live authority)
5. **then** dual-run-exit (live path retired; manifold authority)
6. **then** noninterference-inversion acknowledgment may be marked **armed**

Dormant-preserved `INV-T2-SCM-HOME-BUS-LINK` is exempt from exit/inversion.

### Live-authoritative rehearsal

After land, **while live path remains authoritative** (pre-exit, inversion
not armed):

- Exercise dual-run observe / manifold-beside wiring on that slice’s
  inventoried seams **without** retiring live authority.
- Exercise the slice **rollback switch once** under live-authoritative
  conditions (restore land → re-prove live authority still holds).
- Record: `docs/scm/g10/evidence/S<n>-live-rehearsal.md` (definition name;
  body after auth).

Bridge between G9 Mode B observe-beside and Increment 6 inverted fabric:
real G10 seams, still non-inverted. Does **not** change the radius set.

### Forbidden under Ordered proof

- Dual-run exit before that slice’s live-rehearsal + ≡ + rollback-drill are green
- Inversion armed before that slice’s dual-run exit
- Treating rehearsal as dual-run exit or as inversion armed
- Using rehearsal (or any step) to drop `comm_id`s from the radius set
- S8 campaign close before every activatable S1–S7 slice completed the
  sequence above

See also `docs/scm/g10/session-runbook.md` §1–§2.

## Per-slice proof (S1–S7)

A slice is proven only when **all** of the following exist as evidence
artifacts (names frozen here; bodies land at runtime after auth), in the
**Ordered proof** sequence:

1. **Live-authoritative rehearsal record** — dual-run observe + one rollback
   switch cycle while live remains authority.
2. **Cutover equivalence package** — for every `comm_id` assigned to the
   slice in `seam-inventory-completeness.json`, show live-vs-manifold
   identity under `G9DeferredEquality` **after** admit/route/replace (not
   after optional capture-beside).
3. **Rollback drill record** — restore pre-cutover live path for the slice;
   re-prove live authority; no new halt controller; not merely unsetting
   `T2CODE_SCM_G9_SHADOW`.
4. **Dual-run exit record** — dated note that the pre-cutover live path for
   those rows is retired; manifold is authority (**only after** 1–3 green).
5. **Noninterference inversion acknowledgment** — cut-over path failure may
   fail the user-visible operation for that slice; may be marked **armed**
   only after dual-run exit.

Expected runtime evidence names (definition only):

- `docs/scm/g10/evidence/S<n>-live-rehearsal.md`
- `docs/scm/g10/evidence/S<n>-cutover-equivalence.md`
- `docs/scm/g10/evidence/S<n>-rollback-drill.md`
- `docs/scm/g10/evidence/S<n>-dual-run-exit.md`
- `docs/scm/g10/evidence/S<n>-noninterference-inversion.md`

## S0 proof

S0 proves **contracts only** (substitution model, rollback switch, harness
shape, inversion policy). No fabric claim. Evidence:

- `docs/scm/g10/evidence/S0-contracts.md`

S0 is the Ordered proof **S0 gate** above.

## S8 campaign proof

Campaign closes only when:

1. S1–S7 each have complete per-slice evidence packages **in Ordered proof
   sequence** (every activatable slice: live-rehearsal → ≡ → restore → exit →
   inversion armed) across the **defined radius set** (runbook §1).
2. **Cross-slice dual-run exit audit** — every activatable inventory `comm_id`
   (radius set; not dormant-preserved home-bus-link) is either exited on its
   owning slice, **lander-reopen-wired** at S8 on the sole lander (documented
   in the audit), or explicitly dormant-exempt. Lander-reopen-wired counts as
   exited-for-campaign; it does not resize the radius set.
3. **Full-campaign rollback drill** — restore pre-G10 live for all cut-over
   slices in one procedure.
4. **Aggregate cutover ≡** — campaign rollup under `G9DeferredEquality`;
   WORK-000035 still deferred.

Expected:

- `docs/scm/g10/evidence/S8-dual-run-exit-audit.md`
- `docs/scm/g10/evidence/S8-campaign-rollback-drill.md`
- `docs/scm/g10/evidence/S8-campaign-cutover-equivalence.md`

## Explicit forbids

- Closing any slice or S8 by replaying WP8 **763** shadow fixtures alone
- Counting G9 `captureOccurrence` successes as cutover proof
- Treating env-off of `T2CODE_SCM_G9_SHADOW` as Increment 6 rollback
- Treating Effect patch observe hooks as manifold fabric
- Treating ledger `capture_module` presence as “already live-wired cutover”
- Treating ten env-gated shadow buses as “modules speak SCM”
- Closing cutover ≡ by type-name substitution alone (must use
  `G9DeferredEquality` projections)
- Claiming codec / nibble / dictionary / eleventh bus
- Activating dormant `INV-T2-SCM-HOME-BUS-LINK` without separate steward auth
- Using G9 `authorization.md` as G10 unlock evidence
- Dual-run exit or inversion armed before that slice’s Ordered proof
  prerequisites (see **Ordered proof** above)
- Resizing the campaign radius set (OQ7, multi-session split, extra buses,
  or dropping `comm_id`s via “rehearsal scope”)

## Relation to G9 763

G9 Mode B exact-set proof is a **prerequisite** (shadow equivalence existed).
It is **never sufficient** for G10 slice or campaign close.

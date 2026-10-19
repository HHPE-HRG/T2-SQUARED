# Fabric-depth implementation authorization (DRAFT)

<!-- Agent: CEREMONY-READY DRAFT ONLY. Not durable unlock. Do not flip any
auth flag from this file. Human must rename/confirm in a separate ceremony
to `authorization.md` with validated body. -->

- campaign: Fabric-depth
- status: **DRAFT — not authorized**
- date: _pending ceremony_
- human: _pending_
- scope: Real manifold I/O + soft-fallback retirement across G10 radius set
  (73 activatable + 1 dormant-preserved); FD0–FD8 per
  `docs/scm/fabric-depth/session-runbook.md`

## Prerequisites (must be true at ceremony)

- G10 package `completed: true` with steward live evidence
  (`docs/scm/g10/evidence/live-cutover-2026-10-18.md`)
- Design + planning-scope + session-runbook accepted
- Ceremony checklist green (`ceremony-checklist.md`)

## Blast-radius / end-state acceptance (to be signed)

Authorizing Fabric-depth means accepting:

- Radius set **unchanged** from G10 inventory
- Real manifold I/O may fail user-visible ops after inversion arms
- Soft-fallback retirement removes pre-inversion live recovery post-exit
- Home-bus remains dormant; codec / eleventh bus / OQ7 remain out of scope

## Explicit non-unlocks (false friends)

These do **not** authorize Fabric-depth implement:

- G10 `authorization.md` / Increment 6 bridge cutover alone
- G10 `manifest.completed: true` alone
- This **DRAFT** file alone
- Auth-freeze close / next-large-campaign council majority alone
- WP8 763 / G9 shadow env-off
- Inventing numbered G11

## Durable unlock (ceremony only)

When human executes ceremony:

1. Replace this DRAFT with `docs/scm/fabric-depth/authorization.md`
2. Record human identity + date + accepted blast-radius text
3. Define any unlock flag the campaign needs (separate from
   `g9toG10Authorized` — do not overload G8/G10 flags)
4. Only then may Workers land `apps/server/src/scm` fabric-depth code

Until then: **no implement**.

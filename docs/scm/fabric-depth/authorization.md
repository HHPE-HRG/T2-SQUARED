# Fabric-depth implementation authorization

<!-- Agent: DURABLE unlock. Human ceremony 2026-10-19. Flip
fabricDepthAuthorized true in the same authorizing changeset. Do not
overload g9toG10Authorized. Not G11. -->

- campaign: Fabric-depth
- status: **authorized**
- date: 2026-10-19
- human: Max Holden
- ceremony: verbal approval in session (blast-radius / end-state accepted)
- scope: Real manifold I/O + soft-fallback retirement across G10 radius set
  (73 activatable + 1 dormant-preserved); FD0–FD8 per
  `docs/scm/fabric-depth/session-runbook.md`
- unlock_flag: `docs/scm/fabric-depth/manifest.json` → `fabricDepthAuthorized`
- process_env: `T2CODE_SCM_FABRIC_DEPTH` (distinct from `T2CODE_SCM_G10_CUTOVER`)

## Prerequisites (confirmed at ceremony)

- G10 package `completed: true` with steward live evidence
  (`docs/scm/g10/evidence/live-cutover-2026-10-18.md`)
- Design + planning-scope + session-runbook + **proof-bar** + **glossary** +
  **manifold-io-census** accepted
- Ceremony checklist docs-readiness green (`ceremony-checklist.md`)
- Wave-3 confirmation ledger all COVERED
  (`research/wave3-ceremony-gate-confirmation.md`) — ceremony-gate ledger
- Wave-4 definition research + confirmation all COVERED
  (`research/wave4-fabric-definition-councils.md`,
  `research/wave4-plan-confirmation-councils.md`) — post-batteries briefing

## Blast-radius / end-state acceptance (signed)

Max Holden verbally accepted authorizing Fabric-depth, including:

- Radius set **unchanged** from G10 inventory
- Real manifold I/O may fail user-visible ops after inversion arms
- Soft-fallback retirement removes soft live recovery post-exit when
  `g10.softFallback=retired` for that slice
- Home-bus remains dormant; codec / eleventh bus / OQ7 remain out of scope
- Process opt-in via `T2CODE_SCM_FABRIC_DEPTH` (not G10 cutover env)

## Explicit non-unlocks (false friends)

These do **not** authorize Fabric-depth implement:

- G10 `authorization.md` / Increment 6 bridge cutover alone
- G10 `manifest.completed: true` alone
- `authorization.DRAFT.md` alone (removed at this ceremony)
- `fabricDepthAuthorized: false` in manifest (pre-ceremony default)
- Auth-freeze close / next-large-campaign council majority alone
- WP8 763 / G9 shadow env-off / `T2CODE_SCM_G10_CUTOVER`
- Inventing numbered G11

## Durable unlock (executed)

1. This file replaces `authorization.DRAFT.md`
2. Human identity + date + blast-radius acceptance recorded above
3. `docs/scm/fabric-depth/manifest.json` `fabricDepthAuthorized` flipped to
   **true** in the **same** authorizing changeset (does **not** overload
   `g9toG10Authorized`)
4. Workers may land Fabric-depth code under `T2CODE_SCM_FABRIC_DEPTH` against
   `docs/scm/fabric-depth/proof-bar.md`

This file is the durable source of Fabric-depth implement authorization.

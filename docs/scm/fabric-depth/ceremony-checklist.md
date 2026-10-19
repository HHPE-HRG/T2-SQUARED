# Fabric-depth ceremony checklist (draft)

<!-- Agent: mirror G10 runtime-auth-ceremony preconditions. Not a substitute
for authorization.md. Checklist alone does not unlock. -->

- Date: 2026-10-18
- Status: **pre-ceremony** (1B charter only)

## Preconditions (all required before human unlock)

- [x] G10 live Ordered proof GREEN (`docs/scm/g10/evidence/live-cutover-2026-10-18.md`)
- [x] G10 `manifest.completed: true`
- [x] Fabric-depth `design.md` present
- [x] Fabric-depth `planning-scope.md` present (non-unlocks explicit)
- [x] Fabric-depth `session-runbook.md` present (FD0–FD8 draft)
- [x] `authorization.DRAFT.md` present (not yet durable)
- [ ] Human accepts blast-radius / end-state magnitude in ceremony
- [ ] Human creates durable `authorization.md` (rename/confirm DRAFT)
- [ ] Any new unlock flag defined and flipped in the **same** authorizing
      changeset (do not overload `g9toG10Authorized`)
- [ ] Workers blocked until durable auth present

## Explicit hold

Implement remains **blocked**. Stewards may iterate charter docs only until
ceremony executes.

# Fabric-depth ceremony checklist

<!-- Agent: docs readiness vs human unlock. Ceremony complete 2026-10-19. -->

- Date: 2026-10-19
- Status: **ceremony complete** (durable unlock present)

## Docs readiness (Battery A–E)

- [x] G10 live Ordered proof GREEN (`docs/scm/g10/evidence/live-cutover-2026-10-18.md`)
- [x] G10 `manifest.completed: true`
- [x] Fabric-depth `design.md` present (+ bridge purity / ownership)
- [x] Fabric-depth `planning-scope.md` present (env + non-unlocks)
- [x] Fabric-depth `session-runbook.md` present (points at proof-bar)
- [x] Durable `authorization.md` present (DRAFT promoted at ceremony)
- [x] `manifest.json` with `fabricDepthAuthorized: true`
- [x] `glossary.md` speech lock
- [x] `proof-bar.md` binding Ordered depth
- [x] `ops/soft-fallback-signal.md`
- [x] `evidence/manifold-io-census.json` + `.md`
- [x] Wave-3 confirmation all COVERED (`research/wave3-ceremony-gate-confirmation.md`)

## Human unlock (ceremony — complete)

- [x] Human accepts blast-radius / end-state magnitude in ceremony
- [x] Human creates durable `authorization.md` (rename/confirm DRAFT)
- [x] Flip `fabricDepthAuthorized: true` in the **same** authorizing changeset
- [x] Workers unblocked: durable auth present

## Post-ceremony

Implement is **authorized** under `T2CODE_SCM_FABRIC_DEPTH` against
`proof-bar.md`. FD0+ may start. Do not invent G11.

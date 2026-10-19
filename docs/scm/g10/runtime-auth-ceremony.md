# G10 runtime authorization ceremony

<!-- Agent: ceremony design + execution record. authorization.md + g9toG10Authorized
are the durable unlocks. This file is not a substitute for authorization.md. -->

- Date: 2026-10-18
- Unit: **U5** (+ DENY residual D3 checklist/template)
- Status: **ceremony executed** 2026-10-18 (human: Max Holden)

## Purpose

Document how G10 runtime is unlocked, mirroring G9 RFC-021/022 patterns and
the G8 later-gate boolean.

## Preconditions (all required)

1. G9 Mode B remains landed/proven (`docs/scm/g9/definition-progress.md`).
2. G10 definition remains closed (`docs/scm/g10/definition-progress.md`).
3. Human operator decides to authorize **runtime** for slices S0–S8 in one
   session (not a partial OQ7 shortcut).

## Pre-ceremony checklist (docs readiness)

Checked at ceremony execution (unlock is `authorization.md` + flag flip, not
these boxes alone):

- [x] G9 Mode B green (`docs/scm/g9/definition-progress.md` + G9 auth present)
- [x] G10 definition closed (`definition_status: closed`)
- [x] Wave-2 adversarial seal pass (`docs/scm/g10/adversarial-findings.md`)
- [x] Session runbook accepted (`docs/scm/g10/session-runbook.md` §1
      **Campaign radius (defined)** + §2 barrier order)
- [x] Campaign radius definition + live-authoritative rehearsal Ordered
      proof accepted (`session-runbook.md` §1; `proof-bar.md` Ordered proof
      land → live-rehearsal → ≡ → restore → exit → inversion)
- [x] Auth council ledger present (`docs/scm/g10/auth-council.md`); human
      overrode minority blast-radius DENY (wave-4 B3) / accepted end-state
      magnitude explicitly
- [x] `docs/scm/g10/authorization.md` was absent **before** the authorizing
      changeset
- [x] `docs/scm/g8/manifest.json` → `g9toG10Authorized: false` **before** the
      authorizing changeset

## Ceremony steps (executed)

1. **Human created** `docs/scm/g10/authorization.md` with validated body:
   - `gate: G10`
   - `date: 2026-10-18`
   - `human: Max Holden`
   - `scope:` Increment 6 cutover/rollback runtime (S0–S8 one session)
   - blast-radius / end-state magnitude acceptance + false-friend non-unlocks
2. **Human flipped** `docs/scm/g8/manifest.json` → `"g9toG10Authorized": true`
   in the **same** authorizing change set. G9 auth did not unlock this flag.
3. **Optional machine check:** no G10 regen/validator yet; durable source is
   `authorization.md` + G8 flag.
4. **Workers may now** create `apps/server/src/scm/g10*` and land live-path
   substitution per the plan and `session-runbook.md` Ordered proof.

## Explicit non-unlocks (still true)

These alone never authorized G10 and are not G10 proof or rollback:

- G9 `authorization.md` / Mode B exact-set / observe-beside
- G10 design-approval / planning-scope / definition-closed alone
- Adversarial `SEAL_PASS` alone
- Auth council AUTH majority alone
- WP8 763-fixture marathon alone
- `captureOccurrence` / capture-beside landings
- Unsetting `T2CODE_SCM_G9_SHADOW` (shadow env-off)

Home-bus-link remains dormant-preserved. Codec / eleventh bus out of scope.

## Rollback of ceremony (if human aborts before / during runtime)

- Delete or invalidate `docs/scm/g10/authorization.md`.
- Restore `g9toG10Authorized: false`.
- Leave definition package intact.

## Binding pointers

- Authorization: `docs/scm/g10/authorization.md`
- Package planning: `docs/scm/g10/planning-scope.md`
- Decisions: `docs/scm/g10/decisions.md`
- Plan: `docs/superpowers/plans/2026-10-18-scm-g10-cutover-rollback.md`
- Session runbook: `docs/scm/g10/session-runbook.md`
- Auth council: `docs/scm/g10/auth-council.md`
- G8 flag: `docs/scm/g8/manifest.json` (`g9toG10Authorized: true`)

# G10 implementation authorization

Human authorization for G10 Increment 6 cutover/rollback runtime.

- gate: G10
- date: 2026-10-18
- human: Max Holden
- scope: Increment 6 cutover/rollback runtime (S0–S8 one session)

Blast-radius acceptance: `docs/scm/g10/session-runbook.md` §1.

End-state magnitude accepted: full inventory-authoritative activatable
radius (73 activatable + 1 dormant-preserved of 74); Ordered proof and
live-authoritative rehearsal order risk; they do not resize the set.
Minority blast-radius DENY (wave-4 B3) overridden by this human acceptance.

### Explicit non-unlocks (false friends)

These do **not** authorize G10 runtime and are not G10 proof or rollback:

- G9 `authorization.md` / Mode B exact-set / observe-beside
- G10 design-approval / planning-scope / definition-closed alone
- Adversarial `SEAL_PASS` alone
- Auth council AUTH majority alone (wave-2/3/4 advisory)
- WP8 763-fixture marathon alone
- `captureOccurrence` / capture-beside landings
- Unsetting `T2CODE_SCM_G9_SHADOW` (shadow env-off)

Home-bus-link remains dormant-preserved. Codec / eleventh bus out of scope.

This file is the durable source of G10 runtime authorization. Flip
`docs/scm/g8/manifest.json` `g9toG10Authorized` to true in the same
authorizing change set. G9 auth did not unlock that flag.

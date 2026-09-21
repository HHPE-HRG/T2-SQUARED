# G8 clocks and framing parameters

Status: **completed** for this Increment 4 parameter slice. Human-authorized
2026-09-20 after G1, D5, and the G2 disposition record were already closed.
Package completeness here is **not** human A7 attestation.

The named producer is **`scm.fundamental-clock`**, implemented by
`apps/server/src/scm/g8SharedClock.ts` (same canonical gate file as G4/G5;
there is no `g8Ages.ts`). This is not a `node_id` and not a campaign identity.

**Age/repeat table** (`nextAges`): unsatisfied repeat does not bump
`request_age`; same `fundamental_state` increments `state_age`; a value
change resets that column only.

**Framing** (`docs/scm/g8/framing-parameters.json`): `modifier_start` and
`null` remain named placeholders. G8 does not assign wire values, nibbles,
or a codec. One word per active node per fundamental timestep. A process
interval is N fundamental timesteps.

**OTEL** observes `t2.scm.clock.advance`. It does not produce time.

Frozen/halted DIP buses are not advanced (G7). The clock does not override
DIP.

The home-bus `SharedFundamentalClock` precursor is this package.

## Later gates

G7 keeps `g8toG10Authorized: false`. This package uses
`g9toG10Authorized: false` and `doesNotAuthorizeLaterGates: true`.
**G9–G10 stay locked.**

## Non-goals

- G9 semantic parity, G10 live cutover
- codec / nibble alphabet / production encoding
- Kuato, D16 freeze store, production clock domains
- Binding G3 `halt_initiator` to `yes`

## Binding docs

- Human authorization: `docs/scm/g8/authorization.md`
- Binding decisions: `docs/scm/g8/decisions.md`
- Design: `docs/superpowers/specs/2026-09-20-scm-g8-clocks-framing-design.md`
- Plan: `docs/superpowers/plans/2026-09-20-scm-g8-clocks-framing.md`

README is explanatory. Not a reviewed-package digest.

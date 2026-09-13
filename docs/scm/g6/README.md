# G6 DIP mute (in-process hear path)

Status: **completed** for this DIP-mute prototype slice. Human-authorized
2026-09-11. Package completeness here is **not** human A7 attestation.

G6 applies **hear-only** mute on in-process receiving buses. Publish and
**bridge** forward stay unchanged. Steward DIP position mutation is in
scope; a muted peer may keep publishing.

## What this package is

- `mute-source` and `mute-modifiers` on `hear`, not on `read` / publish / bridge.
- Prototype **modifiers** on W1: semantic field for mute-modifiers proofs only
  (not codec or wire).
- Authority parent (`bus.scm.authority`) is unmutable. Same-or-lower mute is
  allowed; greater class fails closed at `setDip`.
- OTEL is observational (`t2.scm.dip.set`, `t2.scm.hear.muted`). It does not
  admit, route, or perform mute.

G4/G5 keep `g6toG10Authorized: false`. This package uses
`g7toG10Authorized: false` and `doesNotAuthorizeLaterGates: true`.

## Non-goals

These non-goals remain out of G6:

- G7 halt/freeze, G8 clocks, G9 semantic parity, G10 live cutover
- codec / nibble alphabet / production encoding
- Kuato mute advice
- durable DIP persistence/audit product
- claiming the home-bus link precursor is G6 by itself

## Binding docs

- Human authorization: `docs/scm/g6/authorization.md`
- Binding decisions: `docs/scm/g6/decisions.md`
- Design: `docs/superpowers/specs/2026-09-11-scm-g6-dip-mute-design.md`
- Plan: `docs/superpowers/plans/2026-09-12-scm-g6-dip-mute.md`

README is explanatory. Not a reviewed-package digest.

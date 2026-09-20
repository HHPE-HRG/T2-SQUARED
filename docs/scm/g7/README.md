# G7 halt vs 404 (DIP bus-level freeze/halt)

Status: **completed** for this halt/freeze prototype slice. Human-authorized
2026-09-20. Package completeness here is **not** human A7 attestation.

**DIP** owns freeze/halt as a bus-level position (`live` / `frozen` /
`halted`) on each receiving bus. The home-bus **bridge** obeys those
positions: it does not advance or destination-publish when source or dest
is frozen or halted. Mute remains hear-only (G6). Mute is not freeze.

There is **no campaign identity**, safety node, or OTEL-owned controller.
G7 does not add an SCM `node_id`.

**OTEL** observes after SCM decisions (`t2.scm.freeze`, `t2.scm.halt`,
`t2.scm.recommend_stop`). It does not set DIP.

**404 recommend-stop** is observational only. `node.observer.404` and
authority class observer cannot write freeze/halt. Recommend-stop does
not call `setBusPosition`.

Halt is per-bus: stopping two homes requires two DIP writes.

## Later gates

G4/G5 keep `g6toG10Authorized: false`. G6 keeps `g7toG10Authorized:
false`. This package uses `g8toG10Authorized: false` and
`doesNotAuthorizeLaterGates: true`. **G8–G10 stay locked.** G3
`halt_initiator` is never `yes`.

## Non-goals

- G8 clocks, G9 semantic parity, G10 live cutover
- codec / nibble alphabet / production encoding
- Kuato halt/recovery advice
- durable freeze-store product (D16)
- unfreeze/unhalt
- campaign or observer-owned halt

## Binding docs

- Human authorization: `docs/scm/g7/authorization.md`
- Binding decisions: `docs/scm/g7/decisions.md`
- Design: `docs/superpowers/specs/2026-09-20-scm-g7-halt-freeze-design.md`
- Plan: `docs/superpowers/plans/2026-09-20-scm-g7-halt-freeze.md`

README is explanatory. Not a reviewed-package digest.

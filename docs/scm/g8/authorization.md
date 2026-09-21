# G8 human authorization

Status: **authorized** (human operator, 2026-09-20). Package completeness:
**completed** for this clocks/framing slice (`docs/scm/g8/manifest.json`).
Not human A7 attestation.

## Blocker check (cleared)

Inherited G8 gates from `docs/plans/2026-08-23-002-feat-scm-dod-gates-plan.md`:

| Gate                                    | Status                     |
| --------------------------------------- | -------------------------- |
| D5 on current-canon (open-loop cadence) | closed (D5A)               |
| G1 (G1A + G1B)                          | `g1-closed`                |
| G2 pin disposition **record**           | completed (`docs/scm/g2/`) |

G2 still **defers** codec / nibble alphabet / production encode. That is not a
G8 start blocker; it remains a G8 **content** forbid.

`g8SharedClock.ts` is a home-bus precursor. It does not complete G8.

## Authorization

Human operator Max Holden authorizes G8 implementation work: Increment 4 clocks
and framing **parameters** on the in-process SCM surface (timestep-producer
name, age/repeat table, null/modifier-start parameters, framing). No new SCM
campaign/workload identity. No codec.

This authorization **overrides** prior text that G8 was unauthorized. It does
not authorize G9–G10, codec, Kuato, freeze-store product, or binding halt to a
G3 `halt_initiator: yes` node.

Do not flip G7 `g8toG10Authorized`. G8 authorization lives in this package.

## Still not authorized

- G9 semantic parity / shadow fabric claim
- G10 live cutover
- codec / nibble alphabet / wire encodings / dictionary membership
- Kuato / auto-recovery
- D16 freeze-store product

## Binding decisions

See `docs/scm/g8/decisions.md`.

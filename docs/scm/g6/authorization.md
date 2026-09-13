# G6 human authorization

Status: **authorized** (human operator, 2026-09-11). Not completed.

## Authorization

Human operator Max Holden authorizes G6 implementation work: stewarded DIP mute
law on in-process receiving buses, including proof of `mute-source` and
`mute-modifiers` using the existing two-home-bus communication surface.

This authorization **overrides** prior handoff / barrier text that said G6 was
unauthorized or that agents must stop before G6.

## Still not authorized

- G7 halt/freeze
- G8 clocks / framing parameters
- G9 semantic parity
- G10 live cutover
- codec / production encoding / nibble alphabet
- Kuato mute advice
- claiming `g6HomeBusLink` alone completes G6

G4/G5 manifests keep `g6toG10Authorized: false`. That compound flag is **not**
flipped. G6 authorization lives in this package, not by unlocking G7–G10.

## Binding decisions

See `docs/scm/g6/decisions.md`.

README is explanatory. Not a reviewed-package digest until G6 completion review.

# G7 human authorization

Status: **authorized** (human operator, 2026-09-20). Not completed.

## Authorization

Human operator Max Holden authorizes G7 implementation work: halt vs 404
separation and fail-closed freeze **behavior** on the in-process SCM prototype
(T2 safety extension relative to D11; source D10). Freeze/halt attach to each
bus’s **DIP** (bus-level position). The **bridge** obeys DIP. No new SCM
identity, campaign object, or OTEL-owned controller.

This authorization **overrides** prior text that G7 was unauthorized. It does
not authorize G8–G10, codec, freeze-store product, or binding halt to a G3
`halt_initiator: yes` node.

## Still not authorized

- G8 clocks / framing parameters
- G9 semantic parity
- G10 live cutover
- codec / production encoding / nibble alphabet
- Kuato halt/recovery advice
- durable freeze evidence-store product (D16)
- flipping G3 roster `halt_initiator` from `open`/`no` to `yes`
- flipping G4/G5 `g6toG10Authorized` or G6 `g7toG10Authorized`

G7 authorization lives in this package. Compound later-gate flags stay false.

## Binding decisions

See `docs/scm/g7/decisions.md`.

README is explanatory. Not a reviewed-package digest until G7 completion review.

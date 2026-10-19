# Fabric-depth design (draft)

<!-- Agent: product law for named Fabric-depth campaign. Not runtime auth.
Not implement. Not G11. -->

- Date: 2026-10-18
- Status: **draft** pending separate ceremony
- G10 baseline: Increment 6 bridge cutover package-complete

## Honest starting point

G10 sealed **authority selection** via `runG10SeamBridge`:

- not replaced → live only
- dual-run / rehearsal → live authoritative; optional observe-beside
- post dual-run-exit → manifold authoritative; if `!inversionArmed` and
  manifold fails → **soft fallback to live** (pre-inversion safety)

Many landers still pass observe/stub-shaped `manifoldEffect` carriers. That
is enough for bridge Ordered proof. It is **not** a second physical I/O bus
and not sole-I/O honesty after exit.

## End-state (authorized implement target after ceremony)

1. When authority is **manifold**, `manifoldEffect` performs the **same class
   of real seam I/O** the live path would (publish / offer / file / flag /
   transport as inventoried) — not record-only stubs.
2. After dual-run-exit + inversion armed, manifold failure **fails the user
   op** (already bridge law when inverted).
3. **Retire soft live fallback** for post-exit `!inverted` paths once every
   activatable seam in scope has real manifold I/O + Ordered depth proof —
   sole inverted recovery story.
4. Campaign **radius set unchanged** (G10 inventory-authoritative 73 + 1
   dormant). Home-bus stays dormant-preserved.

## Soft-fallback retirement plan

| Phase                 | Behavior                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| FD land per slice     | Real manifold I/O behind bridge; soft-fallback still allowed until depth Ordered green                                         |
| FD Ordered depth      | Rehearsal → ≡ → rollback → exit → arm inversion **with real I/O**                                                              |
| FD soft-fallback kill | After inversion armed and depth GREEN for that slice, remove `!inverted` soft live recovery for that slice’s bridge call sites |
| FD campaign close     | Audit that no activatable seam still soft-falls after exit; dormant home-bus exempt                                            |

## Non-goals (see planning-scope.md)

Codec / nibble / dictionary; home-bus activation; eleventh bus; OQ7 / radius
resize; Kuatos / freeze-store; G5–G8 `server.ts` entry promotion; inventing
G11; claiming G10 bridge alone was fabric-depth.

## Implement gate

No code lands until human ceremony promotes
`authorization.DRAFT.md` → durable `authorization.md` (and any unlock flag
the ceremony defines). Draft docs are not unlocks.

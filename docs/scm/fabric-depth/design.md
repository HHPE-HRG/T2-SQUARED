# Fabric-depth design

<!-- Agent: product law for named Fabric-depth campaign. Ceremony unlocked
2026-10-19. Not G11. -->

- Date: 2026-10-19
- Status: **authorized** charter (implement under `T2CODE_SCM_FABRIC_DEPTH`)
- G10 baseline: Increment 6 bridge cutover package-complete
- Unlock: `authorization.md` + `fabricDepthAuthorized: true`

## Honest starting point

G10 sealed **authority selection** via `runG10SeamBridge` (pure Effect
selector — does not mark dual-run-exit, resize radius, or invent G9 capture;
callers keep capture-beside on the Effects they pass):

- not replaced → live only
- dual-run / rehearsal → live authoritative; optional observe-beside
- post dual-run-exit → manifold authoritative; if `!inversionArmed` and
  manifold fails → **soft fallback to live** (pre-inversion safety)

Many landers still pass observe/stub-shaped `manifoldEffect` carriers
(see `evidence/manifold-io-census.md`). That is enough for G10 bridge Ordered
proof. It is **not** sole-I/O honesty after exit and not Fabric-depth.

Speech: use **fabric seams** / **G10 bridge** / **Fabric-depth**
(`glossary.md`) — never bare “fabric”.

## End-state (authorized implement target)

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

## Bridge purity + ownership

- Bridge remains selector-only; I/O lives in caller-supplied Effects.
- Exclusive `comm_id` ownership + sole-lander/handoff rules unchanged
  (`docs/scm/g10/cross-slice-cohesion-index.md`).
- S0 = contracts only (no fabric-seam land). S1–S7 = fabric-seam slices.
  S8 = campaign audit of frozen set.

## Implement gate

Ceremony complete 2026-10-19: durable `authorization.md` +
`manifest.json` `fabricDepthAuthorized: true`. Workers may land under
process env `T2CODE_SCM_FABRIC_DEPTH` against `proof-bar.md`. Do not invent
G11; do not overload `g9toG10Authorized`.

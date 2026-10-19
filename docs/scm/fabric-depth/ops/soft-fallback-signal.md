# Soft-fallback operator signal (Fabric-depth)

<!-- Agent: docs contract for operator-visible active|retired. Code later
after ceremony. Not G10 cutover env. -->

- Date: 2026-10-19
- Field: `g10.softFallback`
- Values: `active` | `retired`
- Scope: per fabric-seam slice id (`S1`…`S7`)
- Meaning: bridge soft-recovery state under `T2CODE_SCM_FABRIC_DEPTH` — whether
  post-exit soft live recovery is still allowed

## Intent

Operators must see whether soft live recovery after dual-run-exit is still
allowed (`active`) or retired (`retired`) after Fabric-depth Ordered depth.

## Contract (implement after ceremony)

1. Structured log / receipt field: `g10.softFallback=<active|retired>` with
   `slice=<Sn>` on each bridge authority decision after dual-run-exit.
2. **Pre-retire defaults (including G10 steady / post-inversion):** after
   dual-run-exit, emit `active` whether or not `inversionArmed` is true, until
   FD soft-fallback-retire GREEN for that slice. Do **not** gate `active` on
   `!inversionArmed`.
3. After FD soft-fallback-retire GREEN for a slice: emit `retired` and do not
   soft-fall to live on manifold failure for that slice.
4. **Rollback / `T2CODE_SCM_FABRIC_DEPTH` env-off:** must **re-emit**
   `g10.softFallback=active` for every slice restored to pre-depth live (not
   only prose “restore semantics”).
5. **Home-bus / dormant:** omit the field (proof-bar exempt) — operators must
   not hunt a missing `S6-dormant` signal.

## Env

`T2CODE_SCM_FABRIC_DEPTH` gates FD process presence. It does **not** reuse
`T2CODE_SCM_G10_CUTOVER`. Clearing FD env does not mean G9 shadow env-off.

## Evidence

Depth evidence must quote observed `active`→`retired` transition per slice
before FD8 close, and `retired`→`active` re-emit on rollback drills.

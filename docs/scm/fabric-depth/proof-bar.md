# Fabric-depth proof bar

<!-- Agent: binding Ordered depth law. Not G10 bridge harness. Not WP8 763.
Not runtime auth. Implement blocked until ceremony. -->

- Date: 2026-10-19
- Campaign: Fabric-depth
- Census: `evidence/manifold-io-census.md`
- Soft-fallback signal: `ops/soft-fallback-signal.md`
- Env: `T2CODE_SCM_FABRIC_DEPTH` (distinct from `T2CODE_SCM_G10_CUTOVER`)

## Purpose

Define what counts as **Fabric-depth proof** per FD slice and for campaign
close. G10 live-cutover GREEN / bridge harness GREEN / WP8 763 are **not**
Fabric-depth proof.

## I/O honesty prerequisite

Before a seam may enter Ordered depth exit:

1. Sole-lander census class is **real** (`manifold-io-census.json`).
2. `manifoldEffect` performs the same **inventoried verb class** as live
   (publish / offer / file / flag / spawn / transport as inventoried).
3. Outcome ≡ uses the campaign equality carrier (today
   `G9DeferredEquality` unless Equality-IR is separately authorized).

## Ordered depth sequence (FD1–FD7)

Mandatory order per activatable fabric-seam set owned by that FD slice:

1. **land** — real-manifold wiring on sole lander (census → real)
2. **live-authoritative depth rehearsal** — dual-run / live authority; real
   observe-beside allowed; soft-fallback may still be `active`
3. **cutover-equivalence** GREEN under equality carrier
4. **rollback-drill** GREEN (restore pre-depth live authority)
5. **dual-run-exit** — manifold authority
6. **arm-inversion** — manifold failure fails user op
7. **soft-fallback-retire** — set `g10.softFallback=retired` for that slice;
   remove `!inverted` soft live recovery for those bridge call sites

Do not exit, arm inversion, or retire soft-fallback before steps 1–4 are green.
Dormant home-bus: exempt from exit / inversion / soft-fallback retire.

## Soft-fallback retire gate

Retire only when:

- Ordered depth through arm-inversion GREEN for that slice
- Operator signal contract satisfied (`ops/soft-fallback-signal.md`)
- Every **sole-lander** census row for that slice’s activatable `comm_id`s is
  **real** (handoff stubs on non-lander slices do not block; missing sole-lander
  census row is a charter defect)

## Campaign close (FD8)

- Every activatable seam has lander census **real** + Ordered depth through
  soft-fallback-retire (or dormant-exempt)
- Aggregate ≡ under equality carrier; refuse 763-as-proof
- Campaign rollback restores pre-Fabric-depth live (bridge-complete G10)

## Explicit forbids

- G10 live evidence alone as Fabric-depth proof
- Harness-only GREEN without process-live depth drive under
  `T2CODE_SCM_FABRIC_DEPTH`
- WP8 763 marathon
- Soft-fallback retire while census is stub/observe
- Radius resize / home-bus activation / inventing G11

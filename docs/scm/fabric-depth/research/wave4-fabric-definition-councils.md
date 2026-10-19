# Wave 4 — Fabric definition research (4 isolated, post-batteries)

<!-- Agent: research wave only. Global cache: fabric-definition-cache-wave4.json.
Confirmation wave is separate context. Not authorization. -->

- Date: 2026-10-19
- Size: **4** isolated councils; no peer findings
- Global cache: `fabric-definition-cache-wave4.json` (+ agent-store mirror)
- Context: ceremony-gate charter already Wave-3 COVERED

## Councils

| ID    | Lens                | CACHE_KEY                            | Open Qs               |
| ----- | ------------------- | ------------------------------------ | --------------------- |
| W4-R1 | seam / I/O          | `fabric.def.w4.r1.seam-io`           | none                  |
| W4-R2 | product / DoD       | `fabric.def.w4.r2.product-dod`       | none                  |
| W4-R3 | runtime / ops       | `fabric.def.w4.r3.runtime-ops`       | 2 (dual-env; restart) |
| W4-R4 | vocabulary / radius | `fabric.def.w4.r4.vocabulary-radius` | none                  |

## Condensed consensus (orchestrator; not a fifth vote)

Same three-way split as Wave 1, now charter-locked:

1. **fabric seams** — inventory noun (S1–S7, frozen radius)
2. **G10 bridge** — sealed authority selector
3. **Fabric-depth** — named campaign: real I/O + soft-fallback retire; ceremony + `T2CODE_SCM_FABRIC_DEPTH`

Residual research open Qs (W4-R3 only): dual-env concurrency with G10 cutover; FD env restart vs hot toggle — **implement-time**, not ceremony blockers if confirmation accepts as deferred.

## Confirmation (separate context)

Ledger: `wave4-plan-confirmation-councils.md`. W4-C1–C3 all **COVERED**;
W4-R3 open Qs accepted as deferred implement-time.

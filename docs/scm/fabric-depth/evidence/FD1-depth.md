# FD1 depth evidence (Battery FD1 — S1)

<!-- Agent: Fabric-depth FD1 — Ordered depth through soft-fallback-retire GREEN
for S1 wired fabric seams. SETTINGS handoff stub only. Not G11. -->

- Date: 2026-10-19
- Battery: **FD1**
- Slice: **S1**
- Status: **GREEN**
- Env: `T2CODE_SCM_FABRIC_DEPTH` (distinct from `T2CODE_SCM_G10_CUTOVER`)
- Census: `manifold-io-census.json` (S1 sole-lander debt empty; SETTINGS handoff)

## Ordered depth sequence

| Step                 | Controller                                        | Verdict |
| -------------------- | ------------------------------------------------- | ------- |
| land                 | `createG10S1Controller.land`                      | GREEN   |
| live-rehearsal       | `liveRehearsal`                                   | GREEN   |
| cutover-equivalence  | `recordEquiv`                                     | GREEN   |
| rollback-drill       | `rollbackDrill`                                   | GREEN   |
| dual-run-exit        | `dualRunExit`                                     | GREEN   |
| arm-inversion        | `armInversion`                                    | GREEN   |
| soft-fallback-retire | `softFallbackRetire` → `recordSoftFallbackRetire` | GREEN   |

## Soft-fallback

- After dual-run-exit under FD: `g10.softFallback=active`
- After soft-fallback-retire: `g10.softFallback=retired`
- Evidence bodies emit `softFallback` on every Ordered-depth step
- Census path: `docs/scm/fabric-depth/evidence/manifold-io-census.json`

## Wired S1 seams (real manifold I/O)

- INV-T2-ORCH-EVENTS / INV-T2-ORCH-QUEUE (OrchestrationEngine)
- INV-T2-LIFECYCLE-EVENTS / INV-T2-PREVIEW-AUTO / INV-T2-PROJECT-QUEUE /
  INV-T2-VCS-EVENTS (capture modules)

## Explicit

- SETTINGS-EVENTS remains S1→S2 handoff stub (not dual-run-exit (a) from S1)
- Does not edit other slices’ lander files
- Does not invent G11
- Does not flip `g9toG10Authorized`
- Proof: `vp test run apps/server/src/scm/g10SliceS1.test.ts`

# FD3 depth evidence (Battery FD3 — S3)

<!-- Agent: Fabric-depth FD3 — S3 Ordered depth through soft-fallback-retire.
Sole-lander debt empty (TEL-DESKTOP-CONTROL handoff). No DesktopTelemetryReceiver
edits. Not G11. -->

- Date: 2026-10-19
- Battery: **FD3**
- Slice: **S3** (file / cloudflare / checkpoints + git/relay/peer fabric seams)
- Status: **GREEN**
- Env: `T2CODE_SCM_FABRIC_DEPTH=1` (distinct from `T2CODE_SCM_G10_CUTOVER`)
- Census: `evidence/manifold-io-census.json` (S3 sole-lander debt empty)

## Ordered depth sequence

| Step                 | Result | Notes                                                                 |
| -------------------- | ------ | --------------------------------------------------------------------- |
| land                 | GREEN  | admit/route/replace; 15 wired + TEL-DESKTOP-CONTROL handoff stub      |
| live-rehearsal       | GREEN  | dual-run observe; FILE-CHECKPOINTS / FLAG-CLOUDFLARED S8 reopen lands |
| cutover-equivalence  | GREEN  | 16 inventory pairs under `G9DeferredEquality`                         |
| rollback-drill       | GREEN  | `restorePreCutoverLive`; re-emit soft-fallback `active` under FD      |
| dual-run-exit        | GREEN  | manifold authority; `g10.softFallback=active` under FD                |
| arm-inversion        | GREEN  | `inversionArmed`; soft-fallback still `active` until retire           |
| soft-fallback-retire | GREEN  | `recordSoftFallbackRetire` + census gate → `retired`                  |

## Soft-fallback transition (observed)

1. After dual-run-exit under FD: `g10.softFallback=active slice=S3`
2. After arm-inversion: remains `active` (do not gate active on `!inversionArmed`)
3. After soft-fallback-retire: `g10.softFallback=retired slice=S3`
4. Census: TEL-DESKTOP-CONTROL is handoff stub only — does not block S3 retire

## Proof modules

| Artifact    | Path                                                       |
| ----------- | ---------------------------------------------------------- |
| Controller  | `apps/server/src/scm/g10SliceS3.ts` (`softFallbackRetire`) |
| Tests       | `apps/server/src/scm/g10SliceS3.test.ts` (FD env suite)    |
| Retire API  | `apps/server/src/scm/fabricDepthSoftFallback.ts`           |
| Census gate | `apps/server/src/scm/fabricDepthCensusGate.ts`             |

## Explicit

- Do **not** edit `DesktopTelemetryReceiver.ts` (S5 owns DESKTOP-IN / TEL-DESKTOP-CONTROL lander)
- S3 sole-lander debt EMPTY at FD3 start (no census flip required)
- Radius unchanged; home-bus dormant; **not G11**
- G10 Ordered proof without FD still ends at arm-inversion (6 steps)

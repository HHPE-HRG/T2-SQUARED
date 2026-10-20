# FD2 depth evidence (Battery FD2 — S2)

<!-- Agent: Fabric-depth FD2 — S2 Ordered depth through soft-fallback-retire.
FLAG-T3-OTEL lander promoted to real Config I/O on cli/config.ts. ORCH-LIVE
handoff stays with S6 (ws.ts not edited). Not G11. -->

- Date: 2026-10-19
- Battery: **FD2**
- Slice: **S2** (WS / settings / flags — FILE-SETTINGS, FLAG-SERVER-CONFIG,
  SETTINGS-EVENTS + FLAG-T3-OTEL lander)
- Status: **GREEN**
- Env: `T2CODE_SCM_FABRIC_DEPTH=1` (distinct from `T2CODE_SCM_G10_CUTOVER`)
- Census: `evidence/manifold-io-census.json` (`INV-T2-FLAG-T3-OTEL` / S2 → **real**)

## Ordered depth sequence

| Step                 | Result | Notes                                                                         |
| -------------------- | ------ | ----------------------------------------------------------------------------- |
| land                 | GREEN  | admit/route/replace; 3 wired + ORCH-LIVE handoff stub; FLAG-T3-OTEL S8 reopen |
| live-rehearsal       | GREEN  | dual-run observe on wired three                                               |
| cutover-equivalence  | GREEN  | 4 pairs (3 inventory + SETTINGS) under `G9DeferredEquality`                   |
| rollback-drill       | GREEN  | `restorePreCutoverLive`; re-emit soft-fallback `active` under FD              |
| dual-run-exit        | GREEN  | manifold authority; `g10.softFallback=active` under FD                        |
| arm-inversion        | GREEN  | `inversionArmed`; soft-fallback still `active` until retire                   |
| soft-fallback-retire | GREEN  | `recordSoftFallbackRetire` + census gate → `retired`                          |

## Soft-fallback transition (observed)

1. After dual-run-exit under FD: `g10.softFallback=active slice=S2`
2. After arm-inversion: remains `active` (do not gate active on `!inversionArmed`)
3. After soft-fallback-retire: `g10.softFallback=retired slice=S2`
4. Census: ORCH-LIVE is handoff stub only — does not block S2 retire; FLAG-T3-OTEL lander is **real**

## FLAG-T3-OTEL I/O honesty (FD2 land)

| Before                                            | After                                                     |
| ------------------------------------------------- | --------------------------------------------------------- |
| `Effect.succeed` passthrough of pre-resolved URLs | `FlagT3OtelEnv` Config (`T3CODE_OTLP_*`) inside bridge    |
| census `stub`                                     | census `real` — manifoldEffect reuses live Config resolve |

Bootstrap/persisted OTEL URL precedence remains **after** the bridge (not the
inventoriable flag verb). Equality A stays `{ comm_id: "resolved" }` only.

## Proof modules

| Artifact    | Path                                                       |
| ----------- | ---------------------------------------------------------- |
| Lander      | `apps/server/src/cli/config.ts` (`FlagT3OtelEnv` + bridge) |
| Controller  | `apps/server/src/scm/g10SliceS2.ts` (`softFallbackRetire`) |
| Tests       | `apps/server/src/scm/g10SliceS2.test.ts` (FD env suite)    |
| Retire API  | `apps/server/src/scm/fabricDepthSoftFallback.ts`           |
| Census gate | `apps/server/src/scm/fabricDepthCensusGate.ts`             |

## Explicit

- Do **not** edit `ws.ts` (S6 owns ORCH-LIVE lander)
- Do **not** edit `T2Observability.ts` (S6 owns FLAG-T2-OTEL)
- ORCH-LIVE remains handoff-deferred on S2
- Radius unchanged; home-bus dormant; **not G11**
- G10 Ordered proof without FD still ends at arm-inversion (6 steps)

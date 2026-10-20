# FD4 depth evidence (Battery FD4 — S4)

<!-- Agent: Fabric-depth FD4 — S4 Ordered depth through soft-fallback-retire.
Promoted five sole-lander stubs → real (CLAUDE / OPENCODE / FILE-LOGS event-log /
FILE-PROVIDER-SESSION cache / FLAG-CODEX-LAUNCH). Does not edit g10SliceS7.
Not G11. -->

- Date: 2026-10-19
- Battery: **FD4**
- Slice: **S4** (provider protocol / event-log / session cache + HTTP/MCP fabric seams)
- Status: **GREEN**
- Env: `T2CODE_SCM_FABRIC_DEPTH=1` (distinct from `T2CODE_SCM_G10_CUTOVER`)
- Census: `evidence/manifold-io-census.json` (S4 sole-lander debt empty after FD4)

## Census flips (sole-lander → real)

| `comm_id`                      | Lander                    | Manifold I/O                        |
| ------------------------------ | ------------------------- | ----------------------------------- |
| `INV-T2-PROVIDER-CLAUDE`       | `ClaudeAdapter.ts`        | `createQuery` inside `liveIo`       |
| `INV-T2-PROVIDER-OPENCODE`     | `opencodeRuntime.ts`      | `spawner.spawn` inside `liveIo`     |
| `INV-T2-FILE-LOGS`             | `ProviderEventLoggers.ts` | NDJSON store create inside `liveIo` |
| `INV-T2-FILE-PROVIDER-SESSION` | `providerStatusCache.ts`  | fs read/write inside `liveIo`       |
| `INV-T2-FLAG-CODEX-LAUNCH`     | `codexLaunchArgs.ts`      | sync resolve inside `liveIo`        |

Campaign census after FD4 (and peer batteries): **real 58 / stub 10**. S4
sole-lander debt empty. S7 FLAG-CODEX-LAUNCH row remains handoff stub
(non-blocking).

## Ordered depth sequence

| Step                 | Result | Notes                                                            |
| -------------------- | ------ | ---------------------------------------------------------------- |
| land                 | GREEN  | admit/route/replace; 16 wired inventory rows                     |
| live-rehearsal       | GREEN  | dual-run observe on sixteen wired seams                          |
| cutover-equivalence  | GREEN  | 16 inventory pairs under `G9DeferredEquality`                    |
| rollback-drill       | GREEN  | `restorePreCutoverLive`; re-emit soft-fallback `active` under FD |
| dual-run-exit        | GREEN  | manifold authority; `g10.softFallback=active` under FD           |
| arm-inversion        | GREEN  | `inversionArmed`; soft-fallback still `active` until retire      |
| soft-fallback-retire | GREEN  | `recordSoftFallbackRetire` + census gate → `retired`             |

## Soft-fallback transition (observed)

1. After dual-run-exit under FD: `g10.softFallback=active slice=S4`
2. After arm-inversion: remains `active` (do not gate active on `!inversionArmed`)
3. After soft-fallback-retire: `g10.softFallback=retired slice=S4`
4. Census: five former S4 sole-lander stubs are **real** — debt empty

## Proof modules

| Artifact    | Path                                                       |
| ----------- | ---------------------------------------------------------- |
| Controller  | `apps/server/src/scm/g10SliceS4.ts` (`softFallbackRetire`) |
| Tests       | `apps/server/src/scm/g10SliceS4.test.ts` (FD env suite)    |
| Retire API  | `apps/server/src/scm/fabricDepthSoftFallback.ts`           |
| Census gate | `apps/server/src/scm/fabricDepthCensusGate.ts`             |

## Explicit

- Do **not** edit `g10SliceS7.ts` (S7 owns FLAG-CODEX-LAUNCH inventory handoff; S4 owns lander)
- S4 sole-lander debt EMPTY after FD4 census flips
- Radius unchanged; home-bus dormant; **not G11**
- G10 Ordered proof without FD still ends at arm-inversion (6 steps)

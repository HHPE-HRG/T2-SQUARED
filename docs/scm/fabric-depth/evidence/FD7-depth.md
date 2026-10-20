# FD7 depth evidence (Battery FD7 — S7)

<!-- Agent: Fabric-depth FD7 — S7 soft-fallback retire after arm-inversion.
Sole-lander debt EMPTY (four handoff stubs). No G11. Does not edit foreign
landers (VcsDriver / relayClient / codexLaunchArgs / Manager). -->

- Date: 2026-10-19
- Battery: **FD7**
- Slice: **S7**
- Status: **GREEN**
- Env: `T2CODE_SCM_FABRIC_DEPTH=1` (distinct from `T2CODE_SCM_G10_CUTOVER`)
- Census: `manifold-io-census.json` (S7 sole-lander debt EMPTY)

## Delivered

| Item                                  | Module                                                    | Proof                                                                   |
| ------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| softFallbackRetire after armInversion | `apps/server/src/scm/g10SliceS7.ts`                       | `g10SliceS7.test.ts` (FD describe)                                      |
| Retire API                            | `recordSoftFallbackRetire` (`fabricDepthSoftFallback.ts`) | signal `g10.softFallback=retired slice=S7`                              |
| Census gate                           | handoff stubs non-blocking                                | FILE-CHECKPOINTS / FLAG-CLOUDFLARED / FLAG-CODEX-LAUNCH / FLAG-TERM-ENV |

## Ordered depth (S7 under FD)

```text
land → live-rehearsal → cutover-equivalence → rollback-drill
  → dual-run-exit → arm-inversion → soft-fallback-retire
```

`runFullOrderedProof` appends `soft-fallback-retire` only when
`T2CODE_SCM_FABRIC_DEPTH` is enabled. Without FD, G10 Ordered proof still ends
at arm-inversion (six bodies).

## Sole-lander debt

EMPTY for S7. The four inventory stubs are **handoff** rows owned elsewhere:

| comm_id                  | Lander slice | Module (do not edit from FD7)                        |
| ------------------------ | ------------ | ---------------------------------------------------- |
| INV-T2-FILE-CHECKPOINTS  | S3           | `apps/server/src/vcs/VcsDriver.ts`                   |
| INV-T2-FLAG-CLOUDFLARED  | S3           | `packages/shared/src/relayClient.ts`                 |
| INV-T2-FLAG-CODEX-LAUNCH | S4           | `apps/server/src/provider/Layers/codexLaunchArgs.ts` |
| INV-T2-FLAG-TERM-ENV     | S5           | `apps/server/src/terminal/Manager.ts`                |

Census sole-lander rows for S7 that are **real**: ATTACHMENTS, LOGS,
PROVIDER-SESSION, RUNTIME-STATE, SECRETS, USAGE-CACHE, WORKTREES. The four
stub rows are handoff-only (non-blocking). Controller still owns wired bridges
for PROJECT-READ / PROJECT-SQL / SQLITE (inventory activatable; not sole-lander
debt under the census gate).

## Explicit

- No G11
- No radius resize / home-bus activation
- No edits to VcsDriver, relayClient, codexLaunchArgs, or terminal/Manager
- `manifest.completed` remains false until FD8

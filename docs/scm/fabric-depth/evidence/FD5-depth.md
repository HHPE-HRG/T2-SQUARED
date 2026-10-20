# FD5 depth evidence (Battery FD5 — S5)

<!-- Agent: Fabric-depth FD5 — promote S5 sole-lander stubs to real manifold
I/O; soft-fallback-retire under T2CODE_SCM_FABRIC_DEPTH. Not G11. -->

- Date: 2026-10-19
- Battery: **FD5**
- Slice: **S5**
- Status: **GREEN**
- Env: `T2CODE_SCM_FABRIC_DEPTH` (distinct from `T2CODE_SCM_G10_CUTOVER`)
- Restart: required to toggle FD env (G10 Layer parity)

## Sole-landers promoted stub → real

| comm_id                 | Lander                        | Inventoriable I/O inside liveIo                                |
| ----------------------- | ----------------------------- | -------------------------------------------------------------- |
| `INV-T2-TEL-DESKTOP-IN` | `DesktopTelemetryReceiver.ts` | `decodeMessage` via `desktopInViaG10Bridge`                    |
| `INV-T2-TERM`           | `terminal/Manager.ts`         | PTY spawn / write / callback drain via `termPhaseViaG10Bridge` |
| `INV-T2-FLAG-TERM-ENV`  | `terminal/Manager.ts`         | `createTerminalSpawnEnv` via `flagTermEnvViaG10Bridge`         |

Pattern: `manifoldEffect` reuses the same live I/O Effect (g10SliceS1 /
`runWiredSuccessSeamViaG10Bridge` reuse-live pattern).

## Left handoff (not promoted)

| comm_id               | Why                                         |
| --------------------- | ------------------------------------------- |
| `INV-T2-TEL-NDJSON`   | S5→S6 handoff; S6 owns `T2Observability.ts` |
| `INV-T2-TEL-T3-TRACE` | S5→S6 handoff; S6 owns `Observability.ts`   |

## Ordered depth

1. land (real-manifold wiring)
2. live-authoritative depth rehearsal
3. cutover-equivalence
4. rollback-drill
5. dual-run-exit
6. arm-inversion
7. **soft-fallback-retire** → `g10.softFallback=retired slice=S5`

Proof: `apps/server/src/scm/g10SliceS5.test.ts` under FD env.

## Explicit

- No G11
- Did not edit `T2Observability.ts` / `Observability.ts` (S6)
- Census sole-lander debt for S5 empty (handoff stubs do not block)

# FD0 contracts evidence (Battery FD0)

<!-- Agent: Fabric-depth FD0 — env gate, soft-fallback signal/retire,
census gate. No fabric-seam I/O land. -->

- Date: 2026-10-19
- Battery: **FD0**
- Status: **GREEN**
- Env: `T2CODE_SCM_FABRIC_DEPTH` (distinct from `T2CODE_SCM_G10_CUTOVER`)
- Restart: required to toggle FD env (G10 Layer parity)

## Delivered

| Contract                      | Module                                                 | Proof                             |
| ----------------------------- | ------------------------------------------------------ | --------------------------------- |
| FD env gate                   | `apps/server/src/scm/fabricDepthBootstrap.ts`          | `fabricDepthBootstrap.test.ts`    |
| Soft-fallback active\|retired | `fabricDepthSoftFallback.ts` + `g10Types.softFallback` | `fabricDepthSoftFallback.test.ts` |
| Bridge retire = no soft-fall  | `g10SeamBridge.ts`                                     | soft-fallback tests               |
| Rollback re-emit active       | `g10Rollback.ts`                                       | soft-fallback tests               |
| Census sole-lander gate       | `fabricDepthCensusGate.ts`                             | `fabricDepthCensusGate.test.ts`   |

## Explicit

- No seam I/O promotion in FD0
- `manifest.completed` remains false
- Process-live depth needs **both** cutover + FD envs

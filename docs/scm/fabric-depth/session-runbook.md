# Fabric-depth session runbook

<!-- Agent: FD0–FD8 map. Binding Ordered depth in proof-bar.md. Not G11.
Ceremony unlocked 2026-10-19; FD0+ may start under T2CODE_SCM_FABRIC_DEPTH. -->

- Date: 2026-10-19
- Status: **authorized** (FD0+ may start)
- Radius: **unchanged** G10 inventory set (73 activatable + 1 dormant)
- Proof: `docs/scm/fabric-depth/proof-bar.md`
- Env: `T2CODE_SCM_FABRIC_DEPTH` (not `T2CODE_SCM_G10_CUTOVER`)
- Glossary: `docs/scm/fabric-depth/glossary.md`
- Census: `docs/scm/fabric-depth/evidence/manifold-io-census.md`

## Proposed slices

| ID  | Focus                                                   | Long-session intent                                                                          |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| FD0 | Contracts                                               | proof-bar + soft-fallback signal + census gate; no fabric-seam I/O land yet                  |
| FD1 | Orch / lifecycle / preview / project / VCS (S1 landers) | Real manifold I/O on S1-wired fabric seams                                                   |
| FD2 | WS / settings / flags (S2)                              | Real manifold on settings + FLAG-T3-OTEL lander path                                         |
| FD3 | File / cloudflare / checkpoints (S3)                    | Real manifold on file+flag landers                                                           |
| FD4 | Provider protocol / event-log / session cache (S4)      | Promote stub/capture landers → real                                                          |
| FD5 | Terminal / telemetry control (S5)                       | Promote TERM / DESKTOP-IN / FLAG-TERM-ENV → real                                             |
| FD6 | WS ORCH-LIVE + Observability / NDJSON / T3-TRACE (S6)   | ORCH-LIVE already real on `ws.ts`; promote observe tel/OTLP landers → real; home-bus dormant |
| FD7 | Remaining FLAG / FILE residuals (S7)                    | Close leftover inventoriables                                                                |
| FD8 | Campaign close                                          | Soft-fallback retire audit; aggregate depth ≡; campaign rollback                             |

## Ordered depth proof (per FD1–FD7)

**Binding:** `docs/scm/fabric-depth/proof-bar.md` (not “detail at ceremony”).

```text
land real-manifold wiring (census → real)
  → live-authoritative depth rehearsal
  → cutover ≡
  → rollback drill
  → dual-run exit
  → arm inversion
  → soft-fallback retirement (g10.softFallback=retired)
```

Dormant home-bus-link: exempt from exit/inversion/soft-fallback retire.

## Barriers

- Do not start FD1 before FD0 contracts green (durable ceremony auth present)
- Do not retire soft-fallback before that slice’s depth Ordered + inversion
- Do not start depth exit while lander census class is stub/observe
- Do not resize radius
- Do not treat G10 live-cutover evidence alone as Fabric-depth proof

## Abort

- Per-slice: restore pre-depth live authority via rollback switch
- Campaign: full restore to G10 bridge-complete live
- Ceremony abort: invalidate Fabric-depth `authorization.md` if present;
  restore `fabricDepthAuthorized: false`

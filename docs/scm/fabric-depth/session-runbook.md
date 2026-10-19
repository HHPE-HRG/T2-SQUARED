# Fabric-depth session runbook (draft)

<!-- Agent: proposed multi-slice map. Not binding until ceremony. Not G11. -->

- Date: 2026-10-18
- Status: **draft** (~8 long slices; adjust at ceremony)
- Radius: **unchanged** G10 inventory set (73 activatable + 1 dormant)

## Proposed slices

| ID  | Focus                                                   | Long-session intent                                                       |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| FD0 | Contracts                                               | Depth proof harness; soft-fallback retirement contract; no fabric I/O yet |
| FD1 | Orch / lifecycle / preview / project / VCS (S1 landers) | Real manifold I/O on S1-wired seams                                       |
| FD2 | WS / settings / flags (S2)                              | Real manifold on settings + FLAG-T3-OTEL lander path                      |
| FD3 | File / cloudflare / checkpoints (S3)                    | Real manifold on file+flag landers                                        |
| FD4 | Provider protocol / event-log / session cache (S4)      | Real manifold on provider landers                                         |
| FD5 | Terminal / telemetry control (S5)                       | Real manifold on terminal + TEL control                                   |
| FD6 | Observability / NDJSON / T3-TRACE (S6)                  | Real manifold on tel + obs landers; home-bus stays dormant                |
| FD7 | Remaining FLAG / FILE residuals (S7)                    | Real manifold on leftover inventoriables                                  |
| FD8 | Campaign close                                          | Soft-fallback kill audit; aggregate depth ≡; campaign rollback            |

## Ordered depth proof (per FD1–FD7)

Draft sequence (mirrors G10 Ordered shape; detail at ceremony):

```text
land real-manifold wiring
  → live-authoritative depth rehearsal (live still authority or dual-run)
  → cutover ≡ (G9DeferredEquality or successor Equality-IR if unlocked)
  → rollback drill
  → dual-run exit
  → arm inversion
  → soft-fallback retirement for that slice
```

Dormant home-bus-link: exempt from exit/inversion/soft-fallback kill.

## Barriers

- Do not start FD1 before FD0 contracts green + ceremony auth present
- Do not kill soft-fallback before that slice’s depth Ordered + inversion
- Do not resize radius
- Do not treat G10 live-cutover evidence alone as Fabric-depth proof

## Abort

- Per-slice: restore pre-depth live authority via rollback switch
- Campaign: full restore to G10 bridge-complete live
- Ceremony abort: invalidate Fabric-depth `authorization.md` if present

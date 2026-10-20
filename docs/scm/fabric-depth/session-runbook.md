# Fabric-depth session runbook

<!-- Agent: FD0–FD8 map. Binding Ordered depth in proof-bar.md. Not G11.
Campaign completed 2026-10-19 under T2CODE_SCM_FABRIC_DEPTH. -->

- Date: 2026-10-19
- Status: **completed** (`manifest.completed: true`)
- Radius: **unchanged** G10 inventory set (73 activatable + 1 dormant)
- Proof: `docs/scm/fabric-depth/proof-bar.md`
- Env: `T2CODE_SCM_FABRIC_DEPTH` (not `T2CODE_SCM_G10_CUTOVER`)
- Glossary: `docs/scm/fabric-depth/glossary.md`
- Census: `docs/scm/fabric-depth/evidence/manifold-io-census.md`
- Close: `docs/scm/fabric-depth/evidence/FD8-campaign-close.md`

## Slices (one battery each — all GREEN)

| ID  | Focus                                           | Status                                       |
| --- | ----------------------------------------------- | -------------------------------------------- |
| FD0 | Contracts                                       | **GREEN** — `evidence/FD0-contracts.md`      |
| FD1 | Orch / lifecycle / preview / project / VCS (S1) | **GREEN** — `evidence/FD1-depth.md`          |
| FD2 | WS / settings / FLAG-T3-OTEL (S2)               | **GREEN** — `evidence/FD2-depth.md`          |
| FD3 | File / cloudflare / checkpoints (S3)            | **GREEN** — `evidence/FD3-depth.md`          |
| FD4 | Provider / event-log / session cache (S4)       | **GREEN** — `evidence/FD4-depth.md`          |
| FD5 | Terminal / telemetry control (S5)               | **GREEN** — `evidence/FD5-depth.md`          |
| FD6 | ORCH-LIVE + Observability / NDJSON / TRACE (S6) | **GREEN** — `evidence/FD6-depth.md`          |
| FD7 | Remaining FLAG / FILE residuals (S7)            | **GREEN** — `evidence/FD7-depth.md`          |
| FD8 | Campaign close                                  | **GREEN** — `evidence/FD8-campaign-close.md` |

## Ordered depth proof (per FD1–FD7)

**Binding:** `docs/scm/fabric-depth/proof-bar.md`.

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

## Barriers (held)

- FD0 before FD1–FD7; FD8 after all soft-fallback-retire GREEN
- No exit/retire while sole-lander census stub/observe
- No radius resize; no home-bus activation; no invent G11
- G10 live-cutover alone is not Fabric-depth proof

## Abort

- Per-slice: restore pre-depth live authority via rollback switch
- Campaign: full restore to G10 bridge-complete live; re-emit `g10.softFallback=active`
- Ceremony abort: invalidate Fabric-depth `authorization.md`; restore `fabricDepthAuthorized: false`

# G10 integration readiness (slice matrix)

<!-- Agent: definition only. Maps surfaces to seams, cutover, rollback, proof. Not runtime. -->

- Date: 2026-10-18
- Plan: `docs/superpowers/plans/2026-10-18-scm-g10-cutover-rollback.md`
- Design: `docs/superpowers/specs/2026-10-18-scm-g10-cutover-rollback-design.md`
- Decisions: `docs/scm/g10/decisions.md`
- G9 seam inventory (read-only): `docs/scm/g9/integration-readiness.md`, `docs/scm/g9/wp5/`
- G10 seam completeness: `docs/scm/g10/seam-inventory-completeness.md` (**74/74**)
- Proof bar: `docs/scm/g10/proof-bar.md`
- Session runbook: `docs/scm/g10/session-runbook.md`
- `runtime_authorized`: **true** (`authorization.md` + `g9toG10Authorized`)

## Campaign barriers

1. **S0** definition (and later runtime land) before S1–S7.
2. **S1–S7** may be defined in parallel after S0 freeze; sole owners per
   serial hotspot (see cohesion index).
3. **S8** last: campaign dual-run exit, full rollback drill, G10 proof bar.
4. **Runtime session order** (after ceremony): follow
   `docs/scm/g10/session-runbook.md` §1 defined campaign radius + §2 Ordered
   proof gates (S0 green → per slice land → **live-authoritative rehearsal** →
   ≡ → restore → exit → arm inversion → S8); radius neither shrinks nor
   expands; normative detail in `proof-bar.md` **Ordered proof**.

## Slice matrix

| Slice | Surface                          | G9 origin (capture sites)                                                                                                | Cutover behavior (definition)                                                                                                                                      | Dual-run exit                                    | Rollback drill                                                                                                      | Proof (≠ 763)                                                                        |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| S0    | Foundation contracts             | G9 coordinator / bootstrap / `G9CaptureService` shape                                                                    | Define substitution model, rollback switch contract, proof harness shape                                                                                           | N/A (contracts only)                             | Contract: restore live-default Layer                                                                                | Contract tests named in plan; no fabric claim yet                                    |
| S1    | Orch events + queue              | B1 / Slice: `OrchestrationEngine.ts` ORCH-EVENTS + ORCH-QUEUE                                                            | Admit/route/replace at Engine publish + queue offer seams                                                                                                          | Live Engine path retired for cut-over orch comms | Re-enable pre-cutover Engine publish/offer                                                                          | Cutover ≡ on orch rows via `G9DeferredEquality`                                      |
| S2    | WS + server settings             | ORCH-LIVE + FILE-SETTINGS + FLAG-SERVER-CONFIG; `ws.ts` via **S6 lander** + S2 handoff; settings/`cli/config` S2 lander  | Replace liveBuffer/settings I/O authority with manifold (≠ capture-beside)                                                                                         | Live ws/settings path retired for those rows     | Restore liveBuffer/settings I/O                                                                                     | Cutover ≡ under `G9DeferredEquality` on ORCH-LIVE + settings rows                    |
| S3    | Git + relay + B3 peers           | B3 (16 `comm_id`s): VcsDriver GIT; relay; HTTP-SERVE; editor/net/preview/SC/tailscale/TEL-\* per inventory               | Manifold for all 16 inventoried B3 rows; DesktopTelemetryReceiver handoff to S5                                                                                    | Live path retired for those 16 rows              | Restore lander files + accept S5 restore on DesktopTelemetryReceiver                                                | Cutover ≡ under `G9DeferredEquality` on all 16 S3 inventory rows                     |
| S4    | Provider + HTTP + MCP            | B4 (16): `provider/**`; `environmentHttp.ts` HTTP-\*; `http.ts` STATIC; `McpHttpServer`                                  | Manifold for all 16 S4 rows at those exact seams                                                                                                                   | Live path retired for those 16 rows              | Restore provider/HTTP/MCP live                                                                                      | Cutover ≡ under `G9DeferredEquality` on all 16 S4 inventory rows                     |
| S5    | Terminal + RES-MONITOR + TEL-in  | B5 (5): Manager TERM; NativeTelemetryClient RES-MONITOR; DesktopTelemetryReceiver; S6 handoffs NDJSON/T3-TRACE           | Manifold for all 5 S5 `comm_id`s                                                                                                                                   | Live path retired for those 5 rows               | Restore Manager + NativeTelemetryClient + DesktopTelemetryReceiver                                                  | Cutover ≡ under `G9DeferredEquality` on all 5 S5 inventory rows                      |
| S6    | Observability / Effect consumers | B6 + WP6: `T2Observability.ts`, `Observability.ts`, Effect patch consumers; FLAG-T3-OTEL → `cli/config.ts` handoff to S2 | Where rows cut over: manifold authority (not observe-only capture); inversion on RPC/OTLP/flag; export failure still non-mutating non-obs live                     | Observe-beside retired for cut-over obs rows     | Restore pre-cutover live/hook authority for activatable S6 rows; not shadow env-off; not re-arm capture-as-rollback | Cutover ≡ under `G9DeferredEquality` on activatable S6 rows; dormant home-bus exempt |
| S7    | Persistence / B2 remainder       | Exact 14 IDs in `seam-inventory-completeness.json` `per_slice_comm_ids.S7`                                               | Manifold at named S7 sole landers (Projection\*, NodeSqlite, Normalizer, config.ts, ProviderSessionRuntime, UsageService, GitVcsDriverCore, …) + S3/S4/S5 handoffs | Live path retired for those 14 rows              | Restore named lander files; foreign hotspots restore via landers                                                    | Cutover ≡ under `G9DeferredEquality` on all 14 S7 inventory rows                     |
| S8    | Campaign close                   | All slices                                                                                                               | Cross-slice dual-run exit audit; full-campaign rollback; G10 proof bar                                                                                             | All S1–S7 exited                                 | Campaign-wide restore to pre-G10 live                                                                               | Campaign proof package; explicitly not WP8 marathon                                  |

## Per-slice DoD checklist (normative text)

Each of S1–S7 must specify in the plan:

1. **Seams** — exact files/symbols (from G9 handoffs) where admit/route/replace lands.
2. **Admit / route / replace** — how manifold becomes authority (not post-success capture).
3. **Dual-run exit** — measurable criteria to retire live path.
4. **Rollback** — steps to restore live path without new halt controller.
5. **Proof** — cutover ≡ under `G9DeferredEquality` + rollback drill evidence.
6. **Noninterference inversion** — explicit: cut-over path may fail live user op.

## Global gates (definition)

- One session encompasses S0–S8.
- Ten buses; home-bus-link dormant.
- No codec claims.
- `g9toG10Authorized: true` (ceremony 2026-10-18).
- G9 763 is prerequisite evidence only.

## Serial hotspots (sole landers; handoffs for multi-slice files)

See `cross-slice-cohesion-index.md` for the normative lander/handoff table.
Summary:

| Hotspot                                                              | Sole lander | Handoffs from                                          |
| -------------------------------------------------------------------- | ----------- | ------------------------------------------------------ |
| `OrchestrationEngine.ts`                                             | S1          | —                                                      |
| `ws.ts`                                                              | S6          | S2 (ORCH-LIVE)                                         |
| `serverSettings` / `cli/config`                                      | S2          | S1 (SETTINGS-EVENTS); S6 (FLAG-T3-OTEL)                |
| VcsDriver / git                                                      | S3          | S7 (FILE-CHECKPOINTS)                                  |
| relayClient                                                          | S3          | S7 (FLAG-CLOUDFLARED)                                  |
| `provider/**` / MCP / environmentHttp / http.ts                      | S4          | S7 (providerStatusCache / logs / codex)                |
| `terminal/Manager.ts`                                                | S5          | S7 (FILE-LOGS terminalLogs, FLAG-TERM-ENV)             |
| `NativeTelemetryClient.ts`                                           | S5          | —                                                      |
| `DesktopTelemetryReceiver.ts`                                        | S5          | S3 (TEL-DESKTOP-CONTROL)                               |
| `T2Observability` / `Observability` / Effect                         | S6          | S5 (NDJSON, T3-TRACE)                                  |
| `apps/server/src/config.ts`                                          | S7          | — (≠ S2 `cli/config.ts`; FILE-LOGS dir + FILE-SECRETS) |
| `ProviderSessionRuntime.ts`                                          | S7          | —                                                      |
| `Projection*.ts` / NodeSqlite / ProjectionSnapshotQuery / Normalizer | S7          | —                                                      |
| ServerEnvironment / serverRuntimeState / Identify / keybindings      | S7          | —                                                      |
| `UsageService.ts` / `GitVcsDriverCore.ts`                            | S7          | —                                                      |
| S0 contracts / bootstrap                                             | S0          | —                                                      |
| S8 proof harness                                                     | S8          | —                                                      |

# G10 cross-slice cohesion index (U4)

<!-- Agent: definition only. Owner index + barriers. Not runtime. -->

- Date: 2026-10-18
- Unit: **U4** — Cross-slice interface and file-owner index
- Plan: `docs/superpowers/plans/2026-10-18-scm-g10-cutover-rollback.md`
- Matrix: `docs/scm/g10/integration-readiness.md`
- Inventory: `docs/scm/g10/seam-inventory-completeness.json`
- `runtime_authorized`: **true**

## Purpose

Keep S0–S8 as **one campaign**: shared contracts, exclusive `comm_id`
ownership, sole **file landers** with handoffs (G9 WP5 pattern), no split
multi-session cutover.

## Shared contracts (names freeze at definition)

| Contract                         | Owner slice         | Consumers                |
| -------------------------------- | ------------------- | ------------------------ |
| Cutover substitution Layer model | S0                  | S1–S7                    |
| Per-slice rollback switch        | S0                  | S1–S7, S8                |
| Campaign rollback                | S8                  | Operator / proof harness |
| Proof harness shape (≠ 763)      | S0 + S8             | All slices               |
| `G9DeferredEquality` reuse       | S0 (law)            | S1–S7 proof              |
| Noninterference inversion policy | S0 + each S1–S7 DoD | All cut-over surfaces    |
| Ten-bus / dormant home-bus-link  | Decisions           | All slices               |

## Ownership layers (normative)

1. **`comm_id` ownership** — exclusive; exactly one of S1–S7 per inventory
   (`double_owned: 0` at `comm_id` level).
2. **Serial file lander** — exactly one slice may **commit** cutover edits to
   a hotspot file. Other slices that own `comm_id`s on that file deliver
   **handoff patches** (docs now; runtime later). Mirror G9 WP5 handoffs.
3. `completeness.double_owned: 0` does **not** mean file hotspots are
   single-slice; multi-slice `hotspot_file` rows are resolved by landers below.

## Sole file landers (serial hotspots)

| File / area                                                                                               | Sole lander | Handoff-from (comm_id owners that must not commit)                                         |
| --------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| G10 foundation / bootstrap                                                                                | S0          | —                                                                                          |
| `OrchestrationEngine.ts`                                                                                  | S1          | —                                                                                          |
| `apps/server/src/ws.ts`                                                                                   | **S6**      | S2 (`INV-T2-ORCH-LIVE`)                                                                    |
| `apps/server/src/serverSettings.ts`                                                                       | **S2**      | S1 (`INV-T2-SETTINGS-EVENTS`)                                                              |
| `apps/server/src/cli/config.ts`                                                                           | **S2**      | S6 (`INV-T2-FLAG-T3-OTEL` — S6 owns `comm_id`, handoff only; does not commit)              |
| `apps/server/src/vcs/VcsDriver.ts`                                                                        | **S3**      | S7 (`INV-T2-FILE-CHECKPOINTS`)                                                             |
| `packages/shared/src/relayClient.ts`                                                                      | **S3**      | S7 (`INV-T2-FLAG-CLOUDFLARED`)                                                             |
| `apps/server/src/provider/**`                                                                             | **S4**      | S7 (FILE-PROVIDER-SESSION cache phases / FILE-LOGS provider-event-log / FLAG-CODEX-LAUNCH) |
| `apps/server/src/mcp/McpHttpServer.ts`                                                                    | **S4**      | —                                                                                          |
| `packages/contracts/src/environmentHttp.ts`                                                               | **S4**      | —                                                                                          |
| `apps/server/src/http.ts`                                                                                 | **S4**      | —                                                                                          |
| `apps/server/src/terminal/Manager.ts`                                                                     | **S5**      | S7 (`INV-T2-FILE-LOGS` terminalLogs, `INV-T2-FLAG-TERM-ENV`)                               |
| `apps/server/src/resourceTelemetry/NativeTelemetryClient.ts`                                              | **S5**      | —                                                                                          |
| `DesktopTelemetryReceiver.ts`                                                                             | **S5**      | S3 (`INV-T2-TEL-DESKTOP-CONTROL`)                                                          |
| `T2Observability.ts`                                                                                      | **S6**      | S5 (`INV-T2-TEL-NDJSON`)                                                                   |
| `Observability.ts`                                                                                        | **S6**      | S5 (`INV-T2-TEL-T3-TRACE`)                                                                 |
| `apps/server/src/config.ts` (FILE-LOGS dir + serverLogPath + FILE-SECRETS)                                | **S7**      | — (distinct from S2 `cli/config.ts`)                                                       |
| `apps/server/src/persistence/ProviderSessionRuntime.ts`                                                   | **S7**      | —                                                                                          |
| `persistence/Services/Projection*.ts` (PROJECT-SQL)                                                       | **S7**      | —                                                                                          |
| `persistence/NodeSqliteClient.ts`                                                                         | **S7**      | —                                                                                          |
| `orchestration/Services/ProjectionSnapshotQuery.ts`                                                       | **S7**      | —                                                                                          |
| `orchestration/Normalizer.ts`                                                                             | **S7**      | —                                                                                          |
| `environment/ServerEnvironment.ts` / `serverRuntimeState.ts` / `telemetry/Identify.ts` / `keybindings.ts` | **S7**      | —                                                                                          |
| `usage/UsageService.ts`                                                                                   | **S7**      | —                                                                                          |
| `vcs/GitVcsDriverCore.ts`                                                                                 | **S7**      | —                                                                                          |
| Campaign proof harness                                                                                    | S8          | consume only                                                                               |

Handoffs are **docs only** until runtime auth (mirror
`docs/scm/g9/wp5/handoffs/`).

## Barriers

```text
S0 freeze
  → parallel definition of S1–S7 (comm_id owners + lander rules)
  → S8 campaign close definition
```

Runtime (later): landers serialize hotspot commits; handoff authors do not
commit the hotspot file. No slice claims campaign complete before S8.

## Cohesion checks

- [x] Every inventoried G9 `comm_id` maps to exactly one of S1–S7 (**74/74**).
- [x] Serial hotspots have exactly one lander; multi-slice files use handoffs
      (table above; not “unchecked collision”).
- [x] Dual-run exit and rollback vocabulary match `decisions.md`.
- [x] Proof vocabulary forbids WP8-763-alone close (`proof-bar.md`).
- [x] Campaign remains one session.
- [x] Ceremony executed: `authorization.md` present; `g9toG10Authorized: true`.

## Hardening pointers

- Inventory: `docs/scm/g10/seam-inventory-completeness.md`
- Proof bar: `docs/scm/g10/proof-bar.md`
- Adversarial charter: `docs/scm/g10/adversarial-review-charter.md`

## Forbidden claims

- Codec / nibble / dictionary
- Eleventh bus / home-bus-link activation without steward auth
- G9 auth unlocks G10
- Capture ≡ cutover
- `comm_id` exclusivity implies file exclusivity without lander/handoff rules

# S8 dual-run-exit audit

<!-- Agent: G10 S8 campaign close. Every radius-set activatable + dormant exempt. -->

- Date: 2026-10-18
- Slice: **S8**
- Activatable: **73**
- Dormant-exempt: **1**
- Radius unchanged: `true`
- Home-bus dormant: `true`
- Machine: `buildDualRunExitAudit` / `g10SliceS8.ts`

## Disposition summary

| Kind                     | Count |
| ------------------------ | ----: |
| exited-owning-slice      |    63 |
| exited-lander            |     5 |
| lander-reopen-wired (S8) |     5 |
| dormant-exempt           |     1 |

## Activatable + dormant rows (74)

| comm_id                        | owning     | disposition         | lander                                                               | evidence                                                                   |
| ------------------------------ | ---------- | ------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `INV-T2-EDITOR-LAUNCH`         | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-FILE-ATTACHMENTS`      | S7         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S7-dual-run-exit.md                                  |
| `INV-T2-FILE-CHECKPOINTS`      | S7         | lander-reopen-wired | S3 (`apps/server/src/vcs/VcsDriver.ts`)                              | fileCheckpointsViaG10Bridge + G10_S3_FILE_CHECKPOINTS_HANDOFF_FROM_S7      |
| `INV-T2-FILE-LOGS`             | S7         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S7-dual-run-exit.md                                  |
| `INV-T2-FILE-PROVIDER-SESSION` | S7         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S7-dual-run-exit.md                                  |
| `INV-T2-FILE-RUNTIME-STATE`    | S7         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S7-dual-run-exit.md                                  |
| `INV-T2-FILE-SECRETS`          | S7         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S7-dual-run-exit.md                                  |
| `INV-T2-FILE-SETTINGS`         | S2         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S2-dual-run-exit.md                                  |
| `INV-T2-FILE-USAGE-CACHE`      | S7         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S7-dual-run-exit.md                                  |
| `INV-T2-FILE-WORKTREES`        | S7         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S7-dual-run-exit.md                                  |
| `INV-T2-FLAG-CLOUDFLARED`      | S7         | lander-reopen-wired | S3 (`packages/shared/src/relayClient.ts`)                            | runViaOptionalG10S3SharedSeam + G10_S3_FLAG_CLOUDFLARED_HANDOFF_FROM_S7    |
| `INV-T2-FLAG-CODEX-LAUNCH`     | S7         | lander-reopen-wired | S4 (`apps/server/src/provider/Layers/codexLaunchArgs.ts`)            | flagCodexLaunchViaG10Bridge + G10_S4_FLAG_CODEX_LAUNCH_HANDOFF_FROM_S7     |
| `INV-T2-FLAG-SERVER-CONFIG`    | S2         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S2-dual-run-exit.md                                  |
| `INV-T2-FLAG-T2-OTEL`          | S6         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |
| `INV-T2-FLAG-T3-OTEL`          | S6         | lander-reopen-wired | S2 (`apps/server/src/cli/config.ts`)                                 | resolveFlagT3OtelViaG10Bridge + G10_S2_FLAG_T3_OTEL_HANDOFF_LANDED_FROM_S6 |
| `INV-T2-FLAG-TERM-ENV`         | S7         | lander-reopen-wired | S5 (`apps/server/src/terminal/Manager.ts`)                           | flagTermEnvViaG10Bridge + G10_S5_FLAG_TERM_ENV_HANDOFF_FROM_S7             |
| `INV-T2-GIT`                   | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-HTTP-AUTH`             | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-HTTP-CONNECT`          | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-HTTP-META`             | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-HTTP-ORCH`             | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-HTTP-PR`               | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-HTTP-SERVE`            | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-HTTP-STATIC`           | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-LIFECYCLE-EVENTS`      | S1         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S1-dual-run-exit.md                                  |
| `INV-T2-MCP-HTTP`              | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-NET-TCP`               | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-ORCH-EVENTS`           | S1         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S1-dual-run-exit.md                                  |
| `INV-T2-ORCH-LIVE`             | S2         | exited-lander       | S6 (`apps/server/src/ws.ts`)                                         | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |
| `INV-T2-ORCH-QUEUE`            | S1         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S1-dual-run-exit.md                                  |
| `INV-T2-ORCH-RPC`              | S6         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |
| `INV-T2-PREVIEW-AUTO`          | S1         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S1-dual-run-exit.md                                  |
| `INV-T2-PREVIEW-SCAN`          | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-PROJECT-QUEUE`         | S1         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S1-dual-run-exit.md                                  |
| `INV-T2-PROJECT-READ`          | S7         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S7-dual-run-exit.md                                  |
| `INV-T2-PROJECT-SETUP`         | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-PROJECT-SQL`           | S7         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S7-dual-run-exit.md                                  |
| `INV-T2-PROVIDER-CLAUDE`       | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-PROVIDER-CODEX`        | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-PROVIDER-CURSOR`       | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-PROVIDER-EVENTS`       | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-PROVIDER-GROK`         | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-PROVIDER-LIST-EVENTS`  | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-PROVIDER-OPENCODE`     | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-PROVIDER-PERM`         | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-PROVIDER-TURN`         | S4         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S4-dual-run-exit.md                                  |
| `INV-T2-RELAY-AWARENESS`       | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-RELAY-CLIENT`          | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-RELAY-HTTP`            | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-RES-MONITOR`           | S5         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S5-dual-run-exit.md                                  |
| `INV-T2-RPC-STREAM-AUTH`       | S6         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |
| `INV-T2-RPC-STREAM-CONFIG`     | S6         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |
| `INV-T2-RPC-STREAM-DISCOVERY`  | S6         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |
| `INV-T2-RPC-STREAM-ORCH`       | S6         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |
| `INV-T2-RPC-STREAM-TEL`        | S6         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |
| `INV-T2-RPC-STREAM-TERM`       | S6         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |
| `INV-T2-RPC-WS`                | S6         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |
| `INV-T2-SC-ADO`                | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-SC-BITBUCKET`          | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-SC-GITHUB`             | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-SC-GITLAB`             | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-SETTINGS-EVENTS`       | S1         | exited-lander       | S2 (`apps/server/src/serverSettings.ts`)                             | docs/scm/g10/evidence/S2-dual-run-exit.md                                  |
| `INV-T2-SQLITE`                | S7         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S7-dual-run-exit.md                                  |
| `INV-T2-TAILSCALE`             | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-TEL-ANALYTICS`         | S3         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S3-dual-run-exit.md                                  |
| `INV-T2-TEL-DESKTOP-CONTROL`   | S3         | exited-lander       | S5 (`apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts`) | docs/scm/g10/evidence/S5-dual-run-exit.md                                  |
| `INV-T2-TEL-DESKTOP-IN`        | S5         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S5-dual-run-exit.md                                  |
| `INV-T2-TEL-NDJSON`            | S5         | exited-lander       | S6 (`apps/server/src/t2Observability/T2Observability.ts`)            | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |
| `INV-T2-TEL-T2-OTLP`           | S6         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |
| `INV-T2-TEL-T3-OTLP`           | S6         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |
| `INV-T2-TEL-T3-TRACE`          | S5         | exited-lander       | S6 (`apps/server/src/observability/Layers/Observability.ts`)         | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |
| `INV-T2-TERM`                  | S5         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S5-dual-run-exit.md                                  |
| `INV-T2-VCS-EVENTS`            | S1         | exited-owning-slice | —                                                                    | docs/scm/g10/evidence/S1-dual-run-exit.md                                  |
| `INV-T2-SCM-HOME-BUS-LINK`     | S6-dormant | dormant-exempt      | —                                                                    | docs/scm/g10/evidence/S6-dual-run-exit.md                                  |

## Phase residuals (operator accept → auth-freeze landed)

Parent `comm_id`s already completed Ordered proof exit (a) on S7 for wired
phases. Auth-freeze wired these foreign-phase handoffs on sole landers:

| comm_id                        | phase                                   | lander                         | handoff                                               |
| ------------------------------ | --------------------------------------- | ------------------------------ | ----------------------------------------------------- |
| `INV-T2-FILE-LOGS`             | `providerEventLogPath-writer-succeeded` | S4 (`ProviderEventLoggers.ts`) | **landed** `S7-FILE-LOGS-provider-event-log-to-S4.md` |
| `INV-T2-FILE-LOGS`             | `terminalLogs-writer-succeeded`         | S5 (`Manager.ts`)              | **landed** `S7-FILE-LOGS-terminalLogs-to-S5.md`       |
| `INV-T2-FILE-PROVIDER-SESSION` | providerStatusCache read/write          | S4 (`providerStatusCache.ts`)  | **landed** `S7-FILE-PROVIDER-SESSION-to-S4.md`        |

## Operator accept

Phase residuals accepted at S8 campaign close; **wired at auth-freeze**. Critical
full-row residuals (FLAG-T3-OTEL, FILE-CHECKPOINTS, FLAG-CLOUDFLARED,
FLAG-CODEX-LAUNCH, FLAG-TERM-ENV) remain **lander-reopen-wired** at S8.
Owning-slice historical dual-run-exit packages remain stub-honest for those
rows.

## Explicitly not

- WP8 763-fixture-as-G10-proof
- Radius resize / home-bus activation / codec / eleventh bus

## Verdict

**GREEN** — 73 activatable dispositioned + 1 dormant-exempt; phase residuals accepted.

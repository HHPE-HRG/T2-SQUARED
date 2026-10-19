# G10 seam inventory completeness

<!-- Agent: 74/74 ledger→slice join. Not runtime. Not authorization. -->

- Date: 2026-10-18
- Unit: **H1**
- Machine companion: `docs/scm/g10/seam-inventory-completeness.json`
- Ledger: `docs/scm/g9/coverage-ledger.json` (74 `comm_id`, 184 phases)
- Bundle authority: `docs/scm/g9/wp5/bundle-index.md` + WP5 plan B1–B6 / WP6 lists

## Verdict

- **74/74 assigned** (`comm_id_count`=74, `phase_count`=184)
- Orphans: **0**; double-owned: **0**
- Per-slice counts: `{'S1': 7, 'S2': 3, 'S3': 16, 'S4': 16, 'S5': 5, 'S6': 13, 'S7': 14}`

## Assignment rules

- `B1_except_ORCH_LIVE` → S1
- `INV-T2-ORCH-LIVE` → S2
- `B2_FILE_SETTINGS_FLAG_SERVER_CONFIG` → S2
- `B2_FLAG_T2_T3_OTEL` → S6
- `B2_remainder` → S7
- `B3` → S3
- `B4` → S4
- `B5` → S5
- `B6_and_WP6` → S6
- `HOME_BUS_LINK` → S6 dormant-preserved no activation

## Per-slice `comm_id` assignment

### S1 (7 `comm_id`s)

| comm_id                   | g9_bundle | sample hotspot                                                | cutover |
| ------------------------- | --------- | ------------------------------------------------------------- | ------- |
| `INV-T2-LIFECYCLE-EVENTS` | B1        | `apps/server/src/serverLifecycleEvents.ts`                    | planned |
| `INV-T2-ORCH-EVENTS`      | B1        | `apps/server/src/orchestration`                               | planned |
| `INV-T2-ORCH-QUEUE`       | B1        | `apps/server/src/orchestration/Layers/OrchestrationEngine.ts` | planned |
| `INV-T2-PREVIEW-AUTO`     | B1        | `apps/server/src/mcp/PreviewAutomationBroker.ts`              | planned |
| `INV-T2-PROJECT-QUEUE`    | B1        | `apps/server/src/orchestration/Layers/ProjectionPipeline.ts`  | planned |
| `INV-T2-SETTINGS-EVENTS`  | B1        | `apps/server/src/serverSettings.ts`                           | planned |
| `INV-T2-VCS-EVENTS`       | B1        | `apps/server/src/vcs/VcsStatusBroadcaster.ts`                 | planned |

### S2 (3 `comm_id`s)

| comm_id                     | g9_bundle | sample hotspot                      | cutover |
| --------------------------- | --------- | ----------------------------------- | ------- |
| `INV-T2-FILE-SETTINGS`      | B2        | `apps/server/src/serverSettings.ts` | planned |
| `INV-T2-FLAG-SERVER-CONFIG` | B2        | `apps/server/src/cli/config.ts`     | planned |
| `INV-T2-ORCH-LIVE`          | B1        | `apps/server/src/ws.ts`             | planned |

### S3 (16 `comm_id`s)

| comm_id                      | g9_bundle | sample hotspot                                                  | cutover |
| ---------------------------- | --------- | --------------------------------------------------------------- | ------- |
| `INV-T2-EDITOR-LAUNCH`       | B3        | `apps/server/src/process/externalLauncher.ts`                   | planned |
| `INV-T2-GIT`                 | B3        | `apps/server/src/vcs/VcsDriver.ts`                              | planned |
| `INV-T2-HTTP-SERVE`          | B3        | `apps/server/src/serverRuntimeStartup.ts`                       | planned |
| `INV-T2-NET-TCP`             | B3        | `packages/shared/src/Net.ts`                                    | planned |
| `INV-T2-PREVIEW-SCAN`        | B3        | `apps/server/src/preview/PortScanner.ts`                        | planned |
| `INV-T2-PROJECT-SETUP`       | B3        | `apps/server/src/project/ProjectSetupScriptRunner.ts`           | planned |
| `INV-T2-RELAY-AWARENESS`     | B3        | `apps/server/src/relay/AgentAwarenessRelay.ts`                  | planned |
| `INV-T2-RELAY-CLIENT`        | B3        | `packages/shared/src/relayClient.ts`                            | planned |
| `INV-T2-RELAY-HTTP`          | B3        | `apps/server/src/cloud/http.ts`                                 | planned |
| `INV-T2-SC-ADO`              | B3        | `apps/server/src/sourceControl/AzureDevOpsCli.ts`               | planned |
| `INV-T2-SC-BITBUCKET`        | B3        | `apps/server/src/sourceControl/BitbucketApi.ts`                 | planned |
| `INV-T2-SC-GITHUB`           | B3        | `apps/server/src/sourceControl/GitHubCli.ts`                    | planned |
| `INV-T2-SC-GITLAB`           | B3        | `apps/server/src/sourceControl/GitLabCli.ts`                    | planned |
| `INV-T2-TAILSCALE`           | B3        | `packages/tailscale/src/tailscale.ts`                           | planned |
| `INV-T2-TEL-ANALYTICS`       | B3        | `apps/server/src/telemetry/AnalyticsService.ts`                 | planned |
| `INV-T2-TEL-DESKTOP-CONTROL` | B3        | `apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts` | planned |

### S4 (16 `comm_id`s)

| comm_id                       | g9_bundle | sample hotspot                                                              | cutover |
| ----------------------------- | --------- | --------------------------------------------------------------------------- | ------- |
| `INV-T2-HTTP-AUTH`            | B4        | `packages/contracts/src/environmentHttp.ts#EnvironmentAuthHttpApi`          | planned |
| `INV-T2-HTTP-CONNECT`         | B4        | `packages/contracts/src/environmentHttp.ts#EnvironmentConnectHttpApi`       | planned |
| `INV-T2-HTTP-META`            | B4        | `packages/contracts/src/environmentHttp.ts#EnvironmentMetadataHttpApi`      | planned |
| `INV-T2-HTTP-ORCH`            | B4        | `packages/contracts/src/environmentHttp.ts#EnvironmentOrchestrationHttpApi` | planned |
| `INV-T2-HTTP-PR`              | B4        | `packages/contracts/src/environmentHttp.ts#EnvironmentPullRequestsHttpApi`  | planned |
| `INV-T2-HTTP-STATIC`          | B4        | `apps/server/src/http.ts`                                                   | planned |
| `INV-T2-MCP-HTTP`             | B4        | `apps/server/src/mcp/McpHttpServer.ts`                                      | planned |
| `INV-T2-PROVIDER-CLAUDE`      | B4        | `apps/server/src/provider/Layers/ClaudeAdapter.ts`                          | planned |
| `INV-T2-PROVIDER-CODEX`       | B4        | `apps/server/src/provider/Layers/CodexSessionRuntime.ts`                    | planned |
| `INV-T2-PROVIDER-CURSOR`      | B4        | `apps/server/src/provider/acp/AcpSessionRuntime.ts`                         | planned |
| `INV-T2-PROVIDER-EVENTS`      | B4        | `apps/server/src/provider`                                                  | planned |
| `INV-T2-PROVIDER-GROK`        | B4        | `apps/server/src/provider/acp/AcpSessionRuntime.ts`                         | planned |
| `INV-T2-PROVIDER-LIST-EVENTS` | B4        | `apps/server/src/provider/Layers/ProviderRegistry.ts`                       | planned |
| `INV-T2-PROVIDER-OPENCODE`    | B4        | `apps/server/src/provider/opencodeRuntime.ts`                               | planned |
| `INV-T2-PROVIDER-PERM`        | B4        | `apps/server/src/provider/acp/AcpSessionRuntime.ts`                         | planned |
| `INV-T2-PROVIDER-TURN`        | B4        | `apps/server/src/provider/Layers/ProviderService.ts`                        | planned |

### S5 (5 `comm_id`s)

| comm_id                 | g9_bundle | sample hotspot                                                  | cutover |
| ----------------------- | --------- | --------------------------------------------------------------- | ------- |
| `INV-T2-RES-MONITOR`    | B5        | `apps/server/src/resourceTelemetry/NativeTelemetryClient.ts`    | planned |
| `INV-T2-TEL-DESKTOP-IN` | B5        | `apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts` | planned |
| `INV-T2-TEL-NDJSON`     | B5        | `apps/server/src/t2Observability/T2Observability.ts`            | planned |
| `INV-T2-TEL-T3-TRACE`   | B5        | `apps/server/src/observability/Layers/Observability.ts`         | planned |
| `INV-T2-TERM`           | B5        | `apps/server/src/terminal/Manager.ts`                           | planned |

### S6 (13 `comm_id`s)

| comm_id                       | g9_bundle | sample hotspot                                          | cutover           |
| ----------------------------- | --------- | ------------------------------------------------------- | ----------------- |
| `INV-T2-FLAG-T2-OTEL`         | B2        | `apps/server/src/t2Observability/T2Observability.ts`    | planned           |
| `INV-T2-FLAG-T3-OTEL`         | B2        | `apps/server/src/cli/config.ts`                         | planned           |
| `INV-T2-ORCH-RPC`             | WP6       | `apps/server/src/ws.ts`                                 | planned           |
| `INV-T2-RPC-STREAM-AUTH`      | WP6       | `apps/server/src/ws.ts`                                 | planned           |
| `INV-T2-RPC-STREAM-CONFIG`    | WP6       | `apps/server/src/ws.ts`                                 | planned           |
| `INV-T2-RPC-STREAM-DISCOVERY` | WP6       | `apps/server/src/ws.ts`                                 | planned           |
| `INV-T2-RPC-STREAM-ORCH`      | WP6       | `apps/server/src/ws.ts`                                 | planned           |
| `INV-T2-RPC-STREAM-TEL`       | WP6       | `apps/server/src/ws.ts`                                 | planned           |
| `INV-T2-RPC-STREAM-TERM`      | WP6       | `apps/server/src/ws.ts`                                 | planned           |
| `INV-T2-RPC-WS`               | WP6       | `apps/server/src/ws.ts`                                 | planned           |
| `INV-T2-SCM-HOME-BUS-LINK`    | B6        | `apps/server/src/scm/g6HomeBusLink.ts`                  | dormant-preserved |
| `INV-T2-TEL-T2-OTLP`          | WP6       | `apps/server/src/t2Observability/T2Observability.ts`    | planned           |
| `INV-T2-TEL-T3-OTLP`          | WP6       | `apps/server/src/observability/Layers/Observability.ts` | planned           |

### S7 (14 `comm_id`s)

| comm_id                        | g9_bundle | sample hotspot                                                      | cutover |
| ------------------------------ | --------- | ------------------------------------------------------------------- | ------- |
| `INV-T2-FILE-ATTACHMENTS`      | B2        | `apps/server/src/orchestration/Normalizer.ts`                       | planned |
| `INV-T2-FILE-CHECKPOINTS`      | B2        | `apps/server/src/vcs/VcsDriver.ts`                                  | planned |
| `INV-T2-FILE-LOGS`             | B2        | `apps/server/src/config.ts`                                         | planned |
| `INV-T2-FILE-PROVIDER-SESSION` | B2        | `apps/server/src/provider/providerStatusCache.ts`                   | planned |
| `INV-T2-FILE-RUNTIME-STATE`    | B2        | `apps/server/src/serverRuntimeState.ts`                             | planned |
| `INV-T2-FILE-SECRETS`          | B2        | `apps/server/src/config.ts`                                         | planned |
| `INV-T2-FILE-USAGE-CACHE`      | B2        | `apps/server/src/usage/UsageService.ts`                             | planned |
| `INV-T2-FILE-WORKTREES`        | B2        | `apps/server/src/vcs/GitVcsDriverCore.ts`                           | planned |
| `INV-T2-FLAG-CLOUDFLARED`      | B2        | `packages/shared/src/relayClient.ts`                                | planned |
| `INV-T2-FLAG-CODEX-LAUNCH`     | B2        | `apps/server/src/provider/Layers/codexLaunchArgs.ts`                | planned |
| `INV-T2-FLAG-TERM-ENV`         | B2        | `apps/server/src/terminal/Manager.ts`                               | planned |
| `INV-T2-PROJECT-READ`          | B2        | `apps/server/src/orchestration/Services/ProjectionSnapshotQuery.ts` | planned |
| `INV-T2-PROJECT-SQL`           | B2        | `apps/server/src/persistence/Services/ProjectionCheckpoints.ts`     | planned |
| `INV-T2-SQLITE`                | B2        | `apps/server/src/persistence/NodeSqliteClient.ts`                   | planned |

## Phase-level detail

Full 184-phase rows with `family`, `capture_module`, `capture_symbol` live in
`seam-inventory-completeness.json` → `phases[]`.

## Completeness checks

- [x] Every ledger `comm_id` assigned to exactly one of S1–S7
- [x] WP6 ten rows assigned (S6)
- [x] B6 home-bus-link on S6 with `dormant-preserved` (no activation)
- [x] S7 is B2 remainder after S2/S6 specializations only

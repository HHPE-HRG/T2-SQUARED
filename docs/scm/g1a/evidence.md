# G1A retained discovery results

Procedures: static inspection of `apps/server/src` plus T2-owned workspace packages **loaded into the server process**. No claim of an unknowable universe. G1B maps retained results to D15C row ids in `docs/scm/g1b/`. Coverage is per declared runtime variant, not Cartesian execution.

## Loaded workspace communication (host-boundary correction)

Inspected `apps/server/package.json` workspace deps and production imports.

| Package                         | Behavior-bearing communication found                                                                | Classes                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `@t3tools/contracts`            | Published RPC/HTTP schemas consumed by `ws.ts` / `http.ts`                                          | rpc-service-interfaces                        |
| `@t3tools/shared` `relayClient` | HTTP download of cloudflared; `ChildProcessSpawner` for the binary; `T3CODE_CLOUDFLARED_PATH`       | subprocess, external-transport, process-flags |
| `@t3tools/shared` `Net`         | TCP/port scan used by `server.ts`, `opencodeRuntime.ts`, `preview/PortScanner.ts`                   | external-transport                            |
| `@t3tools/shared` other         | git URL/label helpers, schema JSON, host-process labels: internal computation, not extra transports | (none as comm)                                |
| `@t3tools/tailscale`            | `ensureTailscaleServe` / `disableTailscaleServe` from `server.ts`                                   | subprocess, external-transport                |
| `effect-acp`                    | ACP JSON-RPC over stdio for Cursor and Grok (`AcpSessionRuntime.ts`)                                | subprocess, streams, callbacks                |
| `effect-codex-app-server`       | Codex app-server JSON-RPC over stdio (`CodexSessionRuntime.ts`)                                     | subprocess, streams, callbacks                |
| `@t3tools/web`                  | No `apps/server/src` import. Vite build-order only.                                                 | EX-WEB-BUILD                                  |

Peer client trees remain EX-CLIENT-RUNTIME. They are not the same as the loaded packages above.

## Provider / runtime variants (static)

Shipped drivers from `BUILT_IN_DRIVERS` (`apps/server/src/provider/builtInDrivers.ts`):

| Driver   | Transport inspected                                                                                                                        | Classes touched                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Codex    | `effect-codex-app-server` `app-server` stdio; `T3CODE_CODEX_LAUNCH_ARGS`; `CodexTextGeneration` CLI/`codex exec`                           | subprocess, streams, callbacks, process-flags, persistence   |
| Claude   | `@anthropic-ai/claude-agent-sdk` `query()` in `ClaudeAdapter.ts`; CLI probe via `ChildProcessSpawner` in `ClaudeDriver` / `ClaudeProvider` | subprocess, streams, callbacks, external-transport (SDK I/O) |
| Cursor   | ACP stdio (`agent acp`) via `effect-acp`                                                                                                   | subprocess, streams, callbacks                               |
| Grok     | ACP stdio (`grok agent stdio`) via `effect-acp`                                                                                            | subprocess, streams, callbacks                               |
| OpenCode | `opencodeRuntime.ts` spawn + `NetService`; `@opencode-ai/sdk`                                                                              | subprocess, streams, external-transport                      |

Unknown `ProviderDriverKind` values become unavailable snapshots. Extra instances of a shipped driver reuse that driver’s family.

## Proposed OTEL-path names

See `exclusions.md`. Summary:

- admission, evidence, authority: **no live T2-host communication discovered**. Production `withOwnedSpan` call sites: none. Tests only use `"t2.admission"`.
- ASD-STE100, work-registry: **no live T2-host communication discovered**; CLI trees EX-CLI-STE / EX-CLI-REGISTRY.
- realization/projection: **live**. `OrchestrationProjectionPipeline` and `ProjectionSnapshotQuery` used from `OrchestrationEngine.ts`, `ws.ts`, `serverRuntimeStartup.ts`, `relay/AgentAwarenessRelay.ts`. Cover under rpc, streams, queues, persistence as discovered.

## 1. rpc-service-interfaces

**Procedure:** read `packages/contracts/src/rpc.ts` (`WS_METHODS`, `WsRpcGroup`), `packages/contracts/src/orchestration.ts` (`ORCHESTRATION_WS_METHODS`), `packages/contracts/src/environmentHttp.ts` (`EnvironmentHttpApi` groups), and server handlers `apps/server/src/ws.ts`, `apps/server/src/http.ts`, `apps/server/src/auth/http.ts`, `apps/server/src/orchestration/http.ts`, `apps/server/src/pullRequest/http.ts`, `apps/server/src/cloud/http.ts`.

**Retained:**

- WebSocket RPC group `WsRpcGroup` in `apps/server/src/ws.ts` (Effect `RpcServer.toHttpEffectWebsocket`). Method catalog: `WS_METHODS` plus `ORCHESTRATION_WS_METHODS` (dispatch, workflow script, diffs, search, archived shell, subscribe shell/thread).
- Catalog wrap: `apps/server/src/observability/RpcInstrumentation.ts` uses `withCatalogBridge("rpc")` / `withCatalogBridgeStream("rpc")` for traced methods. Some methods disable tracing (`serverGetTraceDiagnostics`, `serverGetProcessDiagnostics`, `serverGetProcessResourceHistory`, `serverSignalProcess`).
- HTTP API `EnvironmentHttpApi` groups: `metadata`, `auth`, `orchestration`, `pullRequests`, `connect`. Endpoints include `/.well-known/t3/environment`, `/api/auth/*`, `/oauth/token`, `/api/orchestration/*`, `/api/pull-requests/diff`, `/api/connect/*`, `/api/t3-connect/*`.
- Projection snapshot reads over RPC/HTTP via `ProjectionSnapshotQuery` (shell/thread snapshots, search, archived shell).
- Enumerable OTEL registry (reconciliation only): `T2_CATALOG_BOUNDARIES` = `rpc`, `orchestration`, `provider-turn`, `git`, `sqlite`, `terminal`.

## 2. streams

**Procedure:** search `Stream.` / `stream: true` RPC and subscribe methods; terminal/preview attach streams; provider ACP/app-server stdio.

**Retained:**

- RPC streams: `subscribeVcsStatus`, `subscribeTerminalEvents`, `subscribeTerminalMetadata`, `subscribePreviewEvents`, `subscribeDiscoveredLocalServers`, `subscribeServerConfig`, `subscribeServerLifecycle`, `subscribeAuthAccess`, `subscribeBackgroundPolicy`, `subscribeResourceTelemetry`, `orchestration.subscribeShell`, `orchestration.subscribeThread`.
- Terminal PTY data stream (`terminal/Manager.ts` `onData`).
- Orchestration live buffers in `ws.ts` (`Queue` + `Stream` for thread/shell live items).
- Provider session event streams: Codex app-server, Claude SDK query stream, Cursor/Grok ACP session events.
- `withCatalogBridgeStream("rpc")` for traced RPC streams.

## 3. queues

**Procedure:** search `Queue.` and `PubSub.` in non-test `apps/server/src`.

**Retained (shipped):**

- `OrchestrationEngine` command `Queue` and event `PubSub` (`orchestration/Layers/OrchestrationEngine.ts`).
- `OrchestrationProjectionPipeline` (projection work queued from engine events).
- `ProviderService` runtime event `PubSub`.
- `VcsStatusBroadcaster` changes `PubSub`.
- `serverSettings` changes `PubSub`.
- `serverLifecycleEvents` `PubSub`.
- `ProviderRegistry` provider-list `PubSub`.
- `makeManagedServerProvider` provider `PubSub`.
- `ws.ts` live buffers (`Queue.unbounded`) bridging streams to RPC.
- `RuntimeReceiptBusLive` is a **no-op** publisher; `RuntimeReceiptBusTest` uses PubSub. Production does not retain or broadcast receipts (not live host communication). Test-only PubSub remains EX-TEST-PUBSUB.

No Redis or Kafka in `apps/server`. HHPE Redis / B0/Kafka seeds are empty; see EX-HHPE-REDIS / EX-HHPE-KAFKA.

## 4. callbacks

**Procedure:** search subscribe/callback installers that cross components (not DOM).

**Retained:**

- `terminalManager.subscribe` / `subscribeMetadata` / `attachStream` from `ws.ts`.
- PTY `onData` / `onExit` in `terminal/Manager.ts`.
- Provider permission/approval callbacks (ACP `session/request_permission`, Claude SDK callbacks, Codex app-server callbacks).
- `PreviewAutomationBroker` request/response (preview automation RPC).
- `subscribeBeforeSnapshot` helper over PubSub (`utils/subscribeBeforeSnapshot.ts`).

`withOwnedSpan` is a callback-shaped observer hook with **no complete name registry**. Production call sites: none found. Tests use `"t2.admission"`.

## 5. persistence

**Procedure:** search sqlite, state files from `deriveServerPaths`, NDJSON logs, provider session dirs, projection tables.

**Retained:**

- SQLite via `persistence/Layers/Sqlite.ts` / `NodeSqliteClient.ts`. Catalog wrap `withCatalogBridge("sqlite")` on execute paths.
- Projection SQL services consumed by `ProjectionSnapshotQuery.ts`.
- Derived files: `stateDir`, `dbPath`, `keybindingsConfigPath`, `settingsPath`, `providerStatusCacheDir`, `worktreesDir`, `attachmentsDir`, `logsDir`, `serverLogPath`, `serverTracePath`, `providerLogsDir`, `providerEventLogPath`, `terminalLogsDir`, `anonymousIdPath`, `environmentIdPath`, `serverRuntimeStatePath`, `secretsDir`.
- T2 observer file `t2.trace.ndjson` (`T2CODE_TRACE_FILE` or `logsDir`).
- Checkpoint store (`checkpointing/CheckpointStore.ts`).
- Provider session directory / runtime persistence (varies by driver).

## 6. process-flags

**Procedure:** search `process.env` and `ServerConfig` fields used to coordinate behavior across components (not test fakes).

**Retained:**

- `T2CODE_TRACE_FILE`, `T2CODE_OTLP_TRACES_URL`, `T2CODE_OTLP_SERVICE_NAME` (T2 observer).
- `T3CODE_OTLP_*`, `T3CODE_POSTHOG_*`, `T3CODE_TELEMETRY_*` (T3 observer / analytics).
- `ServerConfig.mode` (`web`/`desktop`), `startupPresentation`, `noBrowser`, `tailscaleServeEnabled`, `logWebSocketEvents`, `desktopBootstrapToken`, desktop telemetry FDs, `autoBootstrapProjectFromCwd`, `T3CODE_DEV_ALLOWED_ORIGINS`.
- Provider launch env: `T3CODE_CODEX_LAUNCH_ARGS`; `T3CODE_CLOUDFLARED_PATH`.
- Terminal env keys starting `T3CODE_` forwarded in `terminal/Manager.ts` (`T3CODE_PORT` stripped).

`T3_ACP_*` and ACP probe env are test/probe-only (not shipped discovery variants). Incidental `PATH` mutation in tests is excluded.

## 7. subprocess

**Procedure:** search PTY, `ProcessRunner`, git spawn, provider CLIs/ACP/app-server, Tailscale, resource monitor binary, loaded-package spawners.

**Retained:**

- `terminal/Manager.ts` via `PtyAdapter` / `ProcessRunner`.
- `vcs/GitVcsDriverCore.ts` git spawn; catalog wrap `withCatalogBridge("git")`.
- `vcs/VcsProcess.ts` + `ProcessRunner`.
- Provider subprocess families (static, per shipped driver): Codex app-server / `codex exec`; Claude CLI probe + Agent SDK child; Cursor `agent acp`; Grok `grok agent stdio`; OpenCode runtime spawn.
- Source-control CLIs: `GitHubCli`, `GitLabCli`, `AzureDevOpsCli` (ChildProcess spawn).
- `preview/PortScanner.ts` via `ProcessRunner`.
- `project/ProjectSetupScriptRunner.ts`.
- `@t3tools/tailscale` `ensureTailscaleServe` / `disableTailscaleServe`.
- `@t3tools/shared/relayClient` cloudflared spawn.
- `resourceTelemetry/ResourceMonitorBinary.ts`.
- `process/externalLauncher.ts` (editor launch).

## 8. external-transport

**Procedure:** search HTTP servers, WebSocket, OTLP export, MCP, cloud/relay, analytics, native telemetry FDs, HTTP APIs in loaded packages, Bitbucket HTTP.

**Retained:**

- WebSocket RPC (`ws.ts`) and HTTP `HttpRouter.serve` (`server.ts`).
- Auth/orchestration/PR/connect HTTP groups (see class 1). Static `staticDir` file serving (built web assets).
- **Negative control:** `apps/server/src/mcp/McpHttpServer.ts` (MCP HTTP; not in `T2_CATALOG_BOUNDARIES`; no `withCatalogBridge` in that file). Mounted from `server.ts`.
- Cloud connect / relay client (`cloud/http.ts`, `relay/AgentAwarenessRelay.ts`, `@t3tools/shared/relayClient` HTTP).
- T3 OTLP and T2 OTLP (`ObservabilityLive`, `T2ObservabilityLive`).
- Analytics (`telemetry/AnalyticsService.ts`).
- Desktop-host telemetry input and control output vs native resource-monitor protocol (`resourceTelemetry/DesktopTelemetryReceiver.ts`, `NativeTelemetryClient.ts`).
- MCP preview automation over HTTP (`PreviewAutomationBroker`).
- `BitbucketApi` (`apps/server/src/sourceControl/BitbucketApi.ts`): Effect `HttpClient` against Bitbucket HTTP API (`send` ~line 820). Class is **external-transport**, not subprocess.
- `@t3tools/shared/Net` TCP used by OpenCode runtime and port scan.
- Tailscale serve as a host/network binding (with subprocess above).

Provider HTTPS to model vendors is SDK/CLI I/O under the matching driver variant (catalog `provider-turn` on `ProviderService.sendTurn`).

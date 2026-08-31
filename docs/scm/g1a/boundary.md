# G1A frozen inventory boundary

Frozen: 2026-08-24 (corrected after A7 withhold). Non-shrinkable. Adding a mechanism class reopens G1A. Omitting a frozen class is forbidden.

## Host

Behavior-bearing communication that originates, terminates, or crosses a component boundary in the T2 server **process**:

1. `apps/server`
2. T2-owned / workspace packages **loaded into that process** (see table). Live communication implemented in those packages is in scope even when the file does not live under `apps/server`.

### Loaded workspace surfaces

Source: `apps/server/package.json` workspace deps plus production imports from `apps/server/src`.

| Package                              | How the server loads it                                                                                                                | G1A treatment                                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `@t3tools/contracts`                 | Runtime import of RPC/HTTP schemas (`rpc.ts`, `environmentHttp.ts`, …)                                                                 | In scope. Catalog of published interfaces.                                                                                                   |
| `@t3tools/shared`                    | Runtime import: `relayClient` (HTTP + `cloudflared` spawn), `Net` (TCP/port scan), git helpers, observability decode, CLI arg tokenize | In scope. Comm paths listed under subprocess / external-transport.                                                                           |
| `@t3tools/tailscale`                 | Runtime import `ensureTailscaleServe` / `disableTailscaleServe` from `server.ts`                                                       | In scope. Subprocess / external-transport.                                                                                                   |
| `effect-acp`                         | Runtime import from Cursor/Grok ACP adapters (`AcpSessionRuntime.ts`, `GrokAcpSupport.ts`, `CursorAcpSupport.ts`)                      | In scope. Provider ACP stdio JSON-RPC.                                                                                                       |
| `effect-codex-app-server`            | Runtime import from `CodexSessionRuntime.ts`                                                                                           | In scope. Codex app-server stdio JSON-RPC.                                                                                                   |
| `@t3tools/web`                       | **Not** imported by `apps/server/src`. Vite `dependsOn: ["@t3tools/web#build"]` only. Server may serve a **built** `staticDir`.        | Governed exclusion EX-WEB-BUILD: package source is not loaded as process communication code. Serving static files is already HTTP (class 8). |
| `apps/server/src/t2Observability/**` | Runtime layer `T2ObservabilityLive`                                                                                                    | In scope. Observer export, not fabric.                                                                                                       |

Peer **client** trees not loaded into the server process: `packages/client-runtime`, `apps/desktop`, `apps/mobile`, and `apps/web` **source** (see EX-CLIENT-RUNTIME). Client-originated RPC still counts when it **terminates** on the server.

Not in this host: `infra/relay` as a separate deployable (server’s HTTP/connect **to** relay remains in scope).

T2 CLI trees `scripts/asd-ste100/**` and `scripts/work-registry/**` are not imported or spawned by `apps/server`. See `exclusions.md`.

## Declared runtime configurations

Each listed variant stays in scope. G1A coverage is **static inspection** of driver/adapter/env code. Full Cartesian runtime execution of every mode × provider × env combination is **not** required.

### Process / access modes

| Mode                  | Values / source                                                              |
| --------------------- | ---------------------------------------------------------------------------- |
| `RuntimeMode`         | `web`, `desktop` (`ServerConfig.mode`)                                       |
| `StartupPresentation` | `browser`, `headless`                                                        |
| Tailscale serve       | `tailscaleServeEnabled` true/false; port from config                         |
| Cloud / relay link    | present when connect HTTP / `hasCloudPublicConfig` run; absent in local-only |
| Static UI             | `staticDir` set (packaged) vs `devUrl` (Vite proxy)                          |

Default listen port `3773`. Host bind from `ServerConfig.host`.

### Shipped provider / runtime variants

`BUILT_IN_DRIVERS` in `apps/server/src/provider/builtInDrivers.ts`: **Codex, Claude, Cursor, Grok, OpenCode**. Unknown `ProviderDriverKind` values become unavailable snapshots; they do not add a new transport family.

| Driver   | Material transport (static)                                                                                               | How G1A covers it                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Codex    | `effect-codex-app-server` stdio `app-server`; optional `T3CODE_CODEX_LAUNCH_ARGS`; also `codex exec` text-generation path | Inspect `CodexSessionRuntime.ts`, `codexLaunchArgs.ts`, `CodexTextGeneration.ts` |
| Claude   | Claude Agent SDK / CLI (`ClaudeAdapter`, `ClaudeTextGeneration`)                                                          | Inspect those modules                                                            |
| Cursor   | ACP stdio (`agent acp`) via `effect-acp`                                                                                  | Inspect `CursorAdapter.ts`, `AcpSessionRuntime.ts`                               |
| Grok     | ACP stdio (`grok agent stdio`) via `effect-acp`                                                                           | Inspect `GrokAdapter.ts`, `GrokAcpSupport.ts`                                    |
| OpenCode | OpenCode runtime + `NetService` (`opencodeRuntime.ts`)                                                                    | Inspect that module                                                              |

Extra **instances** of the same driver (open `ProviderInstanceId` slugs) reuse the same transport family. They are not separate G1A variants.

### Communication-changing env families

| Family                                                                                                  | Why it is a G1A variant or not                                                    |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `T2CODE_TRACE_FILE`, `T2CODE_OTLP_*`                                                                    | Observer export paths. In scope as process-flags + external-transport.            |
| `T3CODE_OTLP_*`, `server.trace.ndjson`                                                                  | T3 observer export. Same.                                                         |
| `T3CODE_CODEX_LAUNCH_ARGS`                                                                              | Changes Codex argv. Covered under Codex variant; not a new class.                 |
| `T3CODE_CLOUDFLARED_PATH`                                                                               | Changes relay client binary source. Covered under `@t3tools/shared/relayClient`.  |
| `T3CODE_POSTHOG_*`, `T3CODE_TELEMETRY_*`                                                                | Analytics export on/off. Covered under external-transport.                        |
| `T3CODE_DEV_ALLOWED_ORIGINS`                                                                            | CORS only; does not add a new mechanism class. Still a declared access-mode flag. |
| Terminal `T3CODE_*` passthrough (`T3CODE_PROJECT_ROOT`, `T3CODE_WORKTREE_PATH`; `T3CODE_PORT` stripped) | Subprocess env of PTY children. Covered under subprocess; not a new class.        |
| `T3_ACP_*`, `T3_GROK_ACP_PROBE`, `T3_CURSOR_ACP_PROBE`                                                  | Test/probe-only. Not shipped discovery variants.                                  |

## Communication versus internal computation

**Communication (in scope):** a message, stream, store write, flag, subprocess, or external I/O whose sender and receiver are different components, or that crosses a published server interface (RPC, HTTP, PTY, git subprocess, SQLite used as shared state, NDJSON/OTLP export, ACP/app-server stdio).

**Internal computation (excluded):** Effect sequencing, pure transforms, and state that never leaves the owning component’s private fields or a function local.

### Examples (in scope)

- `WsRpcGroup` method `orchestration.dispatchCommand` from a client through `apps/server/src/ws.ts` into `OrchestrationEngine`.
- SQLite execute in `NodeSqliteClient` used as shared persistence for multiple services.
- PTY spawn in `terminal/Manager.ts` (subprocess + stream to client).
- MCP HTTP in `mcp/McpHttpServer.ts` (external transport; **negative control**: not in `T2_CATALOG_BOUNDARIES`).
- Codex `app-server` stdio via `effect-codex-app-server`.
- Orchestration projection SQL in `ProjectionSnapshotQuery.ts` (shared persistence + RPC reads).

### Counterexamples (out of scope)

- `createEmptyReadModel` arithmetic that does not leave `OrchestrationEngine`.
- `Duration` / clock math inside a single function.
- Test-only `PubSub.unbounded` inside `*.test.ts`.
- Proposed OTEL span **names** with no live host call site (see `exclusions.md` proposed-name table).

## Frozen mechanism classes

Closed list. Class 9 in the requirements plan is the reopen slot only; it is **not** a class with evidence until G1A is reopened.

1. `rpc-service-interfaces`
2. `streams`
3. `queues`
4. `callbacks`
5. `persistence`
6. `process-flags`
7. `subprocess`
8. `external-transport`

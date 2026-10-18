"""Explicit counted-phase source-audit overrides for G9 design validation.

Agent: this is screening evidence, not G9 runtime and not G1B amendment.
`unresolved` means live source contradicts the declared boundary or the
authoritative site cannot be established. `manual-source-audit` means the
call path was traced; it is not an independently extracted finite set.
Text-token presence never belongs here.
"""

from __future__ import annotations

# (comm_id, phase_id) -> audit record consumed by regen_coverage_ledger.py
PHASE_SOURCE_AUDITS: dict[tuple[str, str], dict] = {}


def _put(comm_id: str, phase_id: str, mode: str, comparison: str, **kw) -> None:
    PHASE_SOURCE_AUDITS[(comm_id, phase_id)] = {
        "validation_mode": mode,
        "comparison_result": comparison,
        **kw,
    }


def _manual(comm_id: str, phase_id: str, comparison: str, **kw) -> None:
    _put(comm_id, phase_id, "manual-source-audit", comparison, **kw)


def _unresolved(comm_id: str, phase_id: str, comparison: str, **kw) -> None:
    _put(comm_id, phase_id, "unresolved", comparison, **kw)


# --- persistence / capture-site mismatches ---
_unresolved(
    "INV-T2-FILE-RUNTIME-STATE",
    "runtime-state-file-persisted",
    "capture-module-is-path-derivation-not-persist",
    mismatch={
        "capture_module": "apps/server/src/config.ts",
        "live_writers": [
            "apps/server/src/serverRuntimeState.ts#persistServerRuntimeState",
            "apps/server/src/telemetry/Identify.ts#anonymousIdPath writeFileString",
            "apps/server/src/environment/ServerEnvironment.ts#environmentIdPath writeFileString",
            "keybindings writeFileStringAtomically",
        ],
        "note": "config.ts deriveServerPaths/ensureServerDirectories only. Four G1B members, one G9 phase.",
    },
    call_sites=["apps/server/src/config.ts ensureServerDirectories"],
    success_boundary="none in named capture module",
)

_manual(
    "INV-T2-FILE-SECRETS",
    "secret-store-persisted",
    "persist-is-ServerSecretStore-not-config",
    capture_correction="apps/server/src/auth/ServerSecretStore.ts set/create writeFile+rename",
    call_sites=["apps/server/src/auth/ServerSecretStore.ts"],
    success_boundary="ServerSecretStore.set temp writeFile + rename succeeds",
    mismatch={
        "g9_capture_module_was": "apps/server/src/config.ts",
        "live": "ServerSecretStore.ts; config.ts only secretsDir",
    },
)

_manual(
    "INV-T2-FILE-USAGE-CACHE",
    "usage-cache-persisted",
    "two-writeFileString-sites-one-phase",
    call_sites=[
        "UsageService.ensureRates writeFileString usage-model-rates.json",
        "UsageService.persistScanCache writeFileString usage-scan-cache.json",
    ],
    success_boundary="writeFileString succeeds; catchCause void is no-occurrence",
)

_manual(
    "INV-T2-FILE-ATTACHMENTS",
    "attachment-write-succeeded",
    "Normalizer.writeFile-traced",
    call_sites=["apps/server/src/orchestration/Normalizer.ts fileSystem.writeFile"],
    success_boundary="fileSystem.writeFile(attachmentPath) succeeds",
    mismatch={
        "g1b_symbols": "AssetAccess.ts / ProjectionPipeline.ts have no writeFile",
        "live_write": "Normalizer.ts",
        "attachmentStore": "id/path helpers only",
    },
)

_manual(
    "INV-T2-FILE-WORKTREES",
    "worktree-create-succeeded",
    "GitVcsDriver.createWorktree-executeGit",
    call_sites=[
        "GitVcsDriverCore.createWorktree",
        "GitWorkflowService.createWorktree",
        "apps/server/src/ws.ts",
    ],
    success_boundary="executeGit(GitVcsDriver.createWorktree) succeeds",
    mismatch={"g1b_mechanism_classes": ["persistence"], "live": "executeGit also INV-T2-GIT"},
)
_manual(
    "INV-T2-FILE-WORKTREES",
    "worktree-remove-succeeded",
    "GitVcsDriver.removeWorktree-executeGit",
    call_sites=["GitVcsDriverCore.removeWorktree", "GitWorkflowService.removeWorktree"],
    success_boundary="executeGit(GitVcsDriver.removeWorktree) succeeds",
    mismatch={"g1b_mechanism_classes": ["persistence"], "live": "executeGit also INV-T2-GIT"},
)

for _op in (
    "captureCheckpoint",
    "restoreCheckpoint",
    "diffCheckpoints",
    "deleteCheckpointRefs",
):
    _manual(
        "INV-T2-FILE-CHECKPOINTS",
        f"checkpoint-{_op}-succeeded",
        "VcsCheckpointOps-public-method",
        call_sites=[
            "apps/server/src/vcs/VcsDriver.ts VcsCheckpointOps",
            "apps/server/src/checkpointing/CheckpointStore.ts",
            "apps/server/src/vcs/GitVcsDriver.ts",
        ],
        success_boundary=f"CheckpointStore/{_op} Effect succeeds; git child remains INV-T2-GIT",
        mismatch={
            "g1b_mechanism_classes": ["persistence"],
            "live": "git refs via execute",
            "capture_symbol_shape": "nested checkpoints?, not top-level VcsDriver method",
        },
    )
_manual(
    "INV-T2-FILE-CHECKPOINTS",
    "checkpoint-hasCheckpointRef-succeeded",
    "VcsCheckpointOps-hasCheckpointRef-boolean",
    call_sites=["CheckpointStore.hasCheckpointRef", "CheckpointReactor"],
    success_boundary="hasCheckpointRef Effect succeeds with boolean",
)

for _op in ("exists", "read", "write"):
    _manual(
        "INV-T2-FILE-SETTINGS",
        f"settings-file-{_op}-succeeded",
        "serverSettings-fs-boundary",
        call_sites=["apps/server/src/serverSettings.ts"],
        success_boundary={
            "exists": "fs.exists(settingsPath) completes true or false",
            "read": "fs.readFileString succeeds",
            "write": "writeFileStringAtomically succeeds",
        }[_op],
    )

for _mid, _pid, _site in [
    ("logsDir", "logsDir-directory-create-succeeded", "ensureServerDirectories makeDirectory logsDir"),
    ("providerLogsDir", "providerLogsDir-directory-create-succeeded", "ensureServerDirectories makeDirectory providerLogsDir"),
    ("terminalLogsDir", "terminalLogsDir-directory-create-succeeded", "ensureServerDirectories makeDirectory terminalLogsDir"),
    ("providerEventLogPath", "providerEventLogPath-writer-succeeded", "EventNdjsonLogger.write via ProviderEventLoggers"),
    ("terminalLogs", "terminalLogs-writer-succeeded", "Manager persistWorker writeFileString historyPath"),
    ("serverLogPath", "serverLogPath-declared-no-live-writer", "deriveServerPaths only; serverLogger does not write serverLogPath"),
]:
    _manual(
        "INV-T2-FILE-LOGS",
        _pid,
        "log-member-disposition-traced",
        member=_mid,
        call_sites=[_site],
        success_boundary=_site,
    )

_manual(
    "INV-T2-FILE-PROVIDER-SESSION",
    "provider-status-cache-read-succeeded",
    "readProviderStatusCache",
    call_sites=["ProviderRegistry boot hydrate", "providerStatusCache.ts"],
    success_boundary="decodeUnknownEffect onSuccess after exists+readFileString; missing file is undefined not failure",
)
_manual(
    "INV-T2-FILE-PROVIDER-SESSION",
    "provider-status-cache-write-succeeded",
    "writeProviderStatusCache",
    call_sites=["ProviderRegistry persistProvider"],
    success_boundary="writeFileStringAtomically succeeds",
)
for _op in ("upsert", "getByThreadId", "list", "deleteByThreadId"):
    _manual(
        "INV-T2-FILE-PROVIDER-SESSION",
        f"provider-session-binding-{_op}-succeeded",
        f"ProviderSessionRuntimeRepository.{_op}",
        call_sites=["apps/server/src/persistence/ProviderSessionRuntime.ts"],
        success_boundary=f"repository.{_op} SQL Effect succeeds",
        mismatch={
            "g1b_transport": "providerStatusCacheDir/session dirs",
            "live": "SQLite provider_session_runtime",
            "deleteByThreadId_callers": "none in production" if _op == "deleteByThreadId" else None,
        },
    )

_manual(
    "INV-T2-TEL-T3-TRACE",
    "t3-trace-persisted-batch-succeeded",
    "makeTraceSink-in-shared-not-Observability-ts",
    call_sites=[
        "ObservabilityLive makeTraceSink",
        "packages/shared/src/observability.ts RotatingFileSink.write",
    ],
    success_boundary="makeTraceSink flushUnsafe sink.write after batchWindowMs",
)

_manual(
    "INV-T2-TEL-NDJSON",
    "ndjson-export-succeeded",
    "T2NdjsonSpanExporter.export-appendFileSync",
    call_sites=["T2Observability.ts SimpleSpanProcessor", "ndjsonExporter.ts export"],
    success_boundary="appendFileSync callback code 0",
)

# --- providers ---
_unresolved(
    "INV-T2-PROVIDER-CLAUDE",
    "runtime-spawn-succeeded",
    "no-ChildProcess-spawn-in-ClaudeAdapter",
    mismatch={
        "declared_module": "ClaudeAdapter.ts",
        "live": "ClaudeProvider.runClaudeCommand spawnAndCollect; session uses SDK query() not T2 ChildProcess",
    },
)
_unresolved(
    "INV-T2-PROVIDER-CLAUDE",
    "runtime-exit-succeeded",
    "no-child.exitCode-in-ClaudeAdapter",
    mismatch={"live": "SDK query abort lifecycle; CLI exit is ClaudeProvider.spawnAndCollect"},
)
_unresolved(
    "INV-T2-PROVIDER-CLAUDE",
    "cli-probe-http-succeeded",
    "no-HTTP-probe-exists",
    mismatch={
        "declared": "Claude CLI HTTP probe success",
        "live": "probeClaudeCapabilities uses SDK query() initializationResult; no Anthropic HTTP; no HttpClient on ClaudeAdapter",
    },
)
_unresolved(
    "INV-T2-PROVIDER-CURSOR",
    "runtime-exit-succeeded",
    "no-child.exitCode-observer",
    mismatch={"live": "AcpSessionRuntime teardown is Scope.close; no child.exitCode"},
)
_unresolved(
    "INV-T2-PROVIDER-GROK",
    "runtime-exit-succeeded",
    "no-child.exitCode-observer",
    mismatch={"live": "AcpSessionRuntime teardown is Scope.close; no child.exitCode"},
)

_manual(
    "INV-T2-PROVIDER-CODEX",
    "runtime-spawn-succeeded",
    "spawner.spawn-in-CodexSessionRuntime",
    call_sites=["makeCodexSessionRuntime spawner.spawn(ChildProcess.make)"],
    success_boundary="spawner.spawn Effect succeeds",
)
_manual(
    "INV-T2-PROVIDER-CODEX",
    "runtime-exit-succeeded",
    "child.exitCode-in-CodexSessionRuntime",
    call_sites=["CodexSessionRuntime child.exitCode -> session/exited"],
    success_boundary="child.exitCode completes",
)
_manual(
    "INV-T2-PROVIDER-CURSOR",
    "runtime-spawn-succeeded",
    "spawner.spawn-in-AcpSessionRuntime",
    call_sites=["AcpSessionRuntime.make", "makeCursorAcpRuntime"],
    success_boundary="spawner.spawn Effect succeeds",
)
_manual(
    "INV-T2-PROVIDER-GROK",
    "runtime-spawn-succeeded",
    "spawner.spawn-in-AcpSessionRuntime",
    call_sites=["AcpSessionRuntime.make", "makeGrokAcpRuntime"],
    success_boundary="spawner.spawn Effect succeeds",
)
_manual(
    "INV-T2-PROVIDER-OPENCODE",
    "runtime-spawn-succeeded",
    "spawner.spawn-in-opencodeRuntime",
    call_sites=["startOpenCodeServerProcess / runOpenCodeCommand"],
    success_boundary="spawner.spawn Effect succeeds",
)
_manual(
    "INV-T2-PROVIDER-OPENCODE",
    "runtime-exit-succeeded",
    "child.exitCode-and-adapter-server.exitCode",
    call_sites=["opencodeRuntime child.exitCode", "OpenCodeAdapter context.server.exitCode"],
    success_boundary="exitCode Effect completes",
)
_manual(
    "INV-T2-PROVIDER-CLAUDE",
    "protocol-request-succeeded",
    "SDK-query-no-finite-T2-method-catalog",
    call_sites=["ClaudeAdapter createQuery -> query({prompt, options})"],
    success_boundary="query() starts without protocol method enum",
)
_manual(
    "INV-T2-PROVIDER-CLAUDE",
    "protocol-event-decoded",
    "SDKMessage-iterable-no-finite-T2-catalog",
    call_sites=["ClaudeAdapter logNativeSdkMessage / query iterable"],
    success_boundary="SDKMessage received",
)
_manual(
    "INV-T2-PROVIDER-OPENCODE",
    "opencode-http-succeeded",
    "createOpencodeClient-runOpenCodeSdk",
    call_sites=["opencodeRuntime.createOpenCodeSdkClient", "OpenCodeAdapter runOpenCodeSdk"],
    success_boundary="runOpenCodeSdk promise/Effect succeeds; overlaps protocol-request",
)
_manual(
    "INV-T2-PROVIDER-TURN",
    "send-turn-admitted",
    "ProviderService.sendTurn-entered",
    call_sites=["ProviderService.sendTurn after resolveRoutableSession"],
    success_boundary="sendTurn entered; phase_id is not a live token",
    mismatch={"g1b_mechanism_classes": ["callbacks", "external-transport"], "live": "in-process adapter.sendTurn"},
)
_manual(
    "INV-T2-PROVIDER-TURN",
    "send-turn-succeeded",
    "adapter.sendTurn-Effect-success",
    call_sites=["routed.adapter.sendTurn(input)"],
    success_boundary="adapter.sendTurn succeeds",
)
_manual(
    "INV-T2-PROVIDER-LIST-EVENTS",
    "pubsub-published",
    "PubSub.publish-changesPubSub",
    call_sites=["ProviderRegistry PubSub.publish(changesPubSub, providers)"],
    success_boundary="PubSub.publish succeeds",
)
_manual(
    "INV-T2-PROVIDER-PERM",
    "permission-request-admitted",
    "acp.handleRequestPermission-forwarded",
    call_sites=["AcpSessionRuntime handleRequestPermission", "Cursor/Grok adapter handlers"],
    success_boundary="permission handler invoked",
)
_manual(
    "INV-T2-PROVIDER-PERM",
    "permission-outcome-succeeded",
    "permission-outcome-selected-or-cancelled",
    call_sites=["Cursor/Grok adapters return {outcome: selected|cancelled}"],
    success_boundary="handler returns outcome object",
)

# --- term / queues / preview / cli ---
for _pid, _site, _succ in [
    ("pty-spawn-succeeded", "Manager.trySpawn -> PtyAdapter.spawn", "ptyAdapter.spawn succeeds"),
    ("pty-exit-succeeded", "ptyProcess.onExit enqueueProcessEvent type=exit", "onExit callback invoked"),
    ("pty-input-write-succeeded", "Manager.write process.write", "write Effect.try succeeds; exited is no-op"),
    ("pty-output-callback-emitted", "ptyProcess.onData enqueue type=output", "onData invoked; enqueue false drops"),
    ("terminal-session-callback-emitted", "TerminalManager.subscribe", "listener invoked"),
    ("terminal-metadata-callback-emitted", "subscribeMetadata offerMetadataEvent", "listener invoked; null skipped"),
]:
    _manual("INV-T2-TERM", _pid, "Manager-PtyAdapter-callpath", call_sites=[_site], success_boundary=_succ)

_manual(
    "INV-T2-ORCH-LIVE",
    "live-buffer-offered",
    "ws.ts-liveBuffer-Queue.offer-kinds",
    call_sites=["apps/server/src/ws.ts subscribeShell/subscribeThread liveBuffer"],
    success_boundary="Queue.offer(liveBuffer, {kind:event|synchronized})",
)
_manual(
    "INV-T2-ORCH-QUEUE",
    "queue-offered",
    "OrchestrationEngine-commandQueue.offer",
    call_sites=["OrchestrationEngine.ts dispatch Queue.offer"],
    success_boundary="Queue.offer(commandQueue, envelope) succeeds",
    mismatch={
        "g9_labels": ["client", "internal"],
        "live_field": "envelope.command.type",
        "not_projectionPipeline": True,
        "homonym": "serverRuntimeStartup QueuedCommand queue is not this row",
    },
)
_manual(
    "INV-T2-VCS-EVENTS",
    "pubsub-published",
    "VcsStatusBroadcaster-PubSub.publish",
    call_sites=["VcsStatusBroadcaster PubSub.publish gated by options.publish"],
    success_boundary="PubSub.publish when shouldPublish",
)
_manual(
    "INV-T2-SETTINGS-EVENTS",
    "pubsub-published",
    "emitChange-PubSub.publish-asVoid",
    call_sites=["revalidateAndEmit", "updateSettings"],
    success_boundary="emitChange Effect succeeds after publish",
)
_manual(
    "INV-T2-SETTINGS-EVENTS",
    "settings-subscription-established",
    "subscribeChanges-PubSub.subscribe",
    call_sites=["DesktopTelemetryReceiver", "makeManagedServerProvider"],
    success_boundary="PubSub.subscribe returns stream",
)
_manual(
    "INV-T2-LIFECYCLE-EVENTS",
    "pubsub-published",
    "serverLifecycleEvents.publish",
    call_sites=["serverRuntimeStartup.ts lifecycleEvents.publish", "ws.ts stream"],
    success_boundary="publish Ref.modify + PubSub.publish",
)
for _pid, _succ in [
    ("preview-auto-routed", "PreviewAutomationBroker.invoke route assignment"),
    ("preview-auto-queue-offered", "Queue.offer(connection.queue, request)"),
    ("preview-auto-result-succeeded", "respond Deferred.succeed(result)"),
]:
    _manual("INV-T2-PREVIEW-AUTO", _pid, "PreviewAutomationBroker-boundary", call_sites=["PreviewAutomationBroker.ts"], success_boundary=_succ)
_manual(
    "INV-T2-PREVIEW-SCAN",
    "scan-process-succeeded",
    "PortScanner-processRunner",
    call_sites=["PortScanner processRunner.run powershell/lsof"],
    success_boundary="processRunner.run succeeds",
)
_manual(
    "INV-T2-PREVIEW-SCAN",
    "scan-probe-succeeded",
    "probeCommonPorts-isPortAvailableOnLoopback",
    call_sites=["PortScanner probeCommonPorts"],
    success_boundary="net.isPortAvailableOnLoopback on COMMON_DEV_PORTS",
)
_unresolved(
    "INV-T2-PROJECT-SETUP",
    "setup-script-succeeded",
    "g1b-subprocess-vs-live-terminal-write",
    mismatch={
        "g1b_mechanism_classes": ["subprocess"],
        "live": "ProjectSetupScriptRunner.runForThread terminalManager.open+write; no ProcessRunner",
        "child_row": "INV-T2-TERM",
    },
)
_manual(
    "INV-T2-TAILSCALE",
    "tailscale-command-succeeded",
    "runTailscaleCommand-exitCode-0",
    call_sites=["ensureTailscaleServe", "disableTailscaleServe", "apps/server/src/server.ts", "cli/pair.ts"],
    success_boundary="runTailscaleCommand exitCode===0; probeTailscaleHttpsEndpoint excluded",
    mismatch={"g1b_symbols": ["apps/server/src/server.ts"], "live_cli": "packages/tailscale/src/tailscale.ts"},
)
_manual(
    "INV-T2-RELAY-CLIENT",
    "cloudflared-spawn-succeeded",
    "makeCloudflaredRelayClient-runCommand-spawn",
    call_sites=["packages/shared/src/relayClient.ts runCommand spawner.spawn"],
    success_boundary="spawner.spawn for install tar/--version, not a long-lived tunnel process",
)
_manual(
    "INV-T2-RELAY-CLIENT",
    "cloudflared-exit-succeeded",
    "child.exitCode-install-command",
    call_sites=["relayClient.ts child.exitCode"],
    success_boundary="child.exitCode; nonzero CloudflaredCommandError",
)
_manual(
    "INV-T2-RES-MONITOR",
    "monitor-spawn-succeeded",
    "NativeTelemetryClient-spawner.spawn",
    call_sites=["NativeTelemetryClient runAttempt spawner.spawn"],
    success_boundary="spawner.spawn succeeds",
)
_manual(
    "INV-T2-EDITOR-LAUNCH",
    "editor-spawn-succeeded",
    "launchAndUnref-spawner.spawn",
    call_sites=["externalLauncher launchAndUnref"],
    success_boundary="spawner.spawn then unref",
)
_manual(
    "INV-T2-GIT",
    "git-execute-succeeded",
    "VcsDriver-required-methods",
    call_sites=["apps/server/src/vcs/VcsDriver.ts execute and required methods"],
    success_boundary="declared VcsDriver method Effect succeeds; checkpoints remain FILE-CHECKPOINTS",
    mismatch={
        "prior_g9_extract": "included optional getDiffPreview omitted from VcsDriver.of",
        "g1b_symbols": "GitVcsDriverCore.ts + VcsProcess.ts",
    },
)

# --- http / mcp / telemetry / flags / home-bus ---
_manual(
    "INV-T2-HTTP-SERVE",
    "http-listening-marked",
    "markHttpListening-Deferred.succeed-once",
    call_sites=["serverRuntimeStartup.ts markHttpListening", "server.ts httpListeningLayer"],
    success_boundary="Deferred.succeed(httpListening) once per listen-bound",
)
for _pid in (
    "asset-file-200-selected",
    "static-file-200-selected",
    "static-spa-fallback-200-selected",
    "static-dev-redirect-302-selected",
):
    _manual(
        "INV-T2-HTTP-STATIC",
        _pid,
        "http.ts-status-branch",
        call_sites=["apps/server/src/http.ts assetRouteLayer / staticAndDevRouteLayer"],
        success_boundary="named status branch selected; phase_id is G9 label not a source token",
    )
_manual(
    "INV-T2-MCP-HTTP",
    "mcp-http-message-admitted",
    "McpHttpServer.authenticateRequest",
    call_sites=["McpHttpServer.authenticateRequest after registry.resolve"],
    success_boundary="authenticateRequest Effect continues",
)
_manual(
    "INV-T2-MCP-HTTP",
    "mcp-http-handler-succeeded",
    "normalizeMcpHttpResponse-layerHttp",
    call_sites=["normalizeMcpHttpResponse", "McpServer.layerHttp path=/mcp"],
    success_boundary="handler Effect succeeds",
)
_unresolved(
    "INV-T2-MCP-HTTP",
    "mcp-http-session-deleted",
    "DELETE-not-in-McpHttpServer.ts",
    mismatch={
        "declared_module": "McpHttpServer.ts",
        "live": "Effect McpServer.layerHttp DELETE; no session-delete symbol in McpHttpServer.ts",
    },
)
_manual(
    "INV-T2-RELAY-AWARENESS",
    "awareness-publish-succeeded",
    "publishAgentActivity",
    call_sites=["AgentAwarenessRelay publishThreadUnsafe -> relayClient.server.publishAgentActivity"],
    success_boundary="publishAgentActivity succeeds",
)
_unresolved(
    "INV-T2-TEL-T3-OTLP",
    "t3-otlp-traces-export-succeeded",
    "no-in-tree-export-success-hook",
    mismatch={
        "wiring": "Observability.ts OtlpTracer.make / OtlpExporter.layerFlusher",
        "export_success_callback": None,
        "capture_module": "directory apps/server/src/observability",
    },
)
_unresolved(
    "INV-T2-TEL-T3-OTLP",
    "t3-otlp-metrics-export-succeeded",
    "no-in-tree-export-success-hook",
    mismatch={
        "wiring": "OtlpMetrics.layer",
        "export_success_callback": None,
    },
)
_unresolved(
    "INV-T2-TEL-T2-OTLP",
    "t2-otlp-export-succeeded",
    "BatchSpanProcessor-constructor-only",
    mismatch={
        "live": "T2Observability BatchSpanProcessor(OTLPTraceExporter({url}))",
        "export_success_callback": None,
    },
)
_manual(
    "INV-T2-TEL-ANALYTICS",
    "posthog-batch-succeeded",
    "AnalyticsService.sendBatch-filterStatusOk",
    call_sites=["AnalyticsService.sendBatch POST /batch/"],
    success_boundary="HttpClientResponse.filterStatusOk",
)
_manual(
    "INV-T2-TEL-DESKTOP-CONTROL",
    "desktop-control-send-succeeded",
    "sendControlMessage",
    call_sites=["DesktopTelemetryReceiver.sendControlMessage", "ResourceTelemetry.setDiagnosticsDemand"],
    success_boundary="sendControlMessage completes",
)
_manual(
    "INV-T2-FLAG-T3-OTEL",
    "flag-resolved",
    "EnvServerConfig-T3CODE_OTLP-and-TRACE-fields",
    call_sites=["apps/server/src/cli/config.ts EnvServerConfig"],
    success_boundary="EnvServerConfig loads; Posthog telemetry env is AnalyticsService not EnvServerConfig",
)
_manual(
    "INV-T2-FLAG-SERVER-CONFIG",
    "flag-resolved",
    "EnvServerConfig-mode-and-host-fields",
    call_sites=["apps/server/src/cli/config.ts EnvServerConfig"],
    success_boundary="mode/host/port/tailscaleServe* accepted",
)
_unresolved(
    "INV-T2-FLAG-T2-OTEL",
    "flag-resolved",
    "T2CODE-env-not-EnvServerConfig",
    mismatch={
        "declared": "ServerConfig decode in config.ts",
        "live": "T2Observability.ts process.env T2CODE_TRACE_FILE / T2CODE_OTLP_*",
    },
)
_unresolved(
    "INV-T2-FLAG-CODEX-LAUNCH",
    "flag-resolved",
    "T3CODE_CODEX_LAUNCH_ARGS-not-EnvServerConfig",
    mismatch={"live": "provider/Layers/codexLaunchArgs.ts"},
)
_unresolved(
    "INV-T2-FLAG-CLOUDFLARED",
    "flag-resolved",
    "T3CODE_CLOUDFLARED_PATH-not-EnvServerConfig",
    mismatch={"live": "packages/shared/src/relayClient.ts"},
)
_manual(
    "INV-T2-FLAG-TERM-ENV",
    "terminal-child-env-filtered",
    "shouldExcludeTerminalEnvKey-before-pty-child-env",
    call_sites=["apps/server/src/terminal/Manager.ts shouldExcludeTerminalEnvKey spawnEnv"],
    success_boundary="inherited baseEnv filtered by shouldExcludeTerminalEnvKey; caller runtimeEnv copied after that predicate; no keys/values in A",
)
_manual(
    "INV-T2-PROJECT-QUEUE",
    "projection-event-succeeded",
    "projectEvent-effect-success-channel",
    call_sites=["OrchestrationEngine.processEnvelope projectionPipeline.projectEvent"],
    success_boundary="ProjectionPipeline.projectEvent Effect exits through success channel; no SQL/payload in A",
)
for _comm in ("INV-T2-SC-GITHUB", "INV-T2-SC-GITLAB", "INV-T2-SC-ADO"):
    _manual(
        _comm,
        "cli-execute-succeeded",
        "host-CLI-execute-VcsProcess.run",
        call_sites={
            "INV-T2-SC-GITHUB": "GitHubCli.execute command gh",
            "INV-T2-SC-GITLAB": "GitLabCli.execute command glab",
            "INV-T2-SC-ADO": "AzureDevOpsCli.execute command az",
        }[_comm],
        success_boundary="process.run succeeds",
    )
_manual(
    "INV-T2-SCM-HOME-BUS-LINK",
    "home-bus-forward-succeeded",
    "advanceFundamentalTimestep-dormant",
    call_sites=["g6HomeBusLink.ts tests only; not wired from server.ts"],
    success_boundary="fixture destination.publish after advanceFundamentalTimestep",
)

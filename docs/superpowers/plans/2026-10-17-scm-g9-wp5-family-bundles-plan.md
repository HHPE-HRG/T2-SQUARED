# SCM G9 WP5 family bundles — definition plan (U2)

<!-- Agent: definition only. No apps/server/src/scm/g9*.ts. No authorization.md. Do not execute. -->

- Date: 2026-10-17
- Unit: **U2** (G9 Manager charter)
- Governing design: `docs/superpowers/specs/2026-09-26-scm-g9-shadow-parity-design.md`
- Foundation cohesion (frozen contracts): `docs/scm/g9/wp1-wp4-foundation-cohesion.md`
- Machine ledger: `docs/scm/g9/coverage-ledger.json`
- Validation: `docs/scm/g9/coverage-validation.json`
- Index: `docs/scm/g9/wp5/bundle-index.md`

## Authorization

```yaml
implementation_authorized: false
writing_plans_authorized: true # planning definition only; mirrors coverage-validation.json
```

Do **not** create `docs/scm/g9/authorization.md`, flip `g9toG10Authorized`, edit generated JSON by hand, or implement family modules in this pass.

## Goal

Define six **readiness bundles** (B1–B6) that partition all **74** ledger `comm_id`s into parallelizable family work after WP1–WP4 + the ORCH-QUEUE vertical slice. Each bundle names outcomes, ledger rows, live capture surfaces, acceptance gates, non-goals, and a **proposed** family module file owner. Families call **`captureOccurrence({ comm_id, phase, input })` only** — no FIFO, clock, tracer, or meter ownership.

## Depends on (WP4 frozen)

Bind without re-opening:

- Foundation **Task 14 complete** (RFC-017/019): full widen of `G9CaptureOccurrenceInput` + `G9Occurrence` + `toW1` set-equal to ledger 184 phases; coordinator validates against loaded package; **declaration-absence** never enqueues; **dormant-prototype** may enqueue from B6 fixtures only (`wp1-wp4-foundation-cohesion.md` §3). Slice Tasks 1–13 remain ORCH-QUEUE-only until Task 14 lands. WP5 must not widen core `g9*.ts`.
- `G9CaptureResult` = `enqueued` \| `rejected-capacity` \| `rejected-bus-withheld`; faults are `G9InvariantFault`, not capture results.
- Optional `G9CaptureService` / `G9LiveSafeCaptureLayer` live-safe boundary (foundation Task 11).
- Row loader: init-time G1B = G3 = G9 set equality (74); ledger SHA pins.
- Dormant `INV-T2-SCM-HOME-BUS-LINK`: fixtures only; no production `BidirectionalHomeBusLink` fabric.

## Assignment completeness

| Bucket                           | `comm_id` count | Phase count (ledger) | Notes                                                 |
| -------------------------------- | --------------: | -------------------: | ----------------------------------------------------- |
| B1 queue-pubsub-callback         |               8 |                   11 | includes foundation slice row                         |
| B2 file-db-process-config        |              18 |                   78 | includes `INV-T2-PROJECT-SQL` (41 phases)             |
| B3 subprocess-external-transport |              16 |                   21 |                                                       |
| B4 provider-protocol             |              16 |                   41 | MCP non-hook phases; RpcServer rows moved to WP6      |
| B5 terminal-local-streams        |               5 |                   12 |                                                       |
| B6 dormant-home-bus-link         |               1 |                    1 | non-production fixtures                               |
| WP6 full-row deferral            |              10 |                   20 | 8 RpcServer rows (17 phases) + 2 OTLP rows (3 phases) |
| **Total**                        |          **74** |              **184** | every counted row accounted                           |

Phase-level WP6 deferral (row stays in B4): one phase on `INV-T2-MCP-HTTP` (see [WP6 deferral](#wp6-deferral-planned_typed_hooks)).

## Cross-cutting family law

From design + U1 cohesion:

- **Family = per phase** in the ledger; one bundle owns each `comm_id` for planning; implementation still declares every phase.
- Adapters at live success boundaries project bounded `A`, then call `captureOccurrence`. No enqueue, publish, or observation spans in family code.
- No payload retention; equality is schema-bounded `G9DeferredEquality<A>` projections from the ledger.
- Do not collapse stacked GIT/SQL/TERM identities; do not capture `PROJECT-QUEUE` / `TERM-ENV` outside steward-closed inventory (both are counted-closed in the ledger).
- Generator JSON remains **single-owner**: `docs/scm/g9/regen_coverage_ledger.py` only.

## Parallelization

| May run in parallel (after WP4 freeze)                                            | Serial / single-owner (see next section)                                |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| B1–B6 definition (this document)                                                  | `regen_coverage_ledger.py` + generated `coverage-ledger.json`, fixtures |
| Later: isolated `g9Family*.ts` modules + tests that only call `captureOccurrence` | Effect patch (WP6), `server.ts` bootstrap (WP7)                         |
| B3 subprocess vs B2 SQL vs B1 queues (disjoint primary surfaces)                  | `terminal/Manager.ts`; `apps/server/src/provider/**` capture edits      |
| B1 ORCH-LIVE + ORCH-QUEUE via shared B1 helper                                    | Concurrent edits to the same live file without a named integrator       |

## WP5 serial hotspots (normative)

When `implementation_authorized` becomes true, these rules govern **live-file** capture edits. Family logic stays in each bundle’s `g9Family*.ts`; hotspots below are where multiple bundles (or WP5+WP6) touch one production file. **Cross-WP sole landers** for `ws.ts`, `McpHttpServer.ts`, `T2Observability.ts`, and `Observability.ts` are **WP6-Consumer-Owner** (RFC-005 / RFC-014); WP5 supplies handoff patches only on those files.

| Hotspot                                                                                                                                                           | Sole editor                                      | Other bundles / WPs                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/server/src/terminal/Manager.ts`                                                                                                                             | **B5** (`g9FamilyTerminalLocalStreams.ts` owner) | **B2** supplies capture patches only (no direct `Manager.ts` commits); **B4 does not edit** `Manager.ts`                                         |
| `apps/server/src/provider/**` (all ledger capture sites under this tree, including `Layers/`, `acp/`, `opencodeRuntime.ts`, and provider queue/registry surfaces) | **B4** (`g9FamilyProviderProtocol.ts` owner)     | **B2** supplies capture patches only ([B2→B4 handoff](#provider-merge-sequence-b4-integrator)); B1/B3/B5 **must not** commit under `provider/**` |
| `apps/server/src/serverSettings.ts`                                                                                                                               | **B1**                                           | **B2** handoff for `INV-T2-FILE-SETTINGS` only                                                                                                   |
| `apps/server/src/vcs/VcsDriver.ts`                                                                                                                                | **B3**                                           | **B2** handoff for `INV-T2-FILE-CHECKPOINTS` only                                                                                                |
| `packages/shared/src/relayClient.ts`                                                                                                                              | **B3**                                           | **B2** handoff for `INV-T2-FLAG-CLOUDFLARED` only                                                                                                |
| `apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts`                                                                                                   | **B5**                                           | **B3** handoff for `INV-T2-TEL-DESKTOP-CONTROL` only                                                                                             |
| `apps/server/src/ws.ts`                                                                                                                                           | **WP6-Consumer-Owner**                           | **B1** handoff for `INV-T2-ORCH-LIVE` only                                                                                                       |
| `apps/server/src/mcp/McpHttpServer.ts`                                                                                                                            | **WP6-Consumer-Owner**                           | **B4** handoff for `mcp-http-message-admitted` / `mcp-http-handler-succeeded`                                                                    |
| `apps/server/src/t2Observability/T2Observability.ts`                                                                                                              | **WP6-Consumer-Owner** (RFC-005 **A**)           | **B2** / **B5** handoff patches only (flag / NDJSON); never direct B2/B5 commits                                                                 |
| `apps/server/src/observability/Layers/Observability.ts`                                                                                                           | **WP6-Consumer-Owner** (RFC-014 **A**)           | **B5** handoff for `INV-T2-TEL-T3-TRACE` only                                                                                                    |
| Generated G9 JSON                                                                                                                                                 | Generator owner (`regen_coverage_ledger.py`)     | No bundle hand-edits ledger/fixtures                                                                                                             |

### `Manager.ts` merge sequence (B5 integrator)

B5 owns the **only** WP5 commit stream that modifies `apps/server/src/terminal/Manager.ts`. Cross-bundle work is patch handoff, not parallel edits.

1. **B2 → B5 handoff:** B2 owner delivers a ready patch (or PR branch) for B2 phases on `Manager.ts` only — `INV-T2-FLAG-TERM-ENV` / `terminal-child-env-filtered` and **`INV-T2-FILE-LOGS`** / `terminalLogs-writer-succeeded` (**not** the `providerEventLogPath-writer-succeeded` phase; that phase is [B2→B4](#provider-merge-sequence-b4-integrator)).
2. **B5 integrate B2:** B5 owner merges B2 handoff into their `Manager.ts` branch first; B5 runs targeted tests for B2 rows affected by those hooks.
3. **B5 TERM:** B5 owner adds capture for `INV-T2-TERM` phases on the same branch.
4. **Land:** One serial merge order for `Manager.ts`: steps 2–3 complete → single integrator PR (or ordered stack where each PR is B5-authored).

B2 and B5 may implement helpers in their own `g9Family*.ts` files in parallel; only steps 2–4 serializes the shared live file.

### `provider/**` merge sequence (B4 integrator)

B4 owns the **only** WP5 commit stream that modifies capture hooks under `apps/server/src/provider/**`. B2 owns ledger rows and authors capture logic in `g9FamilyFileDbProcessConfig.ts`; B4 lands live-file diffs.

1. **B2 → B4 handoff:** B2 owner delivers ready patches (or a PR branch) authored against `g9FamilyFileDbProcessConfig.ts` for every **B2-owned** phase whose ledger `capture_module` is under `provider/**` ([table below](#b2-owned-phases-on-provider-capture-sites-normative)).
2. **B4 integrate B2:** B4 owner merges B2 handoffs into their `provider/**` branch first; B4 runs targeted tests for the affected B2 `comm_id`s.
3. **B4 protocol rows:** B4 owner adds capture for B4-owned rows on the same branch (adapters, registry, MCP non-hook phases, etc.).
4. **Land:** One serial merge order for `provider/**`: steps 2–3 complete → integrator PR(s) **B4-authored** only.

B2 and B4 may implement family helpers in parallel; only steps 2–4 serialize shared `provider/**` live files.

### B2-owned phases on `provider/**` capture sites (normative)

Planning ownership stays **B2** (`comm_id` remains in bundle B2). Live-file edits for these phases follow [B2→B4 handoff](#provider-merge-sequence-b4-integrator), not direct B2 commits under `provider/**`.

| `comm_id`                      | `phase_id`                              | Ledger `capture_module`                                   |
| ------------------------------ | --------------------------------------- | --------------------------------------------------------- |
| `INV-T2-FILE-LOGS`             | `providerEventLogPath-writer-succeeded` | `apps/server/src/provider/Layers/ProviderEventLoggers.ts` |
| `INV-T2-FILE-PROVIDER-SESSION` | `provider-status-cache-read-succeeded`  | `apps/server/src/provider/providerStatusCache.ts`         |
| `INV-T2-FILE-PROVIDER-SESSION` | `provider-status-cache-write-succeeded` | `apps/server/src/provider/providerStatusCache.ts`         |
| `INV-T2-FLAG-CODEX-LAUNCH`     | `flag-resolved`                         | `apps/server/src/provider/Layers/codexLaunchArgs.ts`      |

The **`INV-T2-FILE-LOGS`** phase `terminalLogs-writer-succeeded` on `apps/server/src/terminal/Manager.ts` is **not** in this table; it uses the [B2→B5 `Manager.ts` handoff](#manager.ts-merge-sequence-b5-integrator).

## Module layout (normative)

WP7 composition uses **six family modules** (`g9FamilyQueuePubSubCallback.ts`, `g9FamilyFileDbProcessConfig.ts`, `g9FamilySubprocessExternalTransport.ts`, `g9FamilyProviderProtocol.ts`, `g9FamilyTerminalLocalStreams.ts`, `g9FamilyHomeBusLinkFixtures.ts`) plus a **thin re-export** entry if needed for bootstrap. Do not treat design-header `g9ShadowParity.ts` as a second coordinator (U1 RFC C1).

## Provider queue rows (normative)

All provider-tagged ledger rows belong to **B4**, including queue-pubsub family phases on `INV-T2-PROVIDER-EVENTS` and `INV-T2-PROVIDER-LIST-EVENTS`. B1 owns non-provider queue/pubsub rows only.

## B1 shared capture helper (normative)

`INV-T2-ORCH-LIVE` and `INV-T2-ORCH-QUEUE` (and other B1 queue rows as needed) **share one private helper** inside `g9FamilyQueuePubSubCallback.ts` that calls the frozen **`G9CaptureService.captureOccurrence`** API. Do **not** re-own foundation `g9OrchQueueCapture.ts` or the slice capture hook in `OrchestrationEngine.ts` (sole: **Slice-Foundation-Owner** — cohesion §2; RFC-023). B1 must **not** commit to `OrchestrationEngine.ts` for any phase. `INV-T2-ORCH-EVENTS` lands on ledger `capture_module: apps/server/src/orchestration` (pub/sub surfaces under that tree, not `Layers/OrchestrationEngine.ts`). `INV-T2-ORCH-LIVE` live-file edits on `ws.ts` are **B1→WP6 handoff** (WP6 sole lander).

## RpcServer ownership — WP6 post-regen (normative)

**Ledger `capture_strategy` / `capture_module` win** (RFC-002/012 applied). RpcServer admit/unary/stream phases are **`planned-typed-hook`** with live `capture_module: apps/server/src/ws.ts`. **WP6** is the sole `captureOccurrence` owner; B4 must **not** capture those phases. Machine inventory: `coverage-validation.json` → `planned_typed_hooks` (**21** rows). MCP follows [WP6 deferral](#wp6-deferral-planned_typed_hooks): B4 owns non-hook MCP phases via **handoff** to WP6 sole lander on `McpHttpServer.ts`; `mcp-http-session-deleted` is WP6 only.

---

## WP6 deferral (`planned_typed_hooks`)

Source: `docs/scm/g9/coverage-validation.json` → `planned_typed_hooks` (**21** phase rows). These are **not** WP5 capture modules; they belong to **U3 / WP6** (Effect patch + post-success hooks on `ws.ts` / observability / MCP).

| `comm_id`                      | `phase_id`(s)              | WP5 bundle note                                     |
| ------------------------------ | -------------------------- | --------------------------------------------------- |
| `INV-T2-RPC-WS`                | admit + unary + stream     | **Entire row deferred** — WP6 `ws.ts`               |
| `INV-T2-ORCH-RPC`              | admit + unary              | **Entire row deferred**                             |
| `INV-T2-RPC-STREAM-*` (6 rows) | admit + stream each        | **Entire rows deferred**                            |
| `INV-T2-TEL-T2-OTLP`           | `t2-otlp-export-succeeded` | **Entire row deferred**                             |
| `INV-T2-TEL-T3-OTLP`           | traces + metrics export    | **Entire row deferred**                             |
| `INV-T2-MCP-HTTP`              | `mcp-http-session-deleted` | Row in **B4**; this phase deferred to WP6 hook only |

WP5 rows **not** in the table above remain in B1–B6 even when mechanism class includes `external-transport` or `telemetry-export` (e.g. `INV-T2-TEL-NDJSON` stays B5).

---

## B1 queue-pubsub-callback

**Outcome:** Local Queue/PubSub and callback-shaped live successes enqueue occurrences for eight inventoried rows without changing live queue semantics.

**Depends on:** WP4 frozen capture service + fault live-safe boundary; foundation ORCH-QUEUE slice for one row.

**Proposed file owner:** `apps/server/src/scm/g9FamilyQueuePubSubCallback.ts` (+ colocated tests).

**Primary live file surfaces (text):**

- `apps/server/src/orchestration` (orchestration pub/sub — `INV-T2-ORCH-EVENTS` and other B1 queue rows per ledger `capture_module`; **not** `Layers/OrchestrationEngine.ts`)
- `apps/server/src/orchestration/Layers/ProjectionPipeline.ts`
- `apps/server/src/serverLifecycleEvents.ts`
- `apps/server/src/vcs/VcsStatusBroadcaster.ts`
- `apps/server/src/mcp/PreviewAutomationBroker.ts`
- `apps/server/src/serverSettings.ts` (**B1 sole** WP5 lander; integrates B2 file-settings handoff)

**Not B1 (sole Slice-Foundation-Owner):** `apps/server/src/orchestration/Layers/OrchestrationEngine.ts` (ORCH-QUEUE slice capture hook only).

**Handoff-only (no direct B1 commit):**

| Live file               | Phase                                      | Integrator             |
| ----------------------- | ------------------------------------------ | ---------------------- |
| `apps/server/src/ws.ts` | `INV-T2-ORCH-LIVE` / `live-buffer-offered` | **WP6-Consumer-Owner** |

**Acceptance gate (per bundle, when implemented):**

- One live success per counted phase → exactly one `captureOccurrence` call with ledger `phase_id` and bounded `input` (**except** phases with `fixture_driver_class: "declaration-absence"` / validation `declaration_absence_phases` — fixture-only; no invented writer). **Forbidden:** exempting live phases solely because `request_label` contains `CANONICAL_ABSENCE`.
- Live queue/callback behavior unchanged when `G9CaptureService` is absent.
- `INV-T2-ORCH-QUEUE` / `queue-offered`: foundation slice already defined in `docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md` Tasks 11–12; B1 lists the row for bundle completeness — **remaining phases: none** (single phase row).
- `accepted === false` on offer paths → no capture (ORCH-QUEUE).

**Non-goals:** Owning FIFO depth; RpcServer/HTTP capture (WP6 owns `ws.ts` typed-hook land); SQL/file phases (B2); Effect patch hooks (WP6); direct commits to `ws.ts`.

**Ledger `comm_id`s (8):**

| `comm_id`                 | `node_id`            | `home_bus_id`     | Phases | Note                                                                |
| ------------------------- | -------------------- | ----------------- | -----: | ------------------------------------------------------------------- |
| `INV-T2-LIFECYCLE-EVENTS` | `node.lifecycle`     | `bus.control`     |      1 |                                                                     |
| `INV-T2-ORCH-EVENTS`      | `node.orchestration` | `bus.control`     |      1 |                                                                     |
| `INV-T2-ORCH-LIVE`        | `node.orchestration` | `bus.control`     |      1 | Live file via WP6 handoff                                           |
| `INV-T2-ORCH-QUEUE`       | `node.orchestration` | `bus.control`     |      1 | Foundation slice already defined; remaining phases if any: **none** |
| `INV-T2-PREVIEW-AUTO`     | `node.preview`       | `bus.rpc`         |      3 | queue + callback families                                           |
| `INV-T2-PROJECT-QUEUE`    | `node.projection`    | `bus.persistence` |      1 | steward-closed; callback at projection pipeline                     |
| `INV-T2-SETTINGS-EVENTS`  | `node.settings`      | `bus.control`     |      2 | Ledger node wins over stale `node.server` prose                     |
| `INV-T2-VCS-EVENTS`       | `node.vcs`           | `bus.vcs`         |      1 |                                                                     |

---

## B2 file-db-process-config

**Outcome:** File I/O, SQLite projection, process-flag configuration, and persistence-adjacent callbacks capture at declared success boundaries with ledger-bounded equality (including large `INV-T2-PROJECT-SQL` aggregate).

**Depends on:** WP4 frozen; WP1 row loader projecting SQL/file phases from ledger (no hand-maintained phase list); **B4 integrator** for `provider/**` and **B5 integrator** for `Manager.ts` handoffs ([serial hotspots](#wp5-serial-hotspots-normative)).

**Proposed file owner:** `apps/server/src/scm/g9FamilyFileDbProcessConfig.ts` — authors capture helpers and **patch handoffs**; does **not** commit directly to `provider/**`, `Manager.ts`, `T2Observability.ts`, `serverSettings.ts`, `VcsDriver.ts`, or `relayClient.ts`.

**Primary live file surfaces (text):**

- `apps/server/src/persistence/Services/Projection*.ts` (turns, checkpoints, projects, state, pending approvals)
- `apps/server/src/persistence/NodeSqliteClient.ts`
- `apps/server/src/persistence/ProviderSessionRuntime.ts` (`INV-T2-FILE-PROVIDER-SESSION` phases on this module — B2 may commit here)
- `apps/server/src/config.ts`, `apps/server/src/cli/config.ts`
- `apps/server/src/serverRuntimeState.ts`
- `apps/server/src/vcs/GitVcsDriverCore.ts`
- `apps/server/src/orchestration/Services/ProjectionSnapshotQuery.ts`

**B2-owned phases — integrator handoff only (no direct B2 commit to these live files):**

| Live file                                                 | `comm_id` / phase                                                                                            | Integrator                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `apps/server/src/provider/Layers/ProviderEventLoggers.ts` | `INV-T2-FILE-LOGS` / `providerEventLogPath-writer-succeeded`                                                 | **B4** ([merge sequence](#provider-merge-sequence-b4-integrator))   |
| `apps/server/src/provider/providerStatusCache.ts`         | `INV-T2-FILE-PROVIDER-SESSION` / cache read+write phases                                                     | **B4**                                                              |
| `apps/server/src/provider/Layers/codexLaunchArgs.ts`      | `INV-T2-FLAG-CODEX-LAUNCH` / `flag-resolved`                                                                 | **B4**                                                              |
| `apps/server/src/terminal/Manager.ts`                     | `INV-T2-FILE-LOGS` / `terminalLogs-writer-succeeded`; `INV-T2-FLAG-TERM-ENV` / `terminal-child-env-filtered` | **B5** ([merge sequence](#manager.ts-merge-sequence-b5-integrator)) |
| `apps/server/src/serverSettings.ts`                       | `INV-T2-FILE-SETTINGS` phases                                                                                | **B1**                                                              |
| `apps/server/src/vcs/VcsDriver.ts`                        | `INV-T2-FILE-CHECKPOINTS` phases                                                                             | **B3**                                                              |
| `packages/shared/src/relayClient.ts`                      | `INV-T2-FLAG-CLOUDFLARED` / `flag-resolved`                                                                  | **B3**                                                              |
| `apps/server/src/t2Observability/T2Observability.ts`      | `INV-T2-FLAG-T2-OTEL` / `flag-resolved`                                                                      | **WP6-Consumer-Owner** (RFC-005 **A**)                              |

**Acceptance gate:**

- Per-phase success predicates from ledger exercised in tests; no SQL text / file bytes in `A` or observations.
- Process-config phases capture **flag presence/shape** only at declared sites (no new env parsing).
- `INV-T2-PROJECT-SQL`: all 41 phases map to exact projection service symbols in ledger — one module may fan out internally but must not invent phases.
- B2-owned `provider/**` phases: acceptance requires B4-landed hooks plus B2 family tests calling `captureOccurrence` with ledger `input` shapes.
- **`serverLogPath-declared-no-live-writer`:** canonical-absence / fixture-only; **do not** add a production server logger; B2 gate is declaration fixture + zero live `captureOccurrence` (not “one live success → one capture”).

**Non-goals:** Direct WP5 commits under `apps/server/src/provider/**` (hand off to B4); direct WP5 commits to `Manager.ts` (hand off to B5); direct commits to `T2Observability.ts` (hand off to WP6); capturing generic HTTP/RPC (WP6 protocol / typed-hook rows, not B4); subprocess git/sc CLI (B3); collapsing SQL rows into one comm_id.

**Ledger `comm_id`s (18):**

`INV-T2-FILE-ATTACHMENTS`, `INV-T2-FILE-CHECKPOINTS`, `INV-T2-FILE-LOGS`, `INV-T2-FILE-PROVIDER-SESSION`, `INV-T2-FILE-RUNTIME-STATE`, `INV-T2-FILE-SECRETS`, `INV-T2-FILE-SETTINGS`, `INV-T2-FILE-USAGE-CACHE`, `INV-T2-FILE-WORKTREES`, `INV-T2-FLAG-CLOUDFLARED`, `INV-T2-FLAG-CODEX-LAUNCH`, `INV-T2-FLAG-SERVER-CONFIG`, `INV-T2-FLAG-T2-OTEL`, `INV-T2-FLAG-T3-OTEL`, `INV-T2-FLAG-TERM-ENV`, `INV-T2-PROJECT-READ`, `INV-T2-PROJECT-SQL`, `INV-T2-SQLITE`

---

## B3 subprocess-external-transport

**Outcome:** Subprocess spawns, external HTTP/TCP/relay/analytics control transports, and SC CLI/API boundaries capture at success without instrumenting Effect global patches.

**Depends on:** WP4 frozen; no production home-bus-link.

**Proposed file owner:** `apps/server/src/scm/g9FamilySubprocessExternalTransport.ts`

**Primary live file surfaces (text):**

- `apps/server/src/process/externalLauncher.ts`
- `apps/server/src/vcs/VcsDriver.ts` (**B3 sole** WP5 lander; integrates B2 checkpoints handoff)
- `apps/server/src/project/ProjectSetupScriptRunner.ts`
- `apps/server/src/preview/PortScanner.ts`
- `apps/server/src/sourceControl/*Cli.ts`, `apps/server/src/sourceControl/BitbucketApi.ts`
- `packages/shared/src/Net.ts`
- `packages/shared/src/relayClient.ts` (**B3 sole** WP5 lander; integrates B2 cloudflared handoff)
- `apps/server/src/cloud/http.ts`, `apps/server/src/relay/AgentAwarenessRelay.ts`
- `apps/server/src/serverRuntimeStartup.ts`
- `packages/tailscale/src/tailscale.ts`
- `apps/server/src/telemetry/AnalyticsService.ts`

**Handoff-only (no direct B3 commit):**

| Live file                                                       | Phase                        | Integrator |
| --------------------------------------------------------------- | ---------------------------- | ---------- |
| `apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts` | `INV-T2-TEL-DESKTOP-CONTROL` | **B5**     |

**Acceptance gate:**

- Subprocess phases: capture only on declared success (exit/status predicates in ledger), not per-byte PTY streams.
- External transport phases: bounded `A` from ledger **success** finite domains only; live socket/http behavior unchanged when G9 absent.
- **`INV-T2-SC-BITBUCKET` (RFC-011 applied):** success `request_label` / `A.operation` is exactly the 10 `BitbucketApiOperation` members from source (`resolveRepository` … `request`). Typed failure identities and English error strings are **not** success fixtures (extractor fixed; do not reintroduce).

**Non-goals:** Provider ACP/session protocol (B4); terminal PTY lifecycle (B5); OTLP export hooks (WP6 deferral rows); payload/error-string retention in `A`.

**Ledger `comm_id`s (16):**

`INV-T2-EDITOR-LAUNCH`, `INV-T2-GIT`, `INV-T2-HTTP-SERVE`, `INV-T2-NET-TCP`, `INV-T2-PREVIEW-SCAN`, `INV-T2-PROJECT-SETUP`, `INV-T2-RELAY-AWARENESS`, `INV-T2-RELAY-CLIENT`, `INV-T2-RELAY-HTTP`, `INV-T2-SC-ADO`, `INV-T2-SC-BITBUCKET`, `INV-T2-SC-GITHUB`, `INV-T2-SC-GITLAB`, `INV-T2-TAILSCALE`, `INV-T2-TEL-ANALYTICS`, `INV-T2-TEL-DESKTOP-CONTROL`

---

## B4 provider-protocol

**Outcome:** Environment HTTP APIs, provider adapter/session runtimes, provider queue events, and MCP HTTP **non-hook** phases capture at live success boundaries.

**Depends on:** WP4 frozen; WP6 owns all RpcServer + MCP session-delete + OTLP typed hooks per [WP6 deferral](#wp6-deferral-planned_typed_hooks).

**Proposed file owner:** `apps/server/src/scm/g9FamilyProviderProtocol.ts` — **sole WP5 committer** to `apps/server/src/provider/**` capture surfaces ([serial hotspots](#wp5-serial-hotspots-normative)); integrates [B2→B4 handoffs](#provider-merge-sequence-b4-integrator) before B4-owned protocol rows on the same branch.

**Primary live file surfaces (text):**

- `packages/contracts/src/environmentHttp.ts`
- `apps/server/src/http.ts`
- `apps/server/src/provider/Layers/*Adapter.ts`, `ProviderService.ts`, `ProviderRegistry.ts`, `ProviderEventLoggers.ts`, `codexLaunchArgs.ts`
- `apps/server/src/provider/providerStatusCache.ts`
- `apps/server/src/provider/acp/AcpSessionRuntime.ts`
- `apps/server/src/provider/Layers/OpenCodeAdapter.ts`, `opencodeRuntime.ts`

**Handoff-only (no direct B4 commit):**

| Live file                              | Phase                                                     | Integrator             |
| -------------------------------------- | --------------------------------------------------------- | ---------------------- |
| `apps/server/src/mcp/McpHttpServer.ts` | `mcp-http-message-admitted`, `mcp-http-handler-succeeded` | **WP6-Consumer-Owner** |

**Acceptance gate:**

- HTTP Environment APIs: one occurrence per declared handler success phase; no generic middleware capture.
- Provider rows: capture at turn/permission/session boundaries per ledger; no tracer in adapters.
- `INV-T2-MCP-HTTP`: B4 authors `mcp-http-message-admitted` and `mcp-http-handler-succeeded` as handoffs; **`mcp-http-session-deleted` deferred to WP6** (`planned_typed_hooks`).
- B2 handoff files (`ProviderEventLoggers.ts`, `providerStatusCache.ts`, `codexLaunchArgs.ts`): B4-landed hooks satisfy B2 acceptance for those phases; B4 does not re-home those `comm_id`s out of bundle B2.

**Non-goals:** RpcServer admit/unary/stream (`planned_typed_hooks` — **WP6**); editing `terminal/Manager.ts` (any phase — **B5** integrator); **planning ownership** of `INV-T2-FILE-LOGS` (remains **B2** — B4 lands only the `provider/**` phase `providerEventLogPath-writer-succeeded`, not the `Manager.ts` phase `terminalLogs-writer-succeeded`); capturing OTLP post-success (`INV-T2-TEL-*-OTLP` deferred rows); non-provider queue rows (B1); direct commits to `McpHttpServer.ts` or `ws.ts`.

**Ledger `comm_id`s (16):**

`INV-T2-HTTP-AUTH`, `INV-T2-HTTP-CONNECT`, `INV-T2-HTTP-META`, `INV-T2-HTTP-ORCH`, `INV-T2-HTTP-PR`, `INV-T2-HTTP-STATIC`, `INV-T2-MCP-HTTP`, `INV-T2-PROVIDER-CLAUDE`, `INV-T2-PROVIDER-CODEX`, `INV-T2-PROVIDER-CURSOR`, `INV-T2-PROVIDER-EVENTS`, `INV-T2-PROVIDER-GROK`, `INV-T2-PROVIDER-LIST-EVENTS`, `INV-T2-PROVIDER-OPENCODE`, `INV-T2-PROVIDER-PERM`, `INV-T2-PROVIDER-TURN`

---

## B5 terminal-local-streams

**Outcome:** Terminal manager phases, native resource monitor streams, desktop inbound telemetry, and non-OTLP telemetry export paths capture with strict payload exclusion (no terminal body / stream bytes in `A`).

**Depends on:** WP4 frozen; **serial integrator** for `apps/server/src/terminal/Manager.ts` ([merge sequence](#manager.ts-merge-sequence-b5-integrator)).

**Proposed file owner:** `apps/server/src/scm/g9FamilyTerminalLocalStreams.ts` — integrates B2 `Manager.ts` patches before landing TERM capture.

**Primary live file surfaces (text):**

- `apps/server/src/terminal/Manager.ts`
- `apps/server/src/resourceTelemetry/NativeTelemetryClient.ts`
- `apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts` (**B5 sole** WP5 lander; integrates B3 desktop-control handoff)

**Handoff-only (no direct B5 commit):**

| Live file                                               | Phase                                           | Integrator                             |
| ------------------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| `apps/server/src/t2Observability/T2Observability.ts`    | `INV-T2-TEL-NDJSON` / `ndjson-export-succeeded` | **WP6-Consumer-Owner** (RFC-005 **A**) |
| `apps/server/src/observability/Layers/Observability.ts` | `INV-T2-TEL-T3-TRACE` phases                    | **WP6-Consumer-Owner** (RFC-014 **A**) |

**Acceptance gate:**

- `INV-T2-TERM`: all six phases executable per ledger predicates; no PTY byte capture.
- `INV-T2-RES-MONITOR` + `INV-T2-TEL-DESKTOP-IN`: stream element phases only where ledger marks stream family.
- Telemetry-export family rows here are **not** the WP6 OTLP post-success hooks; NDJSON / T3-TRACE land via WP6 sole lander after B5 handoff.

**Non-goals:** OTLP / RpcServer `planned_typed_hooks` rows (WP6); process-config flag on terminal env (B2 owns flag phase); direct commits to `T2Observability.ts` or `Observability.ts`.

**Ledger `comm_id`s (5):**

`INV-T2-RES-MONITOR`, `INV-T2-TEL-DESKTOP-IN`, `INV-T2-TEL-NDJSON`, `INV-T2-TEL-T3-TRACE`, `INV-T2-TERM`

---

## B6 dormant-home-bus-link

**Outcome:** Fixture-backed validation for dormant `INV-T2-SCM-HOME-BUS-LINK` only — **no production fabric**, no roster coordinator `BidirectionalHomeBusLink`, no live forward re-bridge.

**Depends on:** WP4 frozen; WP8 fixture runner consumes generated vectors.

**Proposed file owner:** `apps/server/src/scm/g9FamilyHomeBusLinkFixtures.ts` (test/fixture helpers only; not production wiring)

**Primary live file surfaces (text):**

- `apps/server/src/scm/g6HomeBusLink.ts` (capture site reference in ledger — **fixtures must not instantiate production link**)

**Acceptance gate:**

- Dormant row status remains `dormant-prototype` in validation; B6 fixtures **may** call `captureOccurrence` to enqueue for WP8 W1 proof; production bootstrap never activates home-bus-link (WP7 / RFC-019).
- Zero occurrences from production server paths.

**Non-goals:** Using home-bus-link as clock target; creating occurrences via live forward bridge; WP7 composition.

**Ledger `comm_id`s (1):**

| `comm_id`                  | `node_id`         | `home_bus_id` | Status              |
| -------------------------- | ----------------- | ------------- | ------------------- |
| `INV-T2-SCM-HOME-BUS-LINK` | `node.scm.home-a` | `bus.scm.a`   | `dormant-prototype` |

---

## WP6-deferred rows (ledger reference)

Full rows **not** assigned to B1–B6 family modules:

| `comm_id`            | Phases | Primary surfaces                                        |
| -------------------- | -----: | ------------------------------------------------------- |
| `INV-T2-TEL-T2-OTLP` |      1 | `apps/server/src/t2Observability/T2Observability.ts`    |
| `INV-T2-TEL-T3-OTLP` |      2 | `apps/server/src/observability/Layers/Observability.ts` |

---

## Authoritative cross-links

| Document                                     | Role                                       |
| -------------------------------------------- | ------------------------------------------ |
| `docs/scm/g9/manager-charter.md`             | U2 unit; blind consensus; no runtime       |
| `docs/scm/g9/planning-scope.md`              | WP5–WP8 planning authorized; runtime false |
| `docs/scm/g9/integration-readiness.md`       | WP5 row; parallelization; hotspots         |
| `docs/scm/g9/wp1-wp4-foundation-cohesion.md` | `captureOccurrence` only; slice pointer    |
| `docs/scm/g9/wp5/bundle-index.md`            | Short index to this plan                   |

---

_U2 deliverable: definition only. No runtime files. No commits._

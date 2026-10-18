# B2 → B4 handoff: `provider/**`

<!-- Agent: W5a patch description only. B4 is sole WP5 lander for provider/**. B2 must not commit under provider/**. -->

- Bundle owner: **B2** (`g9FamilyFileDbProcessConfig.ts`)
- Integrator: **B4** (`g9FamilyProviderProtocol.ts` owner)
- Live tree: `apps/server/src/provider/**`
- Helper module: `apps/server/src/scm/g9FamilyFileDbProcessConfig.ts`
- Merge rule: plan § provider/\*\* merge sequence (B4 integrator). Integrate these B2 phases before B4-owned protocol rows on the same branch.

## Phases to land

| `comm_id`                      | `phase_id`                              | Ledger `capture_module`                   | Helper export                                                                            | Capture input                                                                   |
| ------------------------------ | --------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `INV-T2-FILE-LOGS`             | `providerEventLogPath-writer-succeeded` | `provider/Layers/ProviderEventLoggers.ts` | `captureProviderEventLogWriterSucceeded` / `buildProviderEventLogWriterCaptureInput`     | `{ member_id: "providerEventLogPath" }`                                         |
| `INV-T2-FILE-PROVIDER-SESSION` | `provider-status-cache-read-succeeded`  | `provider/providerStatusCache.ts`         | `captureProviderStatusCacheReadSucceeded` / `buildProviderStatusCacheReadCaptureInput`   | `{ member_id: "provider-status-cache" }`                                        |
| `INV-T2-FILE-PROVIDER-SESSION` | `provider-status-cache-write-succeeded` | `provider/providerStatusCache.ts`         | `captureProviderStatusCacheWriteSucceeded` / `buildProviderStatusCacheWriteCaptureInput` | `{ member_id: "write" }`                                                        |
| `INV-T2-FLAG-CODEX-LAUNCH`     | `flag-resolved`                         | `provider/Layers/codexLaunchArgs.ts`      | `captureFlagCodexLaunchResolved` / `buildFlagCodexLaunchResolvedCaptureInput`            | `{ member: "T3CODE_CODEX_LAUNCH_ARGS", state_label: "configured" \| "absent" }` |

Not in this handoff: `provider-session-binding-*` on `persistence/ProviderSessionRuntime.ts` (B2 may land those itself). Not in this handoff: `terminalLogs-writer-succeeded` (B2→B5).

## Exact call sites

### 1. `providerEventLogPath-writer-succeeded`

- File: `apps/server/src/provider/Layers/ProviderEventLoggers.ts`
- Anchor: after `EventNdjsonLogger.makeEventNdjsonLogStore(providerEventLogPath, ...)` succeeds (~66–74) when the store is created for writing.
- Call: `yield* captureProviderEventLogWriterSucceeded(capture)`.
- Do not retain log path or NDJSON bytes in `input`.

### 2. `provider-status-cache-read-succeeded`

- File: `apps/server/src/provider/providerStatusCache.ts`
- Symbol: `readProviderStatusCache` (~118).
- When: after a successful decode path that returns a cached provider (not `undefined` from missing/empty/parse-failure).
- Call: `yield* captureProviderStatusCacheReadSucceeded(capture)`.
- Input `member_id` is the ledger token `"provider-status-cache"`, not a filesystem path.

### 3. `provider-status-cache-write-succeeded`

- File: `apps/server/src/provider/providerStatusCache.ts`
- Symbol: `writeProviderStatusCache` (~144); after `writeFileStringAtomically` succeeds.
- Call: `yield* captureProviderStatusCacheWriteSucceeded(capture)`.
- Input `member_id` is the ledger token `"write"`.

### 4. `INV-T2-FLAG-CODEX-LAUNCH` / `flag-resolved`

- File: `apps/server/src/provider/Layers/codexLaunchArgs.ts`
- Symbol: `resolveCodexLaunchArgs` (~5–8); env key `T3CODE_CODEX_LAUNCH_ARGS`.
- When: once per successful flag resolution at the declared site.
  - `state_label: "configured"` when the env (or explicit launchArgs) yields a non-empty trimmed string.
  - `state_label: "absent"` when both are empty.
- Call: `yield* captureFlagCodexLaunchResolved(state_label, capture)`.
- Do not invent new env parsing. Capture presence/shape only.

## Integrator checklist

1. Import B2 helpers; do not re-home `comm_id` ownership out of B2.
2. Use live-safe `captureOccurrence` only; no FIFO ownership in provider code.
3. One success → one capture. Failed reads/writes → no capture.
4. Run B2 family tests for these input shapes after landing hooks.

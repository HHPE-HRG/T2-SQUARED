# B2 → B5 handoff: `terminal/Manager.ts`

<!-- Agent: W5a patch description only. B5 is sole WP5 lander for Manager.ts. B2 must not commit Manager.ts. -->

- Bundle owner: **B2** (`g9FamilyFileDbProcessConfig.ts`)
- Integrator: **B5** (`g9FamilyTerminalLocalStreams.ts` owner)
- Live file: `apps/server/src/terminal/Manager.ts`
- Helper module: `apps/server/src/scm/g9FamilyFileDbProcessConfig.ts`
- Merge rule: plan § Manager.ts merge sequence (B5 integrator). Integrate this handoff before B5 TERM phases on the same branch.

## Phases to land

| `comm_id`              | `phase_id`                      | Helper export                                                                | Capture input                             |
| ---------------------- | ------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------- |
| `INV-T2-FILE-LOGS`     | `terminalLogs-writer-succeeded` | `captureTerminalLogsWriterSucceeded` / `buildTerminalLogsWriterCaptureInput` | `{ member_id: "terminalLogs" }`           |
| `INV-T2-FLAG-TERM-ENV` | `terminal-child-env-filtered`   | `captureFlagTermEnvFiltered` / `buildFlagTermEnvFilteredCaptureInput`        | `{ kind: "terminal-child-env-filtered" }` |

Not in this handoff: `providerEventLogPath-writer-succeeded` (B2→B4). Not in this handoff: `INV-T2-TERM` (B5-owned).

## Exact call sites

### 1. `terminalLogs-writer-succeeded`

- Symbol: terminal history persistence inside `Manager.ts` `make` / session service.
- Anchors: `historyPath` (~1263); successful `fileSystem.writeFileString(...)` at ~1429 (history save), ~1495 / ~1534 (capped history rewrite).
- When: after a write that completes without error for the terminal log file under `terminalLogsDir`.
- Call: `yield* captureTerminalLogsWriterSucceeded(capture)` (or `captureB2Occurrence(buildTerminalLogsWriterCaptureInput(), capture)`).
- Do not put path strings or file bytes in `input`.

### 2. `terminal-child-env-filtered`

- Symbols: `shouldExcludeTerminalEnvKey` (~1086); `createTerminalSpawnEnv` (~1153); spawn site ~1928 (`createTerminalSpawnEnv(baseEnv, session.runtimeEnv)`).
- When: after `createTerminalSpawnEnv` returns the filtered child env that will be passed to the PTY spawn (one capture per successful filter application at spawn, not per excluded key).
- Call: `yield* captureFlagTermEnvFiltered(capture)`.
- Do not re-parse env. Do not capture excluded key names. Equality A is kind-only.

## Integrator checklist

1. Import helpers from `g9FamilyFileDbProcessConfig.ts` only (no FIFO / coordinator ownership in Manager).
2. Inject the same live-safe `G9CaptureService.captureOccurrence` (or equivalent `G9B2CaptureFn`) used elsewhere; absent service → no behavioral change.
3. One live success → one `captureOccurrence`.
4. Run B2 family tests plus any Manager-targeted tests B5 already owns for these hooks.

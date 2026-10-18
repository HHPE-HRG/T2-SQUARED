# B2 → B1 handoff: `serverSettings.ts`

<!-- Agent: W5a patch description only. B1 is sole WP5 lander for serverSettings.ts. B2 must not commit serverSettings.ts. -->

- Bundle owner: **B2** (`g9FamilyFileDbProcessConfig.ts`)
- Integrator: **B1** (`g9FamilyQueuePubSubCallback.ts` owner)
- Live file: `apps/server/src/serverSettings.ts`
- Helper module: `apps/server/src/scm/g9FamilyFileDbProcessConfig.ts`
- Row: `INV-T2-FILE-SETTINGS` (3 phases)

## Phases to land

| `phase_id`                       | Helper export                                                                | Capture input                |
| -------------------------------- | ---------------------------------------------------------------------------- | ---------------------------- |
| `settings-file-exists-succeeded` | `captureSettingsFileExistsSucceeded` / `buildSettingsFileExistsCaptureInput` | `{ operation: "succeeded" }` |
| `settings-file-read-succeeded`   | `captureSettingsFileReadSucceeded` / `buildSettingsFileReadCaptureInput`     | `{ operation: "succeeded" }` |
| `settings-file-write-succeeded`  | `captureSettingsFileWriteSucceeded` / `buildSettingsFileWriteCaptureInput`   | `{ operation: "write" }`     |

## Exact call sites

### 1. `settings-file-exists-succeeded`

- Symbol: `readConfigExists` (~269) wrapping `fs.exists(settingsPath)`.
- When: after exists check succeeds (boolean result obtained without error), at the declared success boundary for the exists operation.
- Call: `yield* captureSettingsFileExistsSucceeded(capture)`.
- Do not put `settingsPath` in `input`. Ledger A is operation-token only.

### 2. `settings-file-read-succeeded`

- Symbols: `readRawConfig` (~280) / `loadSettingsFromDisk` (~291) successful read+decode path used by settings cache lookup (~309–311).
- When: after a successful settings file read that yields usable settings (not the missing-file early path alone unless ledger predicates treat exists separately; capture read only when the read path succeeds).
- Call: `yield* captureSettingsFileReadSucceeded(capture)`.
- Do not retain file bytes or JSON body in `input`.

### 3. `settings-file-write-succeeded`

- Symbol: `writeSettingsAtomically` (~479); successful `writeFileStringAtomically` (~485).
- When: after atomic write completes without error.
- Call: `yield* captureSettingsFileWriteSucceeded(capture)`.
- Input `operation` must be `"write"` (ledger quirk vs exists/read `"succeeded"`).

## Integrator checklist

1. B1 lands these hooks on `serverSettings.ts` only; B2 supplies helpers.
2. Live-safe `captureOccurrence` only; absent service → settings behavior unchanged.
3. No SQL/file bytes in A. Path stays out of equality.
4. Exercise B2 family tests for the three builder shapes after landing.

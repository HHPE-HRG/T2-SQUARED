# INV-T2-FLAG-TERM-ENV steward decision packet

<!-- Agent: historical evidence. Resolved by docs/scm/g9/steward-two-decisions.md. Not G9 runtime. -->

Status: **resolved** 2026-09-30 by combined steward record (preferred option applied). Do not treat this packet as current inventory law.

Applied: keep `comm_id`; G1B child-env filter; all `T3CODE_*` and `VITE_*` excluded; G9 counted phase `terminal-child-env-filtered`. Rejected: retire the row.

## Exact former G1B claim (historical)

From `docs/scm/g1b/inventory.json` row `INV-T2-FLAG-TERM-ENV` before WP0:

- `name`: `Terminal T3CODE_ env passthrough`
- `sender`: `server process env`
- `receiver`: `PTY child processes`
- `transport_boundary`: `filtered T3CODE_* env (T3CODE_PORT stripped)`
- `mechanism_classes`: `["process-flags"]`
- `symbols`: `["apps/server/src/terminal/Manager.ts"]`

The former inventoried communication was a successful passthrough of `T3CODE_*` variables into the PTY child, with only `T3CODE_PORT` removed.

## Exact exclusion predicate

`apps/server/src/terminal/Manager.ts` `shouldExcludeTerminalEnvKey`:

- `key.toUpperCase().startsWith("T3CODE_")` → exclude
- `key.toUpperCase().startsWith("VITE_")` → exclude
- otherwise `TERMINAL_ENV_BLOCKLIST` membership

Every `T3CODE_*` key is excluded. There is no `T3CODE_PORT`-only special case.

createTerminalSpawnEnv applies runtimeEnv after the exclusion loop. Those keys are not passed through shouldExcludeTerminalEnvKey. Manager.test.ts test "injects runtime env overrides into spawned terminals" keeps T3CODE_PROJECT_ROOT and T3CODE_WORKTREE_PATH on the spawn.

G3 placement (unchanged): `node.terminal` / `bus.terminal`. `INV-T2-TERM` independently owns spawn.

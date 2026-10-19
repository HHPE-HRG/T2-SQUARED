# S7 → S4 lander handoff: `INV-T2-FLAG-CODEX-LAUNCH` on `codexLaunchArgs.ts`

<!-- Agent: G10 S4 authoring. Do not claim S4 exit (a) for FLAG-CODEX-LAUNCH. -->

- Date: 2026-10-18
- Planning owner: **G10-S7** (FLAG-CODEX-LAUNCH `comm_id`)
- Sole lander file: **S4** (`apps/server/src/provider/**` per cohesion)
- Live file: `apps/server/src/provider/Layers/codexLaunchArgs.ts`
- Prior G9 note: `docs/scm/g9/wp5/handoffs/b2-to-b4-provider.md`
- Machine note: `G10_S4_FLAG_CODEX_LAUNCH_HANDOFF_FROM_S7` in `g10SliceS4.ts`
- Status: **landed** (S8 lander reopen on S4 `codexLaunchArgs.ts`;
  `G10_S4_FLAG_CODEX_LAUNCH_HANDOFF_FROM_S7`)

## Why reserved

S7 owns `INV-T2-FLAG-CODEX-LAUNCH` / `flag-resolved`. Cohesion assigns sole
file lander for `provider/**` to **S4**. S4 wires `INV-T2-PROVIDER-CODEX`
spawn on `CodexSessionRuntime.ts` but must **not** steal FLAG-CODEX-LAUNCH
under S4 dual-run-exit (a).

## Phase (S7 owns)

| `comm_id`                  | `phase_id`      | Module               |
| -------------------------- | --------------- | -------------------- |
| `INV-T2-FLAG-CODEX-LAUNCH` | `flag-resolved` | `codexLaunchArgs.ts` |

## S4 honesty (do not claim)

- S4 dual-run-exit **(a)/(e)** does **not** include FLAG-CODEX-LAUNCH.
- S4 `providerCodexViaG10Bridge` wraps spawn only — not `resolveCodexLaunchArgs`.

## Non-goals

- Do not steal FILE-PROVIDER-SESSION or FILE-LOGS provider-event-log here.
- Do not flip auth flags or resize campaign radius.

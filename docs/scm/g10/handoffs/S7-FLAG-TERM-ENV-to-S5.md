# S7 → S5 lander handoff: `INV-T2-FLAG-TERM-ENV` on `Manager.ts`

<!-- Agent: G10 S7 authoring only. Do not edit Manager.ts for this row in S7. -->

- Date: 2026-10-18
- Planning owner: **G10-S7** (FLAG-TERM-ENV `comm_id`)
- Sole lander: **S5** (`apps/server/src/terminal/Manager.ts`)
- Live file: `apps/server/src/terminal/Manager.ts`
- Prior G9 note: `docs/scm/g9/wp5/handoffs/b2-to-b5-manager.md`
- Machine note: `G10_S7_FLAG_TERM_ENV_HANDOFF` in `g10SliceS7.ts`; reception
  `G10_S5_FLAG_TERM_ENV_HANDOFF_FROM_S7` in `g10SliceS5.ts`
- Status: **landed** (S8 lander reopen on S5 `Manager.ts`;
  `G10_S5_FLAG_TERM_ENV_HANDOFF_FROM_S7`)

## Why deferred

S7 owns `INV-T2-FLAG-TERM-ENV` at the `comm_id` layer. Cohesion assigns sole
file lander for `Manager.ts` to **S5**. S7 must not commit that file. S5 wires
TERM only — must not steal FLAG-TERM-ENV under S5 exit (a).

## Phase

| Field             | Value                                     |
| ----------------- | ----------------------------------------- |
| `comm_id`         | `INV-T2-FLAG-TERM-ENV`                    |
| `phase_id`        | `terminal-child-env-filtered`             |
| Equality A        | `{ kind: "terminal-child-env-filtered" }` |
| Success predicate | child env filter completes                |
| False filter      | no cutover record / no G9 capture         |

## Patch for S5 sole lander

Wire admit/route/replace via `g10SeamBridge` at existing
`captureFlagTermEnvFiltered` site in `Manager.ts`. Do not wrap TERM phases
under this handoff.

## S7 honesty (do not claim)

- S7 dual-run-exit **(a)/(e)** does **not** include FLAG-TERM-ENV.
- S7 ≡ includes a FLAG-TERM-ENV **stub pair** only.
- S7 does **not** edit `Manager.ts` for this row.

## Non-goals

- Do not steal FILE-LOGS terminalLogs here (separate S7→S5 handoff).
- Do not steal INV-T2-TERM (S5).

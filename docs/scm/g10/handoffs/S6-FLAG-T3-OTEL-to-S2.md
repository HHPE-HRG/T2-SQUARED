# S6 → S2 handoff: `INV-T2-FLAG-T3-OTEL` on `cli/config.ts`

<!-- Agent: G10 S6 authoring only. Do not edit apps/server/src/cli/config.ts in S6. -->

- Date: 2026-10-18
- Planning owner: **G10-S6-ObsEffect** (`g10SliceS6.ts`)
- Sole lander: **S2** (`cli/config.ts` per `cross-slice-cohesion-index.md`)
- Live file: `apps/server/src/cli/config.ts`
- Machine note: `G10_S6_FLAG_T3_OTEL_HANDOFF` in `apps/server/src/scm/g10SliceS6.ts`
- Status: **landed** (S8 lander reopen on S2 `cli/config.ts`;
  `G10_S2_FLAG_T3_OTEL_HANDOFF_LANDED_FROM_S6`)

## Why deferred

S6 owns `INV-T2-FLAG-T3-OTEL` at the `comm_id` layer. Cohesion assigns **sole
file lander** for `apps/server/src/cli/config.ts` to **S2**. S6 must not commit
that file. No S6-owned runtime path exists for T3 OTEL flag resolve outside
`cli/config.ts` / `EnvServerConfig`, so S6 records FLAG-T3-OTEL as
**handoff-deferred** (same honesty pattern S2 used for ORCH-LIVE → S6 and S5
used for TEL-NDJSON → S6).

## Phase

| Field             | Value                              |
| ----------------- | ---------------------------------- |
| `comm_id`         | `INV-T2-FLAG-T3-OTEL`              |
| `phase_id`        | `flag-resolved`                    |
| Equality A        | `{ comm_id: "resolved" }` only     |
| Success predicate | T3 OTEL env/config members resolve |
| False resolve     | no cutover record / no G9 capture  |

## Patch for S2 sole lander

Wire admit/route/replace via `g10SeamBridge` (S2 controller or shared install)
at the T3 OTEL flag resolution site inside `EnvServerConfig` /
`resolveServerConfig`. Keep G9 flag capture as observe-beside — cutover ≠
capture.

Suggested helper shape (S2 implements; names illustrative):

```ts
yield * resolveFlagT3OtelViaG10Bridge(EnvServerConfig /* or T3 OTEL member resolve */);
```

Absent S2 controller / not replaced ⇒ today’s Config resolve only.

## S6 honesty (do not claim)

- S6 dual-run-exit **(a)/(e)** does **not** include FLAG-T3-OTEL.
- S6 ≡ includes a FLAG-T3-OTEL **stub pair** for Ordered-proof carrier coverage only.
- S6 does **not** edit or commit `cli/config.ts`.

## Non-goals for this handoff

- Do not steal FLAG-SERVER-CONFIG under this note (already S2-wired).
- Do not land ORCH-LIVE / TEL-NDJSON / TEL-T3-TRACE here (S6 sole landers).
- Do not activate dormant `INV-T2-SCM-HOME-BUS-LINK`.
- Do not flip auth flags or resize campaign radius.

## Integrator checklist (S2)

1. Land FLAG-T3-OTEL bridge on `cli/config.ts` only; consume this handoff.
2. Keep G9 live-safe capture beside cutover I/O.
3. Complete S2 Ordered proof extension / S8 audit for FLAG-T3-OTEL when wired
   (S6 exit (a) does not claim this row).
4. Leave S6 evidence FLAG-T3-OTEL stub claims unchanged (historical honesty).

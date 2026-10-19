# S7 → S3 lander handoff: `INV-T2-FLAG-CLOUDFLARED` on `relayClient.ts`

<!-- Agent: G10 S7 authoring only. Do not edit relayClient.ts in S7. -->

- Date: 2026-10-18
- Planning owner: **G10-S7** (FLAG-CLOUDFLARED `comm_id`)
- Sole lander: **S3** (`packages/shared/src/relayClient.ts`)
- Live file: `packages/shared/src/relayClient.ts`
- Prior G9 note: `docs/scm/g9/wp5/handoffs/B3-relayClient-RELAY-CLIENT.md`
- Machine note: `G10_S7_FLAG_CLOUDFLARED_HANDOFF` in `g10SliceS7.ts`; reception
  `G10_S3_FLAG_CLOUDFLARED_HANDOFF_FROM_S7` in `g10SliceS3.ts`
- Status: **landed** (S8 lander reopen on S3 `relayClient.ts`;
  `G10_S3_FLAG_CLOUDFLARED_HANDOFF_FROM_S7`)

## Why deferred

S7 owns `INV-T2-FLAG-CLOUDFLARED` at the `comm_id` layer. Cohesion assigns
**sole file lander** for `relayClient.ts` to **S3**. S7 must not commit that
file. S3 wires RELAY-CLIENT only — must not steal FLAG-CLOUDFLARED under S3
exit (a).

## Phase

| Field             | Value                                                                          |
| ----------------- | ------------------------------------------------------------------------------ |
| `comm_id`         | `INV-T2-FLAG-CLOUDFLARED`                                                      |
| `phase_id`        | `flag-resolved`                                                                |
| Equality A        | `{ member: "T3CODE_CLOUDFLARED_PATH", state_label: "configured" \| "absent" }` |
| Success predicate | executableOverride / env resolve completes                                     |
| False resolve     | no cutover record / no G9 capture                                              |

## Patch for S3 sole lander

Wire admit/route/replace via `g10SeamBridge` at the cloudflared path resolve
success site beside existing G9 `captureFlagCloudflaredResolved`.

Absent S7 controller / not replaced ⇒ today’s resolve only.

## S7 honesty (do not claim)

- S7 dual-run-exit **(a)/(e)** does **not** include FLAG-CLOUDFLARED.
- S7 ≡ includes a FLAG-CLOUDFLARED **stub pair** only.
- S7 does **not** edit or commit `relayClient.ts`.

## Non-goals

- Do not steal RELAY-CLIENT under this note (S3).
- Do not land FILE-CHECKPOINTS here (separate S7→S3 handoff).

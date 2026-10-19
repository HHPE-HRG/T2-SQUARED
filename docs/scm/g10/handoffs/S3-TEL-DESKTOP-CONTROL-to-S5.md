# S3 → S5 handoff: `INV-T2-TEL-DESKTOP-CONTROL` on `DesktopTelemetryReceiver.ts`

<!-- Agent: G10 S3 authoring only. Do not edit DesktopTelemetryReceiver.ts in S3. -->

- Date: 2026-10-18
- Planning owner: **G10-S3-GitRelay** (`g10SliceS3.ts`)
- Sole lander: **S5** (`DesktopTelemetryReceiver.ts` per `cross-slice-cohesion-index.md`)
- Live file: `apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts`
- Prior G9 note: `docs/scm/g9/wp5/handoffs/B3-B5-DesktopTelemetry-CONTROL.md`
- Machine note: `G10_S3_TEL_DESKTOP_CONTROL_HANDOFF` in `apps/server/src/scm/g10SliceS3.ts`
- Status: **landed** (S5 wires admit/route/replace on DesktopTelemetryReceiver;
  S3 Ordered proof historical stub claims unchanged)

## Why deferred

S3 owns `INV-T2-TEL-DESKTOP-CONTROL` at the `comm_id` layer. Cohesion assigns
**sole file lander** for `DesktopTelemetryReceiver.ts` to **S5**. S3 must not
commit that file. No S3-owned runtime path exists for `sendControlMessage`
outside that file, so S3 records TEL-DESKTOP-CONTROL as **handoff-deferred**
(same honesty pattern S1 used for SETTINGS-EVENTS → S2 and S2 used for
ORCH-LIVE → S6).

## Phase

| Field             | Value                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| `comm_id`         | `INV-T2-TEL-DESKTOP-CONTROL`                                            |
| `phase_id`        | `desktop-control-send-succeeded`                                        |
| Equality A        | `{ operation: "setDiagnosticsDemand" \| "setHostPowerIntervals" }` only |
| Success predicate | `sendControlMessage` completes for those two operations                 |
| False send        | no cutover record / no G9 capture                                       |

## Patch for S5 sole lander

Wire admit/route/replace via `g10SeamBridge` (S5 controller or shared install)
at the `sendControlMessage` success sites. Keep G9
`captureDesktopControlSendSucceeded` as observe-beside — cutover ≠ capture.

### 1. setDiagnosticsDemand

- After successful `sendControlMessage` for diagnostics demand, select live vs
  manifold through the bridge.
- Projection A: `{ operation: "setDiagnosticsDemand" }` only. No `enabled` /
  payload bytes in A.

### 2. setHostPowerIntervals

- Same bridge + projection `{ operation: "setHostPowerIntervals" }` on that
  send path (via `sendHostPowerIntervals`).

Suggested helper shape (S5 implements; names illustrative):

```ts
yield* desktopControlViaG10Bridge(
  sendControlMessage(...),
  operation, // "setDiagnosticsDemand" | "setHostPowerIntervals"
);
```

Absent S5 controller / not replaced ⇒ today’s sendControlMessage only.

## S3 honesty (do not claim)

- S3 dual-run-exit **(a)/(e)** does **not** include TEL-DESKTOP-CONTROL.
- S3 ≡ includes a TEL-DESKTOP-CONTROL **stub pair** for Ordered-proof carrier
  coverage only.
- S3 does **not** edit or commit `DesktopTelemetryReceiver.ts`.

## Non-goals for this handoff

- Do not capture / cut over `INV-T2-TEL-DESKTOP-IN` here (S5 inventory).
- Do not land FILE-CHECKPOINTS or FLAG-CLOUDFLARED under this note (S7 handoffs
  on VcsDriver / relayClient — S3 owns those lander files but not those
  `comm_id`s).
- Do not flip auth flags or resize campaign radius.

## Integrator checklist (S5)

1. Land TEL-DESKTOP-CONTROL bridge on `DesktopTelemetryReceiver.ts` only;
   consume this handoff.
2. Keep G9 live-safe capture beside cutover I/O.
3. Complete S5 Ordered proof for TEL-DESKTOP-CONTROL under S5 exit (a) when wired.
4. Leave S3 evidence TEL-DESKTOP-CONTROL stub claims unchanged (historical honesty).

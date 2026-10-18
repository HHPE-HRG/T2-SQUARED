# B3 → B5 handoff: INV-T2-TEL-DESKTOP-CONTROL

**Planning owner:** WP5-B3 (`g9FamilySubprocessExternalTransport.ts`)
**Sole lander:** WP5-B5-Owner (RFC-014 **A**)
**Live file:** `apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts`
**W5a status:** helpers + notes only. Do **not** edit DesktopTelemetryReceiver.ts in W5a.

## Phase

| `comm_id`                    | `phase`                          | Helper                               | Equality A                                                         |
| ---------------------------- | -------------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `INV-T2-TEL-DESKTOP-CONTROL` | `desktop-control-send-succeeded` | `captureDesktopControlSendSucceeded` | `{ operation: "setDiagnosticsDemand" \| "setHostPowerIntervals" }` |

## Live site (B5)

Call `captureDesktopControlSendSucceeded(capture, operation)` only after `sendControlMessage` completes for:

- `setDiagnosticsDemand`
- `setHostPowerIntervals` (via `sendHostPowerIntervals`)

Do not put `enabled`, interval milliseconds, encoded control bytes, or other payload into A.

B5 is the sole WP5 commit stream for this file; integrate this handoff before B5-owned DESKTOP-IN rows on the same branch if both land together.

## Forbidden in W5a

- Commits to `DesktopTelemetryReceiver.ts` (B3 or otherwise)
- OTLP post-success rows (`INV-T2-TEL-*-OTLP`) — WP6 full-row
- Control payload retention in equality A

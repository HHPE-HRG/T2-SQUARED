# B1 → WP6 handoff: `INV-T2-ORCH-LIVE` on `ws.ts`

<!-- Agent: W5a B1 authoring only. Do not edit apps/server/src/ws.ts in WP5. -->

- Date: 2026-10-18
- Planning owner: **WP5-B1-Owner** (`g9FamilyQueuePubSubCallback.ts`)
- Sole lander: **WP6-Consumer-Owner**
- Live file: `apps/server/src/ws.ts`
- Helper: `captureOrchLiveIfOfferAccepted` from `apps/server/src/scm/g9FamilyQueuePubSubCallback.ts`
- Machine note: `G9_B1_ORCH_LIVE_WS_HANDOFF` in the same module

## Phase

| Field             | Value                                      |
| ----------------- | ------------------------------------------ |
| `comm_id`         | `INV-T2-ORCH-LIVE`                         |
| `phase_id`        | `live-buffer-offered`                      |
| Equality A        | `{ kind: "event" \| "synchronized" }` only |
| Success predicate | `liveBuffer Queue.offer` returns `true`    |
| False offer       | no `captureOccurrence` call                |

## Live sites (WP6 integrates)

1. **subscribeShell** — `liveBuffer` offers of `{ kind: "event", event }` and `{ kind: "synchronized" }`.
2. **subscribeThreadDetail** — same `kind` domain on that stream's `liveBuffer`.

After a successful offer, call:

```ts
yield * captureOrchLiveIfOfferAccepted(capture, accepted, kind);
```

where `capture` is `G9CaptureService.captureOccurrence` (live-safe layer from foundation Task 11). Project `kind` only. Do **not** put event payload, SQL, tokens, or raw JSON into A.

## Non-goals for this handoff

- Do not capture `INV-T2-ORCH-QUEUE` here (Slice-Foundation-Owner / Engine).
- Do not land RpcServer `planned_typed_hooks` under this note (separate WP6 row set).
- Do not edit `OrchestrationEngine.ts` for ORCH-LIVE.

## Forbidden in W5a (already satisfied by B1)

- Direct commits to `ws.ts`, `OrchestrationEngine.ts`, `provider/**`, `Manager.ts`, `T2Observability.ts`, `Observability.ts`, `McpHttpServer.ts`
- Flipping `g9toG10Authorized`
- Re-owning `g9OrchQueueCapture.ts` / `G9LiveSafeCaptureLayer`

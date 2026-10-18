# B1 → Slice handoff: `INV-T2-ORCH-EVENTS` on `OrchestrationEngine.ts`

<!-- Agent: W5c B1 lander. Do not edit OrchestrationEngine.ts in WP5-B1. RFC-023 Slice sole owner. -->

- Date: 2026-10-18
- Planning owner: **WP5-B1-Owner** (`g9FamilyQueuePubSubCallback.ts` + `orchEventsPubSub.ts`)
- Sole lander: **Slice-Foundation-Owner**
- Live file: `apps/server/src/orchestration/Layers/OrchestrationEngine.ts`
- Helper: `publishOrchestrationEventWithCapture` from `apps/server/src/orchestration/orchEventsPubSub.ts`
- Machine note: `G9_B1_ORCH_EVENTS_SLICE_HANDOFF` in that module

## Why Slice must land this

Audit of `apps/server/src/orchestration/**` (production `.ts`, excluding tests):

| Site                                       | Publishes `OrchestrationEvent`?  |
| ------------------------------------------ | -------------------------------- |
| `Layers/OrchestrationEngine.ts` ~129, ~222 | **Yes** — only live publishers   |
| `Layers/RuntimeReceiptBus.ts`              | No — receipts, not domain events |
| All other orchestration modules            | No domain-event `PubSub.publish` |

B1 must not edit Engine (RFC-023). The helper is ready. Live success → one `captureOccurrence` needs this minimal swap.

## Phase

| Field                   | Value                                    |
| ----------------------- | ---------------------------------------- |
| `comm_id`               | `INV-T2-ORCH-EVENTS`                     |
| `phase_id`              | `pubsub-published`                       |
| Equality A              | `{ member_id }` only (`event.type`)      |
| Success predicate       | `PubSub.publish` / helper returns `true` |
| False offer             | no `captureOccurrence` call              |
| Ledger `capture_module` | `apps/server/src/orchestration`          |
| Ledger `capture_symbol` | `eventPubSub.publish`                    |

## Exact call sites (Slice integrates)

Replace raw publish with the helper at both Engine sites. Do not change queue semantics, span attributes, or metric ack timing.

### 1. Reconcile path (~129)

Before:

```ts
yield * PubSub.publish(eventPubSub, persistedEvent);
```

After:

```ts
yield * publishOrchestrationEventWithCapture(eventPubSub, persistedEvent);
```

### 2. Commit path (~222)

Before:

```ts
yield * PubSub.publish(eventPubSub, event);
```

After:

```ts
yield * publishOrchestrationEventWithCapture(eventPubSub, event);
```

Import once at the top of `OrchestrationEngine.ts`:

```ts
import { publishOrchestrationEventWithCapture } from "../orchEventsPubSub.ts";
```

(Path relative to `Layers/`; adjust if the module moves.)

The helper already calls optional `G9CaptureService` via `captureWhenG9Present`. Absent service ⇒ publish unchanged. Project `member_id` from `event.type` only. Do not put event payload, SQL, tokens, or raw JSON into A.

## Non-goals for this handoff

- Do not touch `INV-T2-ORCH-QUEUE` offer capture (already Slice / foundation).
- Do not edit `ws.ts` (ORCH-LIVE is WP6).
- Do not flip `g9toG10Authorized`.
- Do not re-own `g9OrchQueueCapture.ts` / `G9LiveSafeCaptureLayer`.

## Forbidden for WP5-B1 (already satisfied)

- Direct commits to `OrchestrationEngine.ts`
- Direct commits to `ws.ts`
- Inventing a second domain-event publisher outside Engine to "avoid" this handoff

# S2 → S6 handoff: `INV-T2-ORCH-LIVE` on `ws.ts`

<!-- Agent: G10 S2 authoring only. Do not edit apps/server/src/ws.ts in S2. -->

- Date: 2026-10-18
- Planning owner: **G10-S2-WsSettings** (`g10SliceS2.ts`)
- Sole lander: **S6** (`ws.ts` per `cross-slice-cohesion-index.md`)
- Live file: `apps/server/src/ws.ts`
- Prior G9 note: `docs/scm/g9/wp5/handoffs/B1-orch-live-ws.md`
- Machine note: `G10_S2_ORCH_LIVE_HANDOFF` in `apps/server/src/scm/g10SliceS2.ts`
- Status: **handoff-pending** (S2 Ordered proof uses ledger stub only)

## Why deferred

S2 owns `INV-T2-ORCH-LIVE` at the `comm_id` layer. Cohesion assigns **sole file
lander** for `apps/server/src/ws.ts` to **S6**. S2 must not commit `ws.ts`.
No S2-owned runtime path exists for `liveBuffer` Queue.offer outside that
file, so S2 records ORCH-LIVE as **handoff-deferred** (same honesty pattern
S1 used for SETTINGS-EVENTS → S2).

## Phase

| Field             | Value                                      |
| ----------------- | ------------------------------------------ |
| `comm_id`         | `INV-T2-ORCH-LIVE`                         |
| `phase_id`        | `live-buffer-offered`                      |
| Equality A        | `{ kind: "event" \| "synchronized" }` only |
| Success predicate | `liveBuffer Queue.offer` returns `true`    |
| False offer       | no cutover record / no G9 capture          |

## Patch for S6 sole lander

Wire admit/route/replace via `g10SeamBridge` (S6 controller or shared install)
at the two liveBuffer offer sites. Keep G9
`captureOrchLiveIfOfferAccepted` as observe-beside — cutover ≠ capture.

### 1. subscribeShell

- After successful `liveBuffer` offer of `{ kind: "event", event }` or
  `{ kind: "synchronized" }`, select live vs manifold through the bridge.
- Projection A: `{ kind }` only. No event payload / SQL / tokens in A.

### 2. subscribeThreadDetail

- Same `kind` domain on that stream’s `liveBuffer`.
- Same bridge + projection rules.

Suggested helper shape (S6 implements; names illustrative):

```ts
yield *
  offerOrchLiveViaG10Bridge(
    Queue.offer(liveBuffer, item).pipe(Effect.map((accepted) => accepted)),
    kind, // "event" | "synchronized"
  );
```

Absent S6 controller / not replaced ⇒ today’s Queue.offer only.

## S2 honesty (do not claim)

- S2 dual-run-exit **(a)/(e)** does **not** include ORCH-LIVE.
- S2 ≡ includes an ORCH-LIVE **stub pair** for Ordered-proof carrier coverage only.
- S2 does **not** edit or commit `ws.ts`.

## Non-goals for this handoff

- Do not capture / cut over `INV-T2-ORCH-QUEUE` or `INV-T2-ORCH-EVENTS` here (S1).
- Do not land FLAG-T3-OTEL under this note (separate S6 row on `cli/config.ts`
  handoff — S2 owns FLAG-SERVER-CONFIG land only).
- Do not flip auth flags or resize campaign radius.

## Integrator checklist (S6)

1. Land ORCH-LIVE bridge on `ws.ts` only; consume this handoff.
2. Keep G9 live-safe capture beside cutover I/O.
3. Complete S6 Ordered proof for ORCH-LIVE under S6 exit (a) when wired.
4. Leave S2 evidence ORCH-LIVE stub claims unchanged (historical honesty).

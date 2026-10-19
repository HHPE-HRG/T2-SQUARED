# S5 → S6 handoff: `INV-T2-TEL-T3-TRACE` on `Observability.ts`

<!-- Agent: G10 S5 authoring only. Do not edit Observability.ts in S5. -->

- Date: 2026-10-18
- Planning owner: **G10-S5-Terminal** (`g10SliceS5.ts`)
- Sole lander: **S6** (`Observability.ts` per `cross-slice-cohesion-index.md`)
- Live file: `apps/server/src/observability/Layers/Observability.ts`
- Prior G9 note: `docs/scm/g9/wp5/handoffs/B5-Observability-T3-TRACE.md`
- Machine note: `G10_S5_TEL_T3_TRACE_HANDOFF` in `apps/server/src/scm/g10SliceS5.ts`
- Status: **handoff-pending** (S5 Ordered proof uses ledger stub only)

## Why deferred

S5 owns `INV-T2-TEL-T3-TRACE` at the `comm_id` layer. Cohesion assigns **sole
file lander** for `Observability.ts` to **S6**. S5 must not commit that file.
No S5-owned runtime path exists for T3-TRACE batch persist outside that file,
so S5 records TEL-T3-TRACE as **handoff-deferred** (same honesty pattern S2
used for ORCH-LIVE → S6).

## Phase

| Field             | Value                                    |
| ----------------- | ---------------------------------------- |
| `comm_id`         | `INV-T2-TEL-T3-TRACE`                    |
| `phase_id`        | `t3-trace-persisted-batch-succeeded`     |
| Equality A        | `{ comm_id: "present" }` only            |
| Success predicate | local-file tracer batch persist succeeds |
| False persist     | no cutover record / no G9 capture        |

## Patch for S6 sole lander

Wire admit/route/replace via `g10SeamBridge` (S6 controller or shared install)
at the batch-persist success site. Keep G9
`captureT3TracePersistedBatchSucceeded` as observe-beside — cutover ≠ capture.

Suggested helper shape (S6 implements; names illustrative):

```ts
yield* t3TraceBatchViaG10Bridge(
  persistBatch(...),
);
```

Absent S6 controller / not replaced ⇒ today’s persist only.

## S5 honesty (do not claim)

- S5 dual-run-exit **(a)/(e)** does **not** include TEL-T3-TRACE.
- S5 ≡ includes a TEL-T3-TRACE **stub pair** for Ordered-proof carrier coverage only.
- S5 does **not** edit or commit `Observability.ts`.

## Non-goals for this handoff

- Do not capture / cut over OTLP rows here (S6 inventory).
- Do not land TEL-NDJSON under this note (separate S5→S6 handoff on T2Observability).
- Do not flip auth flags or resize campaign radius.

## Integrator checklist (S6)

1. Land TEL-T3-TRACE bridge on `Observability.ts` only; consume this handoff.
2. Keep G9 live-safe capture beside cutover I/O.
3. Complete S6 Ordered proof for TEL-T3-TRACE under S6 exit (a) when wired.
4. Leave S5 evidence TEL-T3-TRACE stub claims unchanged (historical honesty).

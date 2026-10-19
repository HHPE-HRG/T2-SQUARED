# S5 → S6 handoff: `INV-T2-TEL-NDJSON` on `T2Observability.ts`

<!-- Agent: G10 S5 authoring only. Do not edit T2Observability.ts in S5. -->

- Date: 2026-10-18
- Planning owner: **G10-S5-Terminal** (`g10SliceS5.ts`)
- Sole lander: **S6** (`T2Observability.ts` per `cross-slice-cohesion-index.md`)
- Live file: `apps/server/src/t2Observability/T2Observability.ts`
- Prior G9 note: `G9_B5_NDJSON_HANDOFF` in `g9FamilyTerminalLocalStreams.ts`
- Machine note: `G10_S5_TEL_NDJSON_HANDOFF` in `apps/server/src/scm/g10SliceS5.ts`
- Status: **handoff-pending** (S5 Ordered proof uses ledger stub only)

## Why deferred

S5 owns `INV-T2-TEL-NDJSON` at the `comm_id` layer. Cohesion assigns **sole file
lander** for `T2Observability.ts` to **S6**. S5 must not commit that file.
No S5-owned runtime path exists for NDJSON export success outside that file,
so S5 records TEL-NDJSON as **handoff-deferred** (same honesty pattern S2 used
for ORCH-LIVE → S6 and S3 used for TEL-DESKTOP-CONTROL → S5).

## Phase

| Field             | Value                                |
| ----------------- | ------------------------------------ |
| `comm_id`         | `INV-T2-TEL-NDJSON`                  |
| `phase_id`        | `ndjson-export-succeeded`            |
| Equality A        | `{ comm_id: "present" }` only        |
| Success predicate | NDJSON export completes successfully |
| False export      | no cutover record / no G9 capture    |

## Patch for S6 sole lander

Wire admit/route/replace via `g10SeamBridge` (S6 controller or shared install)
at the NDJSON export success site. Keep G9
`captureNdjsonExportSucceeded` as observe-beside — cutover ≠ capture.

Suggested helper shape (S6 implements; names illustrative):

```ts
yield* ndjsonExportViaG10Bridge(
  exportNdjson(...),
);
```

Absent S6 controller / not replaced ⇒ today’s export only.

## S5 honesty (do not claim)

- S5 dual-run-exit **(a)/(e)** does **not** include TEL-NDJSON.
- S5 ≡ includes a TEL-NDJSON **stub pair** for Ordered-proof carrier coverage only.
- S5 does **not** edit or commit `T2Observability.ts`.

## Non-goals for this handoff

- Do not capture / cut over `INV-T2-TEL-T2-OTLP` / `INV-T2-TEL-T3-OTLP` here (S6).
- Do not land TEL-T3-TRACE under this note (separate S5→S6 handoff on Observability).
- Do not flip auth flags or resize campaign radius.

## Integrator checklist (S6)

1. Land TEL-NDJSON bridge on `T2Observability.ts` only; consume this handoff.
2. Keep G9 live-safe capture beside cutover I/O.
3. Complete S6 Ordered proof for TEL-NDJSON under S6 exit (a) when wired.
4. Leave S5 evidence TEL-NDJSON stub claims unchanged (historical honesty).

# B5 → WP6 handoff: INV-T2-TEL-T3-TRACE

**Planning owner:** WP5-B5 (`g9FamilyTerminalLocalStreams.ts`)
**Sole lander:** WP6-Consumer-Owner (RFC-014 **A**)
**Live file:** `apps/server/src/observability/Layers/Observability.ts`
**W5a status:** helpers + notes only. Do **not** edit Observability.ts in W5a.

## Phase

| `comm_id`             | `phase`                              | Helper                                  | Equality A               |
| --------------------- | ------------------------------------ | --------------------------------------- | ------------------------ |
| `INV-T2-TEL-T3-TRACE` | `t3-trace-persisted-batch-succeeded` | `captureT3TracePersistedBatchSucceeded` | `{ comm_id: "present" }` |

## Live site (WP6)

Call `captureT3TracePersistedBatchSucceeded(capture)` only after local-file tracer batch persist succeeds (`makeLocalFileTracer` / batch window flush). Do not put span bodies, file paths, or batch contents into A.

## Related B5 → WP6 handoff (same wave)

`INV-T2-TEL-NDJSON` / `ndjson-export-succeeded` → `apps/server/src/t2Observability/T2Observability.ts` via `captureNdjsonExportSucceeded` (RFC-005 **A**). See `G9_B5_NDJSON_HANDOFF` in the family module.

## Forbidden in W5a

- Commits to `Observability.ts`, `T2Observability.ts`, or `terminal/Manager.ts`
- OTLP post-success rows (`INV-T2-TEL-T3-OTLP`, `INV-T2-TEL-T2-OTLP`) — WP6 full-row
- Payload / terminal / NDJSON body retention in equality A

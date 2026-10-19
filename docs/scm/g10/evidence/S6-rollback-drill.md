# S6 rollback-drill evidence

<!-- Agent: G10 S6 Ordered proof step 4. Restore live authority before dual-run exit. -->

- Date: 2026-10-18
- Slice: **S6**
- Step: **rollback-drill**
- Phase: `rolled-back`
- Authority: **live** (after restore)
- inversionArmed: `false`
- S6 activatable comm_ids (12): INV-T2-FLAG-T2-OTEL, INV-T2-FLAG-T3-OTEL, INV-T2-ORCH-RPC, INV-T2-RPC-STREAM-AUTH, INV-T2-RPC-STREAM-CONFIG, INV-T2-RPC-STREAM-DISCOVERY, INV-T2-RPC-STREAM-ORCH, INV-T2-RPC-STREAM-TEL, INV-T2-RPC-STREAM-TERM, INV-T2-RPC-WS, INV-T2-TEL-T2-OTLP, INV-T2-TEL-T3-OTLP

## Procedure

1. `restorePreCutoverLive(model, "S6")` — restores live authority for S6 install.
2. Assert rollback ≠ unset `T2CODE_SCM_G9_SHADOW`; no halt controller.
3. Re-prove live-authoritative `g10SeamBridge` selection for `INV-T2-RPC-WS`.

## Restore scope

- `apps/server/src/ws.ts`
- `apps/server/src/t2Observability/T2Observability.ts`
- `apps/server/src/observability/Layers/Observability.ts`

FLAG-T3-OTEL restore stays with S2 lander on `cli/config.ts` (not S6).
Home-bus dormant — no restore claim.

## Verdict

**GREEN**

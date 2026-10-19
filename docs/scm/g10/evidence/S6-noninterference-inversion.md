# S6 noninterference-inversion evidence

<!-- Agent: G10 S6 Ordered proof step 6. Inversion armed only after dual-run exit. -->

- Date: 2026-10-18
- Slice: **S6**
- Step: **arm-inversion**
- Phase: `inverted`
- Authority: **manifold**
- inversionArmed: `true`
- S6 activatable comm_ids (12): INV-T2-FLAG-T2-OTEL, INV-T2-FLAG-T3-OTEL, INV-T2-ORCH-RPC, INV-T2-RPC-STREAM-AUTH, INV-T2-RPC-STREAM-CONFIG, INV-T2-RPC-STREAM-DISCOVERY, INV-T2-RPC-STREAM-ORCH, INV-T2-RPC-STREAM-TEL, INV-T2-RPC-STREAM-TERM, INV-T2-RPC-WS, INV-T2-TEL-T2-OTLP, INV-T2-TEL-T3-OTLP

## Policy applied

After dual-run exit, manifold failure may fail user-visible RPC / OTLP / obs
ops for the **fourteen wired** S6 seams. Armed solely via
`armInversion(model, "S6", registry)` → `recordOrderedProofStep(..., "arm-inversion")`.

## Honesty partition

- FLAG-T3-OTEL remains handoff-deferred to S2 — not inverted from S6 wiring.
- TEL-NDJSON / TEL-T3-TRACE / ORCH-LIVE are inverted under S6 lander exit (a)
  (handoff lands completed).
- HOME-BUS dormant-exempt — not inverted.
- Export failure still must not mutate non-obs live state (G9 law retained for
  pure observation paths; cut-over RPC/OTLP/flag rows follow inversion policy).

## Verdict

**GREEN**

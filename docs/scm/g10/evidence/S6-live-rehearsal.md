# S6 live-rehearsal evidence

<!-- Agent: G10 S6 Ordered proof step 2. Live remains authoritative; inversion not armed. -->

- Date: 2026-10-18
- Slice: **S6**
- Step: **live-rehearsal**
- Phase: `rehearsed`
- Authority: **live**
- inversionArmed: `false`
- S6 activatable comm_ids (12): INV-T2-FLAG-T2-OTEL, INV-T2-FLAG-T3-OTEL, INV-T2-ORCH-RPC, INV-T2-RPC-STREAM-AUTH, INV-T2-RPC-STREAM-CONFIG, INV-T2-RPC-STREAM-DISCOVERY, INV-T2-RPC-STREAM-ORCH, INV-T2-RPC-STREAM-TEL, INV-T2-RPC-STREAM-TERM, INV-T2-RPC-WS, INV-T2-TEL-T2-OTLP, INV-T2-TEL-T3-OTLP
- Dormant-exempt: INV-T2-SCM-HOME-BUS-LINK
- Runtime: `apps/server/src/scm/g10SliceS6.ts` + `g10SeamBridge.ts`
- Sole landers: `ws.ts`, `T2Observability.ts`, `Observability.ts`
- Handoff-deferred: `cli/config.ts` FLAG-T3-OTEL → S2
- Handoff-landed: ORCH-LIVE (S2→S6), TEL-NDJSON / TEL-T3-TRACE (S5→S6)

## Notes

- admit/route/replace already landed; dual-run observe exercised on **fourteen
  wired** S6 seams via `runG10SeamBridge` (live authoritative; manifold
  observe-beside isolated).
- FLAG-T3-OTEL handoff stub only (deferred to S2; S6 does not commit
  `cli/config.ts`).
- ORCH-LIVE / TEL-NDJSON / TEL-T3-TRACE handoff lands exercised on sole landers.
- Home-bus dormant-preserved — not rehearsed as cutover.
- One rollback restore (`restorePreCutoverLive`) + re-land under live authority;
  live re-proven.
- Inversion not armed; treating rehearsal as exit/inversion is forbidden.

## Verdict

**GREEN**

# S5 live-rehearsal evidence

<!-- Agent: G10 S5 Ordered proof step 2. Live remains authoritative; inversion not armed. -->

- Date: 2026-10-18
- Slice: **S5**
- Step: **live-rehearsal**
- Phase: `rehearsed`
- Authority: **live**
- inversionArmed: `false`
- S5 inventory comm_ids (5): INV-T2-RES-MONITOR, INV-T2-TEL-DESKTOP-IN, INV-T2-TEL-NDJSON, INV-T2-TEL-T3-TRACE, INV-T2-TERM
- Runtime: `apps/server/src/scm/g10SliceS5.ts` + `g10SeamBridge.ts`
- Sole landers: `terminal/Manager.ts`, `NativeTelemetryClient.ts`, `DesktopTelemetryReceiver.ts`
- Handoff-deferred: `T2Observability.ts` TEL-NDJSON → S6; `Observability.ts` TEL-T3-TRACE → S6
- S7 handoffs reserved (not stolen): FILE-LOGS terminalLogs, FLAG-TERM-ENV on Manager

## Notes

- admit/route/replace already landed; dual-run observe exercised on **four wired**
  S5 seams via `runG10SeamBridge` (live authoritative; manifold observe-beside isolated).
- TEL-NDJSON / TEL-T3-TRACE handoff stubs only (deferred to S6; S5 does not commit
  `T2Observability.ts` / `Observability.ts`).
- TEL-DESKTOP-CONTROL S3→S5 handoff land exercised on `DesktopTelemetryReceiver.ts`.
- One rollback restore (`restorePreCutoverLive`) + re-land under live authority; live re-proven.
- Inversion not armed; treating rehearsal as exit/inversion is forbidden.

## Verdict

**GREEN**

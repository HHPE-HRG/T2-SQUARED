# S5 rollback-drill evidence

<!-- Agent: G10 S5 Ordered proof step 4. Restore pre-cutover live before dual-run exit. -->

- Date: 2026-10-18
- Slice: **S5**
- Step: **rollback-drill**
- Phase: `restored`
- Authority: **live**
- inversionArmed: `false`
- S5 inventory comm_ids (5): INV-T2-RES-MONITOR, INV-T2-TEL-DESKTOP-IN, INV-T2-TEL-NDJSON, INV-T2-TEL-T3-TRACE, INV-T2-TERM

## Notes

- `restorePreCutoverLive` restored live authority for S5.
- Rollback ≠ unset `T2CODE_SCM_G9_SHADOW`; no halt controller.
- Re-proved live-authoritative bridge selection for `INV-T2-TERM`.
- Restore scope: `terminal/Manager.ts`, `NativeTelemetryClient.ts`,
  `DesktopTelemetryReceiver.ts`.
- TEL-NDJSON / TEL-T3-TRACE restore stays with S6 landers on
  `T2Observability.ts` / `Observability.ts` (S5 does not commit those files).

## Verdict

**GREEN**

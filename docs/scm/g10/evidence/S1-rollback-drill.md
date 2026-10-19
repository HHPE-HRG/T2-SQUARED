# S1 rollback-drill evidence

<!-- Agent: G10 S1 Ordered proof step 4. Restore pre-cutover live; re-prove live authority. -->

- Date: 2026-10-18
- Slice: **S1**
- Step: **rollback-drill**
- Phase: `restored`
- Authority: **live**
- inversionArmed: `false`
- S1 comm_ids (7): INV-T2-LIFECYCLE-EVENTS, INV-T2-ORCH-EVENTS, INV-T2-ORCH-QUEUE, INV-T2-PREVIEW-AUTO, INV-T2-PROJECT-QUEUE, INV-T2-SETTINGS-EVENTS, INV-T2-VCS-EVENTS
- API: `restorePreCutoverLive` (`g10Rollback.ts`)

## Notes

- Restored pre-cutover **live** authority for S1; `replaceInstalled` retained for dual-run re-entry.
- Rollback **≠** unset `T2CODE_SCM_G9_SHADOW` (`ROLLBACK_IS_NOT_SHADOW_ENV_OFF`).
- Rollback **adds no** halt controller (`ROLLBACK_ADDS_NO_HALT_CONTROLLER`; G7 DIP unchanged).
- Re-proved live-authoritative `runG10SeamBridge` selection for ORCH-QUEUE after restore.

## Verdict

**GREEN**

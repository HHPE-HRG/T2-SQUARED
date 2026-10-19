# S2 rollback-drill evidence

<!-- Agent: G10 S2 Ordered proof step 4. Restore pre-cutover live; re-prove live authority. -->

- Date: 2026-10-18
- Slice: **S2**
- Step: **rollback-drill**
- Phase: `restored`
- Authority: **live**
- inversionArmed: `false`
- S2 comm_ids (3): INV-T2-FILE-SETTINGS, INV-T2-FLAG-SERVER-CONFIG, INV-T2-ORCH-LIVE
- API: `restorePreCutoverLive` (`g10Rollback.ts`)

## Notes

- Restored pre-cutover **live** authority for S2; `replaceInstalled` retained for dual-run re-entry.
- Rollback **≠** unset `T2CODE_SCM_G9_SHADOW` (`ROLLBACK_IS_NOT_SHADOW_ENV_OFF`).
- Rollback **adds no** halt controller (`ROLLBACK_ADDS_NO_HALT_CONTROLLER`; G7 DIP unchanged).
- Re-proved live-authoritative `runG10SeamBridge` selection for FILE-SETTINGS after restore.

## Verdict

**GREEN**

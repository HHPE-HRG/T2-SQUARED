# S3 rollback-drill evidence

<!-- Agent: G10 S3 Ordered proof step 4. Restore pre-cutover live; re-prove live authority. -->

- Date: 2026-10-18
- Slice: **S3**
- Step: **rollback-drill**
- Phase: `restored`
- Authority: **live**
- inversionArmed: `false`
- S3 inventory comm_ids (16): INV-T2-EDITOR-LAUNCH, INV-T2-GIT, INV-T2-HTTP-SERVE, INV-T2-NET-TCP, INV-T2-PREVIEW-SCAN, INV-T2-PROJECT-SETUP, INV-T2-RELAY-AWARENESS, INV-T2-RELAY-CLIENT, INV-T2-RELAY-HTTP, INV-T2-SC-ADO, INV-T2-SC-BITBUCKET, INV-T2-SC-GITHUB, INV-T2-SC-GITLAB, INV-T2-TAILSCALE, INV-T2-TEL-ANALYTICS, INV-T2-TEL-DESKTOP-CONTROL
- API: `restorePreCutoverLive` (`g10Rollback.ts`)

## Notes

- Restored pre-cutover **live** authority for S3; `replaceInstalled` retained for dual-run re-entry.
- Rollback **≠** unset `T2CODE_SCM_G9_SHADOW` (`ROLLBACK_IS_NOT_SHADOW_ENV_OFF`).
- Rollback **adds no** halt controller (`ROLLBACK_ADDS_NO_HALT_CONTROLLER`; G7 DIP unchanged).
- Re-proved live-authoritative `runG10SeamBridge` selection for GIT after restore.
- DesktopTelemetryReceiver restore owned by S5 lander (not S3).

## Verdict

**GREEN**

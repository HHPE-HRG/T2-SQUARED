# S3 live-rehearsal evidence

<!-- Agent: G10 S3 Ordered proof step 2. Live remains authoritative; inversion not armed. -->

- Date: 2026-10-18
- Slice: **S3**
- Step: **live-rehearsal**
- Phase: `rehearsed`
- Authority: **live**
- inversionArmed: `false`
- S3 inventory comm_ids (16): INV-T2-EDITOR-LAUNCH, INV-T2-GIT, INV-T2-HTTP-SERVE, INV-T2-NET-TCP, INV-T2-PREVIEW-SCAN, INV-T2-PROJECT-SETUP, INV-T2-RELAY-AWARENESS, INV-T2-RELAY-CLIENT, INV-T2-RELAY-HTTP, INV-T2-SC-ADO, INV-T2-SC-BITBUCKET, INV-T2-SC-GITHUB, INV-T2-SC-GITLAB, INV-T2-TAILSCALE, INV-T2-TEL-ANALYTICS, INV-T2-TEL-DESKTOP-CONTROL
- Runtime: `apps/server/src/scm/g10SliceS3.ts` + `g10SeamBridge.ts`
- Sole landers: `VcsDriver.ts` (GIT), `relayClient.ts` (RELAY-CLIENT)
- Handoff-deferred: `DesktopTelemetryReceiver.ts` TEL-DESKTOP-CONTROL → S5 (`docs/scm/g10/handoffs/S3-TEL-DESKTOP-CONTROL-to-S5.md`)

## Notes

- admit/route/replace already landed; dual-run observe exercised on **fifteen wired**
  S3 seams via `runG10SeamBridge` (live authoritative; manifold observe-beside isolated).
- TEL-DESKTOP-CONTROL handoff stub only (deferred to S5; S3 does not commit
  `DesktopTelemetryReceiver.ts`).
- FILE-CHECKPOINTS / FLAG-CLOUDFLARED left for S7 handoffs on S3 lander files —
  not stolen under S3 rehearsal.
- One rollback restore (`restorePreCutoverLive`) + re-land under live authority; live re-proven.
- Inversion not armed; treating rehearsal as exit/inversion is forbidden.

## Verdict

**GREEN**

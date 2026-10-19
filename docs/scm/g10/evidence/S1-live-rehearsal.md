# S1 live-rehearsal evidence

<!-- Agent: G10 S1 Ordered proof step 2. Live remains authoritative; inversion not armed. -->

- Date: 2026-10-18
- Slice: **S1**
- Step: **live-rehearsal**
- Phase: `rehearsed`
- Authority: **live**
- inversionArmed: `false`
- S1 inventory comm_ids (7): INV-T2-LIFECYCLE-EVENTS, INV-T2-ORCH-EVENTS, INV-T2-ORCH-QUEUE, INV-T2-PREVIEW-AUTO, INV-T2-PROJECT-QUEUE, INV-T2-SETTINGS-EVENTS, INV-T2-VCS-EVENTS
- Runtime: `apps/server/src/scm/g10SliceS1.ts` + `g10SeamBridge.ts`
- Engine sole lander: `OrchestrationEngine.ts` (ORCH-EVENTS + ORCH-QUEUE)
- Capture-module bridges: `serverLifecycleEvents.ts`, `PreviewAutomationBroker.ts`, `ProjectionPipeline.ts`, `VcsStatusBroadcaster.ts`

## Notes

- admit/route/replace already landed; dual-run observe exercised on **six wired**
  S1 seams via `runG10SeamBridge` (live authoritative; manifold observe-beside isolated).
- SETTINGS-EVENTS handoff stub only (deferred to S2 `serverSettings.ts`).
- One rollback restore (`restorePreCutoverLive`) + re-land under live authority; live re-proven.
- Inversion not armed; treating rehearsal as exit/inversion is forbidden.

## Live-run pointer

Campaign live Ordered drive (S1–S8) 2026-10-18:
`docs/scm/g10/evidence/live-cutover-2026-10-18.md` — S1 steps 6, authority
manifold, inversionArmed true after full Ordered.

## Verdict

**GREEN**

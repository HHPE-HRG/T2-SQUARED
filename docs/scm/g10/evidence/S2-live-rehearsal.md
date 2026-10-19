# S2 live-rehearsal evidence

<!-- Agent: G10 S2 Ordered proof step 2. Live remains authoritative; inversion not armed. -->

- Date: 2026-10-18
- Slice: **S2**
- Step: **live-rehearsal**
- Phase: `rehearsed`
- Authority: **live**
- inversionArmed: `false`
- S2 inventory comm_ids (3): INV-T2-FILE-SETTINGS, INV-T2-FLAG-SERVER-CONFIG, INV-T2-ORCH-LIVE
- Runtime: `apps/server/src/scm/g10SliceS2.ts` + `g10SeamBridge.ts`
- Sole landers: `serverSettings.ts` (FILE-SETTINGS + SETTINGS-EVENTS S1 handoff), `cli/config.ts` (FLAG-SERVER-CONFIG)
- Handoff-deferred: `ws.ts` ORCH-LIVE → S6 (`docs/scm/g10/handoffs/S2-ORCH-LIVE-to-S6.md`)

## Notes

- admit/route/replace already landed; dual-run observe exercised on **three wired**
  S2 lander seams via `runG10SeamBridge` (live authoritative; manifold observe-beside isolated).
- ORCH-LIVE handoff stub only (deferred to S6 `ws.ts`; S2 does not commit `ws.ts`).
- SETTINGS-EVENTS S1→S2 handoff land exercised on `serverSettings.ts`.
- One rollback restore (`restorePreCutoverLive`) + re-land under live authority; live re-proven.
- Inversion not armed; treating rehearsal as exit/inversion is forbidden.

## Verdict

**GREEN**

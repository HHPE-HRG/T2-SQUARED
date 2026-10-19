# S1 noninterference-inversion evidence

<!-- Agent: G10 S1 Ordered proof step 6. Inversion armed only after dual-run-exit. -->

- Date: 2026-10-18
- Slice: **S1**
- Step: **arm-inversion**
- Phase: `inverted`
- Authority: **manifold**
- inversionArmed: `true`
- S1 comm_ids (7): INV-T2-LIFECYCLE-EVENTS, INV-T2-ORCH-EVENTS, INV-T2-ORCH-QUEUE, INV-T2-PREVIEW-AUTO, INV-T2-PROJECT-QUEUE, INV-T2-SETTINGS-EVENTS, INV-T2-VCS-EVENTS
- API: `armInversion` → `recordOrderedProofStep(..., "arm-inversion")` (`g10Inversion.ts`)

## Notes

- Armed **only after** dual-run-exit (Ordered proof gate).
- On cut-over S1 rows, manifold failure **may fail** user-visible orch ops
  (`runG10SeamBridge` post-exit + inverted path propagates manifold fail).
- Pre-exit / non-cut-over surfaces keep G9 observe-beside noninterference.
- Dormant `INV-T2-SCM-HOME-BUS-LINK` remains exempt (not in S1 set).
- G9 `captureOccurrence` is not replaced by cutover; Engine keeps G9 capture
  as observe-beside beside the bridge.

## Verdict

**GREEN**

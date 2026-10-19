# S2 noninterference-inversion evidence

<!-- Agent: G10 S2 Ordered proof step 6. Inversion armed only after dual-run-exit. -->

- Date: 2026-10-18
- Slice: **S2**
- Step: **arm-inversion**
- Phase: `inverted`
- Authority: **manifold**
- inversionArmed: `true`
- S2 comm_ids (3): INV-T2-FILE-SETTINGS, INV-T2-FLAG-SERVER-CONFIG, INV-T2-ORCH-LIVE
- API: `armInversion` → `recordOrderedProofStep(..., "arm-inversion")` (`g10Inversion.ts`)

## Notes

- Armed **only after** dual-run-exit (Ordered proof gate).
- On cut-over S2 lander rows (FILE-SETTINGS / FLAG-SERVER-CONFIG / SETTINGS-EVENTS),
  manifold failure **may fail** user-visible settings/config ops
  (`runG10SeamBridge` post-exit + inverted path propagates manifold fail).
- ORCH-LIVE remains handoff-deferred to S6 — not inverted from S2 wiring.
- Pre-exit / non-cut-over surfaces keep G9 observe-beside noninterference.
- G9 `captureOccurrence` is not replaced by cutover; settings/config keep G9
  capture as observe-beside beside the bridge.

## Verdict

**GREEN**

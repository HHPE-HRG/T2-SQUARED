# S7 rollback-drill evidence

<!-- Agent: G10 S7 Ordered proof step 4. Restore pre-cutover live; re-prove live authority. -->

- Date: 2026-10-18
- Slice: **S7**
- Step: **rollback-drill**
- Phase: `rolled-back`
- Authority: **live** (after restore)
- inversionArmed: `false`
- S7 activatable comm_ids (14)
- Inventory phase count: **72**

## Notes

- `restorePreCutoverLive(model, "S7")` restored live authority.
- Rollback ≠ unset `T2CODE_SCM_G9_SHADOW`; no halt controller.
- Re-proved live-authoritative bridge selection for `INV-T2-SQLITE`.
- Restore scope: S7 sole landers (Projection Layers\*, NodeSqliteClient,
  ProjectionSnapshotQuery, Normalizer, ServerEnvironment/serverRuntimeState/
  Identify/keybindings, config.ts, UsageService, GitVcsDriverCore,
  ProviderSessionRuntime).
- Foreign hotspots restore via S3/S4/S5 landers (not claimed under S7).

## Verdict

**GREEN**

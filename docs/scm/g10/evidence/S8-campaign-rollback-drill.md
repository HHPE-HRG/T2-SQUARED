# S8 campaign-rollback-drill evidence

<!-- Agent: G10 S8 full-campaign restore via runCampaignRollback. -->

- Date: 2026-10-18
- Slice: **S8**
- Procedure: `runCampaignRollback` / `runCampaignRollbackDrill` (`g10Rollback.ts` / `g10SliceS8.ts`)
- slicesRestored: S1, S2, S3, S4, S5, S6, S7
- valid: `true`
- allLive: `true`
- clearedShadowEnv: `false`
- usedHaltController: `false`

## Procedure

1. Install admit/route/replace on S1–S7 (campaign prep via `installAllFabricSlices`).
2. Optionally set manifold authority (post-exit shape) on selected slices.
3. Call `runCampaignRollback(model)` once.
4. Assert every restored install has `authority: "live"`.
5. Assert `T2CODE_SCM_G9_SHADOW` unchanged; no halt controller.

## Notes

- campaign-rollback restored 7 fabric slices
- clearedShadowEnv=false; usedHaltController=false
- rollback ≠ unset `T2CODE_SCM_G9_SHADOW`
- G7 DIP halt/freeze unchanged
- all restored installs report live authority
- Targeted proof: `apps/server/src/scm/g10SliceS8.test.ts` + `g10Rollback.test.ts`

## Explicitly not

- Unset of `T2CODE_SCM_G9_SHADOW` as Increment 6 rollback
- New campaign halt controller (G7 DIP unchanged)
- Per-slice Ordered proof re-run (S8 is campaign restore)

## Verdict

**GREEN** — campaign rollback restored live across fabric installs.

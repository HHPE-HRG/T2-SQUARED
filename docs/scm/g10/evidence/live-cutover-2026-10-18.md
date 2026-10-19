# G10 live-cutover evidence (process-live)

<!-- Agent: steward live Ordered proof under existing G10 auth. Not harness-only.
Not WP8 763. Not G9 shadow env-off. Bridge cutover model — not second physical fabric. -->

- Date: 2026-10-18 (local) / 2026-10-19T06:52Z
- Baseline SHA: `d6ca1aaa9` (+ live-ops docs / ndjsonExporter strip-types fix / live driver)
- Auth: `docs/scm/g10/authorization.md` (unchanged)
- Env: `T2CODE_SCM_G10_CUTOVER=1`
- Home: worktree `/Users/maxholden/T2-SQUARED/.t3` via `--home-dir` (never `~/.t3` RW)
- Ops: `docs/scm/g10/ops/live-cutover-runbook.md`
- Driver: `scripts/g10-live-ordered-drive.ts` (same campaign stack as server present-mode)

## Smoke checklist

- [x] Pairing URL opened; web paired (`http://localhost:5733/pair#token=…` → draft thread UI)
- [x] Web HTTP 200; server HTTP 302 (auth redirect expected)
- [x] Server listening `http://127.0.0.1:13773` with cutover env
- [x] Untouched UI loads (threads list / new thread composer visible)
- [x] Ordered drive S1–S7 + S8 campaign close GREEN (below)
- [x] Home-bus remains dormant; radius 73+1 unchanged in S8 audit

## Ordered proof (live drive)

Process-live drive of `buildG10CampaignCutoverStack` controllers (identical
install path to `g10CutoverStackLayerFromEnv` present mode). Per-slice
`runFullOrderedProof`: land → live-rehearsal → ≡ → rollback-drill →
dual-run-exit → arm-inversion. Then `runS8CampaignCloseProof`.

| Slice | ok   | steps | authority after  | inversionArmed |
| ----- | ---- | ----- | ---------------- | -------------- |
| S1    | true | 6     | manifold         | true           |
| S2    | true | 6     | manifold         | true           |
| S3    | true | 6     | manifold         | true           |
| S4    | true | 6     | manifold         | true           |
| S5    | true | 6     | manifold         | true           |
| S6    | true | 6     | manifold         | true           |
| S7    | true | 6     | manifold         | true           |
| S8    | true | 3     | audit+rollback+≡ | n/a            |

S8 audit: activatable **73**, dormant **1**, `radiusUnchanged: true`,
`homeBusDormant: true`, rollback `valid` + `allLive`, ≡ samples **12** under
`G9DeferredEquality` (not 763).

Driver timestamps: start `2026-10-19T06:52:23.689Z` → done
`2026-10-19T06:52:23.726Z`, exitCode **0**.

## Explicit non-claims

- Not WP8 763-fixture marathon
- Not G9 shadow env-off as rollback
- Not second physical manifold I/O fabric (bridge authority selection only)
- Not fabric-depth implement (separate charter / ceremony)

## Env-off restore smoke

Cleared `T2CODE_SCM_G10_CUTOVER`, restarted with same `--home-dir` worktree
`.t3`. Server listened again on `http://127.0.0.1:13773` and printed a fresh
pairing URL (`token=72MN7AMKGJQU`). Default live path restored (G10 stack
Layer.empty). G9 shadow env untouched.

## Verdict

**GREEN** — steward-accepted live Ordered proof + process smoke + env-off
restore for package close under Increment 6 auth.

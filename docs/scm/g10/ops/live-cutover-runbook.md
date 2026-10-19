# G10 live-cutover ops runbook

<!-- Agent: human ops for process-live opt-in. Not definition. Not new auth.
Does not flip completed. Worktree .t3 only — never ~/.t3. -->

- Date: 2026-10-18
- Auth: `docs/scm/g10/authorization.md` (Increment 6 already authorized)
- Freeze: `docs/scm/g10/governance/auth-freeze.md`
- Barriers: `docs/scm/g10/session-runbook.md` §1–§2
- Proof: `docs/scm/g10/proof-bar.md` Ordered proof
- Env: `T2CODE_SCM_G10_CUTOVER` (not `T2CODE_SCM_G9_SHADOW`)

## Purpose

Run a **process-live** G10 cutover exercise under existing auth. This is the
ops SOP after authorized implement is frozen. It does **not** invent G11,
resize radius, activate home-bus, or claim package `completed: true`.

## Preconditions

1. Baselined SHA with auth-freeze landed (not a floating dirty tree).
2. Worktree state under `<worktree>/.t3` only — **never** open `~/.t3` read-write.
3. `g9toG10Authorized: true` and `authorization.md` present.
4. Default process (env unset) still today’s live.

## Enable cutover

```bash
# From repo root / worktree — use worktree home, not ~/.t3
export T2CODE_SCM_G10_CUTOVER=1
# Start server+web via the usual worktree runner (vp run dev / npm run dev)
# Read actual ports from [dev-runner] stdout; use pairingUrl with token.
```

Restart the server after setting/clearing the env. Absent / `0` / unset ⇒
today’s live (G10 stack Layer.empty).

## Ordered proof (live)

Follow `session-runbook.md` §2 / `proof-bar.md` per slice under test:

land → live-authoritative rehearsal → ≡ → rollback drill → dual-run exit →
arm inversion → (campaign) S8 audit / campaign rollback.

Evidence names under `docs/scm/g10/evidence/` (append live-run notes; do not
treat harness-only GREEN as live close).

## Smoke checklist

After env on + restart:

- [ ] Pairing URL works; web talks to this worktree server
- [ ] Untouched seams still behave (spot-check chat / settings)
- [ ] At least one wired seam under S1–S7 exercises without crash
- [ ] Campaign rollback / slice restore returns live authority when drilled
- [ ] Clearing `T2CODE_SCM_G10_CUTOVER` + restart restores default live

After abort / restore:

- [ ] User-visible ops work on live path
- [ ] `T2CODE_SCM_G9_SHADOW` unchanged (shadow env-off is **not** G10 rollback)

## Abort

- **Per-slice:** restore via slice rollback switch (lander files / `g10Rollback`)
- **Campaign:** S8 full-campaign restore to pre-G10 live
- **Ceremony abort** (withdraw auth): only if human chooses — delete/invalidate
  `authorization.md` and restore `g9toG10Authorized: false` per
  `runtime-auth-ceremony.md`

## Explicit forbids

- WP8 763-fixture marathon as G10 live proof
- Unsetting `T2CODE_SCM_G9_SHADOW` as Increment 6 rollback
- Radius resize / OQ7 / home-bus activation / codec / eleventh bus
- Flipping `docs/scm/g10/manifest.json` `completed: true` before live evidence
  is steward-accepted
- Claiming second-physical-fabric I/O (bridge cutover is the authorized model)

## After live GREEN

Human may flip `completed: true` and record live evidence. Until then
`authorizedImplementComplete: true` + `completed: false` is the freeze wall.

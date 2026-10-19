# G10 clean-slice panel governance

<!-- Agent: runtime campaign governance. Orchestrator + Worker + panels.
Does not replace authorization.md. Does not resize campaign radius. -->

- Date: 2026-10-18
- Status: **binding** for authorized Increment 6 runtime lands
- Auth: `docs/scm/g10/authorization.md` + `g9toG10Authorized: true`
- Runbook: `docs/scm/g10/session-runbook.md`
- Plan: `docs/superpowers/plans/2026-10-18-scm-g10-cutover-rollback.md`
- Proof: `docs/scm/g10/proof-bar.md`

## Intent

Land G10 as **clean slices** S0→S8. One **Worker** implements each unit.
A fixed **Thinker + Plan-follower** panel advises. On disagreement, escalate
to a **5-agent panel built for that issue only**.

## Clean-slice rule

A unit is clean only when its Ordered proof package is complete before the
next unit starts. Land order is serial: S0 → S1 → S2 → S3 → S4 → S5 → S6 →
S7 → S8. Sole-lander / handoff discipline:
`docs/scm/g10/cross-slice-cohesion-index.md`. Radius set unchanged
(`session-runbook.md` §1).

## Roles

| Role          | Job                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Orchestrator  | Dispatch Worker; spawn panels; apply agree/disagree; never skip Ordered proof; escalate ties to human |
| Worker        | Implement only the dispatched unit; code + tests + evidence; stop for panel                           |
| Thinker       | Design risk, seam correctness, inversion/rehearsal prudence — not checklist fidelity                  |
| Plan-follower | Fidelity to plan DoD, runbook §1–§2, proof-bar, inventory, landers — not redesign                     |
| Issue 5-panel | Resolve one named conflict; majority binds; tie / BLOCK_HUMAN → human                                 |

Thinker and Plan-follower never see each other’s ballots before both vote.
Worker does not self-arbitrate panel conflict.

## 2-panel protocol

After each Worker proposal:

1. Spawn Thinker and Plan-follower in parallel with the same packet.
2. Each returns:
   - `VERDICT: ACCEPT | REQUEST_CHANGES`
   - `CONFIDENCE: high|medium|low`
   - `ADVICE:` ≤5 bullets (empty ok on clean ACCEPT)
   - `BLOCKERS: none | ...`
3. **Agree** = both ACCEPT, or both REQUEST_CHANGES with compatible advice
   (Orchestrator merges non-conflicting bullets). Worker applies; re-propose
   if any REQUEST_CHANGES.
4. **Disagree** = differing verdicts, or incompatible change requests.
   Orchestrator does not pick a side — escalates.

## Escalation (issue-specific 5-panel)

Orchestrator writes an Issue Charter (problem, advice A vs B, sealed
constraints) and spawns five agents with lenses invented for that issue.

- Ballot: `KEEP_A | KEEP_B | SYNTHESIZE | BLOCK_HUMAN`
- Majority of KEEP\_\* / SYNTHESIZE binds Worker
- Any BLOCK_HUMAN or no majority → human
- Forbidden: radius shrink, OQ7, home-bus activation, codec, undoing auth

Log: `docs/scm/g10/governance/S<n>-escalation-<short-slug>.md`

## Worker packet (required)

1. Cite `authorization.md`; may create `apps/server/src/scm/g10*`
2. Scope = this unit’s DoD + Ordered proof steps only
3. Lander-allowed paths; list forbidden hotspots
4. Evidence filenames from `proof-bar.md`
5. Targeted `vp test run` only
6. Return summary + files + evidence + risks; stop for panel

## Panel forbidden powers

Panels may not authorize radius resize, multi-session cutover, eleventh bus,
home-bus activation, codec, treating 763 as G10 proof, or ceremony rollback.

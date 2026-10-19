# S1 escalation — stub vs all-7 wired

- Date: 2026-10-18
- Unit: S1
- Status: **closed**
- Binding: 5-panel majority **SYNTHESIZE**

## Problem (resolved)

Thinker REQUEST_CHANGES vs Plan-follower ACCEPT — whether dual-run-exit/≡
could claim all 7 while four non-Engine rows were ledger stubs and SETTINGS
was an S2 handoff.

## Binding applied

1. Wire admit/route/replace via `g10SeamBridge` at S1-owned capture modules for
   LIFECYCLE / PREVIEW-AUTO / PROJECT-QUEUE / VCS-EVENTS (plus Engine ORCH-\*).
2. SETTINGS-EVENTS stays S1→S2 handoff stub on `serverSettings.ts` — no
   Engine-wired exit (a) claim; S1 does not commit `serverSettings.ts`.
3. Evidence honesty: wired+exited = six; handoff-pending = SETTINGS only.
4. `OrchestrationEngine.ts` remains sole Engine lander; capture modules may be
   edited for the four S1-owned seams.

## Advice A (Thinker) — absorbed

Cannot claim dual-run-exit/≡ for all 7 while rows are stub-only. SETTINGS may
be S2 handoff. → Applied: wire four; SETTINGS deferred; evidence partitioned.

## Advice B (Plan-follower) — narrowed

Sole lander Engine; Ordered proof sequence + radius OK. → Engine stays sole
lander for ORCH; non-Engine S1-owned rows are capture-module wired (not
permanent stubs); SETTINGS remains handoff.

## Sealed constraints (still hold)

- Sole lander `OrchestrationEngine.ts` for Engine ORCH fabric commits
- SETTINGS-EVENTS handoff to S2 `serverSettings.ts` (cohesion)
- Radius / Ordered proof / sole-owner exit via `recordOrderedProofStep`
- No foreign hotspot commits from S1 Worker beyond the four S1 capture modules

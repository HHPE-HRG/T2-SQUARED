# S0 escalation — proof-step sole owner

<!-- Agent: issue-specific 5-panel charter. Not radius resize. Not auth undo. -->

- Date: 2026-10-18
- Unit: S0
- Status: **closed** — binding applied

## Problem

Thinker REQUEST_CHANGES vs Plan-follower ACCEPT on S0 foundation.

## Advice A (Thinker)

Public `markDualRunExited` can set `authority: "manifold"` + `phase: "exited"`
without recording Ordered-proof step `dual-run-exit`. Same concern for
`armInversion` vs `recordOrderedProofStep("arm-inversion")`. Fix: make
`recordOrderedProofStep` the sole authority flip / arm writer before S1.

## Advice B (Plan-follower)

ACCEPT as-is: S0 DoD/evidence/tests match sealed contracts; no fabric land;
inversion unarmed; blockers none.

## Sealed constraints (must stay true)

- Radius unchanged; home-bus dormant; no codec
- Ordered proof sequence normative (`proof-bar.md`)
- S0 must be green before S1 fabric
- Cannot undo `authorization.md`

## 5-panel tally

| Lens                    | Ballot     |
| ----------------------- | ---------- |
| Seam/state ownership    | KEEP_A     |
| Ordered proof sequence  | KEEP_A     |
| S0-before-S1 prudence   | SYNTHESIZE |
| Public API footgun      | KEEP_A     |
| False-friend / G9 bleed | KEEP_A     |

**Majority: KEEP_A** (4) + SYNTHESIZE (1) — both require sole-owner before exit/arm.

## Binding applied

- `markDualRunExited` always refuses; sole authority flip is
  `recordOrderedProofStep(..., "dual-run-exit")`.
- `armInversion` only delegates to
  `recordOrderedProofStep(..., "arm-inversion")`.

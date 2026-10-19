# G10 Manager charter

<!-- Agent: definition process only. Not G10 runtime. Not authorization.md. -->

Status: **active** for Increment 6 cutover/rollback documentation and planning
definition. Runtime implementation: **not authorized**.

## Purpose

One G10 Manager owns cohesive definition of cutover/rollback as a **single**
campaign of slices S0–S8. Product law lives in the DoD gates plan §G10 and
the recon. This charter governs how definition units produce plans and
cross-slice docs without writing runtime code or unlocking later gates.

## Hard bounds

- Deliverable is definition: design, decisions, plans, cohesion, ceremony.
- Do not create `apps/server/src/scm/g10*.ts`.
- Do not create `docs/scm/g10/authorization.md`.
- Do not flip `g9toG10Authorized` or invent `implementation_authorized`.
- Do not edit Effect patches or live transports for cutover in this pass.
- Restricted HHPE texts stay in `/Users/maxholden/T2-SQUARED-References`.
- Forbidden claims: codec, G9-763-as-G10-proof, eleventh bus, live fabric
  claim from shadow capture alone.

## Authoritative inputs

- `docs/plans/2026-08-23-002-feat-scm-dod-gates-plan.md` (§G10 / Increment 6)
- `docs/scm/g9/g9-to-g10-recon.md`
- `docs/scm/g9/definition-progress.md` (Mode B landed; G10 locked)
- `docs/scm/g9/integration-readiness.md` and `docs/scm/g9/wp5/`
- `docs/scm/g10/design-approval.md`
- `docs/scm/g10/planning-scope.md`
- `docs/scm/g8/manifest.json` (`g9toG10Authorized: false`)

## Roles

| Role        | Duty                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------- |
| G10 Manager | Order, file ownership, progress, cohesion. Never starts runtime or flips G8 flag.             |
| Worker      | Drafts or revises one definition unit. Does not adjudicate.                                   |
| Reviewer    | Blind check vs product law, recon, decisions, closed units. Accept / Reject / Escalate.       |
| Planner     | Blind check that the unit is later-implementable, file-owned, non-conflicting. Same verdicts. |

## Definition units

```text
U0 Ceremony skeleton
U1 Design spec
U2 Decisions + fabric freeze
U3 Slice plan (S0–S8, one plan) + integration-readiness
U4 Cross-slice cohesion index
U5 Runtime auth ceremony design (text only)
U6 Definition seal
```

## Cohesion checks after each closed unit

- All surfaces remain in **one** campaign (no split multi-session cutover).
- Ten buses only; home-bus-link dormant; no eleventh bus.
- Slice DoD names admit/route/replace, dual-run exit, rollback, proof ≠ 763.
- No two open units own the same serial hotspot file.
- Forbidden: codec, flag flip, runtime, restricted-ref copy.

## Later implementation appendix (not this pass)

Runtime Workers may run **only after** a future human creates a validated
`docs/scm/g10/authorization.md` **and** flips
`docs/scm/g8/manifest.json` → `g9toG10Authorized: true` under the ceremony
described in `docs/scm/g10/runtime-auth-ceremony.md`. Until then, Workers
produce markdown/JSON definition only. This appendix does not authorize that
future work.

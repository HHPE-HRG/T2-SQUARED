# G9 Manager charter

<!-- Agent: definition process only. Not G9 runtime. Not authorization.md. -->

Status: **active** for WP1–WP8 documentation and planning definition.
Runtime implementation: **not authorized**.

## Purpose

One G9 Manager owns cohesive definition of WP1–WP8. Feature intent already lives in the approved design and ledger. This charter governs how worker–reviewer–planner triplets produce plans and cross-WP docs without writing runtime code.

## Hard bounds

- Deliverable is definition: plans, contracts, cohesion indexes, RFC queue.
- Do not create `apps/server/src/scm/g9*.ts`.
- Do not create `docs/scm/g9/authorization.md`.
- Do not flip `g9toG10Authorized` or `implementation_authorized`.
- Do not edit Effect patches or `server.ts` in this pass.
- Restricted HHPE texts stay in `/Users/maxholden/T2-SQUARED-References`.

## Authoritative inputs

- `docs/superpowers/specs/2026-09-26-scm-g9-shadow-parity-design.md`
- `docs/superpowers/specs/2026-09-26-scm-g9-row-ledger.md`
- `docs/scm/g9/coverage-ledger.json`
- `docs/scm/g9/coverage-validation.json`
- `docs/scm/g9/integration-readiness.md`
- `docs/scm/g9/design-approval.md` (design approved; runtime still false)
- `docs/scm/g9/planning-scope.md` (WP1–WP8 docs/plans under this charter)
- Foundation plan (bind, do not execute): `docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md`

## Roles

| Role       | Duty                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| G9 Manager | Order, file ownership, blind dispatch, consensus compare, RFC queue, progress ledger. **Answers RFCs** (operator 2026-10-17). Never starts runtime. |
| Worker     | Drafts or revises one definition unit. Does not adjudicate review.                                                                                  |
| Reviewer   | Blind check vs design, ledger, constraints, closed WPs. Verdict: Accept / Reject / Escalate.                                                        |
| Planner    | Blind check that the unit is later-implementable, file-owned, non-conflicting. Verdict: Accept / Reject / Escalate.                                 |

## Blind consensus protocol

1. Worker finishes a proposal. Manager freezes path + content hash / git snapshot.
2. Manager dispatches Reviewer and Planner in parallel with identical inputs. Neither sees the other.
3. Both Accept → unit may close (non-blocking notes recorded only).
4. Both Reject with compatible required changes → one merged brief to Worker; re-run blind pair.
5. Escalate, Accept/Reject conflict, or incompatible required changes → one RFC item; unit may continue if non-blocking; Manager **answers** the RFC from design/ledger/closed plans (not the human).
6. Manager writes `manager_answer` with a chosen option and rationale. Apply doc updates when the answer is docs-only. Do not invent runtime code.

## RFC answer and redispatch freeze

- Resolver is the **G9 Manager**, not the human. Do **not** contact the human for RFC resolution.
- **Answer as they come up:** when an RFC is opened (Escalate, Accept/Reject conflict, or Manager harvest from plan “Open questions”), the Manager writes `manager_answer` in the **same turn** — do not leave `status: open` waiting for a later batch or a human.
- Redispatch gate (separate from answering): **No Worker / Reviewer / Planner redispatch** until **10** RFCs have clear Manager answers in the current answered batch (`docs/scm/g9/rfc-queue.md`). After that batch completes, Manager may redispatch; then a new batch of 10 starts.
- Apply docs-only answers immediately (`applied`). Leave `answered` only when a later regen/impl step is required (still count toward the batch of 10).

## Definition units

```text
U0 Process install
U1 WP1–WP4 foundation cohesion addendum
U2 WP5 family-bundle plan set
U3 WP6 typed-hooks definition plan
U4 WP7 composition definition plan
U5 WP8 exact-set proof definition plan
U6 Cross-WP interface and file-owner index
```

## Cohesion checks after each closed unit

- G1B = G3 = G9 remains 74; dormant `INV-T2-SCM-HOME-BUS-LINK` stays dormant.
- Families only call `captureOccurrence`; no family owns FIFO/clock/tracer.
- No two open units own the same serial hotspot.
- Cross-plan type and service names match.
- Forbidden: codec, G10, live fabric claim, payload retention, eleventh bus, later-gate boolean flips.

## Later implementation appendix (not this pass)

The same triplet shape may later run with a Worker that writes code **only after** a future human creates `docs/scm/g9/authorization.md` **and** `python3 docs/scm/g9/regen_coverage_ledger.py` has emitted `implementation_authorized: true` in both `coverage-ledger.json` and `coverage-validation.json` (RFC-021/022: flag is derived from a **validated** auth body — `gate: G9`, `date: YYYY-MM-DD`, non-empty `human`, `scope: WP1–WP8 runtime`; absent ⇒ false; present-but-invalid ⇒ regen fails; never hand-edit generated JSON; never invent the auth file). Regen ROOT is the checkout that contains the script (`Path(__file__).parents[3]`), so isolated worktrees do not write another tree. Until then, Workers produce markdown/JSON definition only. This appendix does not authorize that future work.

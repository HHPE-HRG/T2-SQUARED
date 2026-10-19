# G10 session runbook (pre-runtime)

<!-- Agent: definition / pre-runtime. Not authorization. Not g10* code.
Does not flip g9toG10Authorized. -->

- Date: 2026-10-18
- Status: **docs binding** for a future one-session runtime campaign
- Plan: `docs/superpowers/plans/2026-10-18-scm-g10-cutover-rollback.md`
- Cohesion: `docs/scm/g10/cross-slice-cohesion-index.md`
- Proof: `docs/scm/g10/proof-bar.md` (**Ordered proof**)
- Ceremony: `docs/scm/g10/runtime-auth-ceremony.md` (**executed** 2026-10-18)
- Auth: `docs/scm/g10/authorization.md` (Max Holden)
- `runtime_authorized`: **true**
- `g9toG10Authorized`: **true**

## 1. Campaign radius (defined)

Campaign blast radius is a **defined constant**, not a dial to grow or shrink.

- **Radius set** = every `comm_id` in
  `docs/scm/g10/seam-inventory-completeness.json` assigned to S1–S7 whose
  phases are not `dormant-preserved`. Membership and count are
  **inventory-authoritative** (do not maintain a parallel hand-edited
  number). Today: **73 activatable** + **1** dormant-preserved
  (`INV-T2-SCM-HOME-BUS-LINK`) of **74** total.
- **End-state claim** = after Ordered proof completes for all activatable
  slices, manifold authority + noninterference inversion may be armed across
  that **same** radius set.
- **Non-goals** = do not shrink via OQ7 / multi-session; do not expand via
  codec, eleventh bus, or home-bus-link activation.
- Ordered proof and live rehearsal **order risk**; they **do not** change the
  radius set.

### Blast-radius acceptance

Authorizing G10 runtime for **one session** means accepting the **defined**
radius above (full Increment 6; OQ7 closed). Cut-over path failure may fail
the user-visible operation for a slice **after** that slice’s Ordered proof
arms inversion. Signing `authorization.md` later implies acceptance of this
defined radius — not a negotiation to resize it.

## 2. Barrier order

```text
S0 contracts + rollback-switch tests green
  → for each S1–S7 (lander order / cohesion):
       admit/route/replace land
       → live-authoritative rehearsal green
       → cutover ≡ green
       → slice rollback drill green
       → dual-run exit
       → arm inversion for that slice
  → S8 campaign exit audit + campaign rollback + aggregate proof
```

1. **S0** — substitution model, per-slice rollback switch contract, proof
   harness shape, inversion **policy** only (not armed). No fabric claim.
   Must be green before any S1–S7 land.
2. **S1–S7 (each slice)** — sole landers commit hotspot files; handoff
   authors do not (`cross-slice-cohesion-index.md`). Hard sequence: land →
   **live-authoritative rehearsal** → ≡ → restore drill → exit → arm
   inversion. Do not exit or arm inversion before rehearsal + ≡ + restore
   are green. Live remains authoritative through rehearsal.
3. **S8** — every activatable inventoried row has completed the per-slice
   sequence (or dormant-exempt); full-campaign rollback; aggregate cutover ≡
   under `G9DeferredEquality`. Radius set unchanged.

### Proof gates

Normative detail: `docs/scm/g10/proof-bar.md` **Ordered proof (in-session)**.

Forbidden:

- Dual-run exit or inversion before that slice’s live-rehearsal + ≡ +
  rollback-drill are green
- Treating rehearsal as exit or as inversion armed
- Using rehearsal (or any Ordered proof step) to drop `comm_id`s from the
  radius set
- S8 close before all activatable slices complete the sequence

Evidence name (definition): `docs/scm/g10/evidence/S<n>-live-rehearsal.md`

## 3. Out of scope in session

- Home-bus-link **activation** (dormant-preserved only)
- Codec / nibble / dictionary / eleventh bus
- Resizing the campaign radius set (OQ7 / multi-session / extra buses)
- Treating as G10 proof or rollback:
  - WP8 763-fixture marathon alone
  - G9 Mode B exact-set / observe-beside alone (rehearsal is G10 seams,
    still non-inverted)
  - `captureOccurrence` / capture-beside landings
  - Unsetting `T2CODE_SCM_G9_SHADOW` (shadow env-off)

## 4. Abort

- **Per-slice:** restore via the slice rollback switch (lander files named in
  plan DoD); no new halt controller. Prefer abort while still pre-exit if
  rehearsal, ≡, or restore fails.
- **Campaign:** S8 full-campaign restore to pre-G10 live.
- **Ceremony abort** (if auth was executed then withdrawn): delete or
  invalidate `docs/scm/g10/authorization.md` and restore
  `g9toG10Authorized: false` per `runtime-auth-ceremony.md`. Leave definition
  package intact.

## 5. Staffing

The session must encompass **full S0–S8**, including per-slice Ordered proof
(with live rehearsal) and the S8 proof package. Do not split mid-campaign
across sessions. Radius set stays inventory-defined.

### Clean-slice panel governance

Runtime lands use Worker + Thinker + Plan-follower panels per
`docs/scm/g10/governance/clean-slice-panel.md`. Disagree → issue-specific
5-panel. Orchestrator never skips Ordered proof.

### Live-cutover ops

Process-live opt-in SOP: `docs/scm/g10/ops/live-cutover-runbook.md`
(`T2CODE_SCM_G10_CUTOVER`; worktree `.t3` only). Authorized implement is
frozen at `docs/scm/g10/governance/auth-freeze.md` — next is live test,
maintenance debug, or **new** authorization.

## Binding pointers

- Governance: `docs/scm/g10/governance/clean-slice-panel.md`
- Integration barriers: `docs/scm/g10/integration-readiness.md`
- Inventory: `docs/scm/g10/seam-inventory-completeness.md` /
  `seam-inventory-completeness.json`
- Auth council (advisory): `docs/scm/g10/auth-council.md`

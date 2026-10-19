# G10 cutover and rollback (Increment 6)

<!-- Agent: definition package + runtime auth. Land per session-runbook Ordered proof. -->

Status: **definition closed**; **runtime authorized** 2026-10-18
(`authorization.md` + `g9toG10Authorized: true`). Package completeness is
**not** human A7 attestation. G9 auth did not unlock G10.

**G10** is live fabric replacement: chosen T2 modules communicate through
the SCM manifold rather than only through wrapped Effect RPC / other live
paths. Rollback is part of the same Increment. G5–G9 may wrap, project, or
observe; **replacement is G10**.

Prerequisite: G9 Mode B shadow-label parity (landed; see
`docs/scm/g9/definition-progress.md`). G9 proof (763 exact-set) is **not**
G10 readiness.

## Campaign shape

One definition workload and (later) one runtime session cover **all**
surfaces as ordered cutover slices S0–S8. Per-surface dual-run exit,
rollback drill, and proof — not separate multi-session cutovers per
platform.

## Later gates / locks

- `docs/scm/g8/manifest.json` → `g9toG10Authorized: true` (ceremony
  2026-10-18; see `authorization.md`).
- This package uses `doesNotAuthorizeLaterGates: true` (does not unlock
  codec / eleventh bus / post-G10 gates).
- Codec / nibble alphabet / production encoding stay out unless separately
  authorized.
- Restricted HHPE texts stay in `/Users/maxholden/T2-SQUARED-References`.

## Non-goals

- Claiming cutover **proven** from G9 763 or definition/seal alone
- Inventing an eleventh bus or activating dormant home-bus-link
- Treating council AUTH or `SEAL_PASS` as substitutes for `authorization.md`
- WORK-000035 losslessness (deferred; cutover reuses `G9DeferredEquality`)

## Binding docs

- Planning scope: `docs/scm/g10/planning-scope.md`
- Design approval: `docs/scm/g10/design-approval.md`
- Manager charter: `docs/scm/g10/manager-charter.md`
- Binding decisions: `docs/scm/g10/decisions.md`
- Integration / slice matrix: `docs/scm/g10/integration-readiness.md`
- Cross-slice cohesion: `docs/scm/g10/cross-slice-cohesion-index.md`
- Future runtime auth ceremony (text only): `docs/scm/g10/runtime-auth-ceremony.md`
- Seam inventory: `docs/scm/g10/seam-inventory-completeness.md`
- Proof bar: `docs/scm/g10/proof-bar.md`
- Adversarial: `docs/scm/g10/adversarial-review-charter.md`
- Progress: `docs/scm/g10/definition-progress.md`
- Manifest: `docs/scm/g10/manifest.json`
- Design: `docs/superpowers/specs/2026-10-18-scm-g10-cutover-rollback-design.md`
- Plan: `docs/superpowers/plans/2026-10-18-scm-g10-cutover-rollback.md`
- Planning input: `docs/scm/g9/g9-to-g10-recon.md`

README is explanatory. Not a reviewed-package digest.

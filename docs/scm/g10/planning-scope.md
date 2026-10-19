# G10 planning scope (Increment 6 definition)

<!-- Agent: docs and plans only. Not runtime. Not authorization.md. -->

- Date: 2026-10-18
- Human operator scope for this manager pass: **documentation and planning**
  for full Increment 6 cutover/rollback as one campaign of per-surface slices.
- Design planning authorized via `docs/scm/g10/design-approval.md`.
- Runtime implementation remains **not authorized**.
- Do not create `docs/scm/g10/authorization.md`.
- Do not flip `docs/scm/g8/manifest.json` → `g9toG10Authorized`.
- Do not set any G10 `implementation_authorized` / runtime flag.
- Process: `docs/scm/g10/manager-charter.md`.
- Product choices locked in `docs/scm/g10/decisions.md` (1A full Increment 6;
  2A per-surface slices; all slices in one session/workload).

## In scope

- Ceremony package under `docs/scm/g10/`
- Cutover/rollback design spec and single multi-slice plan under
  `docs/superpowers/`
- Fabric-claim freeze, slice DoD text, cohesion index, future auth ceremony
  design (text only)
- Definition progress seal (definition closed; runtime locked)

## Out of scope

- Executing slices S0–S8 as runtime
- Creating `apps/server/src/scm/g10*.ts` or live-path substitution code
- Effect patch / `server.ts` cutover edits
- Codec / nibble / dictionary / eleventh bus
- Copying restricted HHPE refs into git
- Multi-session “cutover platform X later” campaigns
- Committing unless a human separately asks

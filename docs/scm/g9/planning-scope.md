# G9 planning scope (WP1–WP8 definition)

<!-- Agent: docs and plans only. Not runtime. Not authorization.md. -->

- Date: 2026-10-17
- Human operator scope for this manager pass: **documentation and planning** for WP1 through WP8.
- Design remains approved (`docs/scm/g9/design-approval.md`).
- Runtime implementation remains **not authorized**.
- Do not create `docs/scm/g9/authorization.md`.
- Do not set `implementation_authorized: true`.
- Do not flip `g9toG10Authorized`.
- Process: `docs/scm/g9/manager-charter.md`.
- This record **extends** planning beyond the WP1–WP4-only note in `design-approval.md`. It does not replace design approval and does not authorize WP5–WP8 runtime.

## In scope

- Manager charter, prompts, RFC queue, definition progress
- WP1–WP4 cohesion addendum binding the existing foundation plan
- WP5–WP8 definition plans (interfaces, file owners, acceptance gates as text)
- Cross-WP cohesion index

## Out of scope

- Executing foundation Tasks 1–13
- Creating `apps/server/src/scm/g9*.ts`
- Effect patch edits, `server.ts` G9 Layer, production timers
- Committing unless a human separately asks

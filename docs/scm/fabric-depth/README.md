# Fabric-depth campaign (named charter — not G11)

<!-- Agent: design + draft auth only (steward 1B). No implement until ceremony
promotes authorization.DRAFT.md. Does not resize radius. Does not unlock
home-bus / codec / eleventh bus. -->

- Date: 2026-10-18
- Status: **charter draft** (implement blocked)
- Relation to G10: G10 sealed **bridge / authority selection**
  (`apps/server/src/scm/g10SeamBridge.ts`). Fabric-depth is the next large
  multi-slice program that makes `manifoldEffect` **real I/O** when manifold
  authority is active, then retires soft live fallback.
- Prerequisite: G10 package complete (`docs/scm/g10/manifest.json`
  `completed: true`; live evidence
  `docs/scm/g10/evidence/live-cutover-2026-10-18.md`).

## Index

| Doc                                              | Role                                              |
| ------------------------------------------------ | ------------------------------------------------- |
| [design.md](design.md)                           | End-state honesty + soft-fallback retirement plan |
| [planning-scope.md](planning-scope.md)           | In / out / non-unlocks                            |
| [session-runbook.md](session-runbook.md)         | Proposed FD0–FD8 slice map (draft)                |
| [authorization.DRAFT.md](authorization.DRAFT.md) | Ceremony-ready body — **not** durable unlock      |
| [ceremony-checklist.md](ceremony-checklist.md)   | Preconditions before human ceremony               |

## Explicit

- Do **not** invent numbered gate “G11”.
- Do **not** implement under G10 auth alone.
- Promote DRAFT → `authorization.md` only in a **separate** human ceremony.

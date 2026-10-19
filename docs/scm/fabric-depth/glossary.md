# Fabric-depth glossary (speech lock)

<!-- Agent: bare “fabric” forbidden in FD docs. Three-way split from Wave 1 cache. -->

- Date: 2026-10-19
- Status: **binding** for Fabric-depth charter docs

## Required terms

| Say                              | Meaning                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **fabric seams**                 | Inventoried activatable `comm_id`s owned by G10 slices S1–S7 inside the frozen radius (73 + 1 dormant). Noun for the seam surface.          |
| **G10 bridge** / **G10 cutover** | Increment 6 authority selection via `runG10SeamBridge` + env `T2CODE_SCM_G10_CUTOVER`. Package-complete; soft-fallback may remain `active`. |
| **Fabric-depth**                 | Named campaign: real `manifoldEffect` I/O + soft-fallback retirement. Requires ceremony. Never call it G11.                                 |

## Forbidden

- Bare word **fabric** alone in FD charter docs (always qualify).
- Inventing numbered gate **G11**.
- Calling G10 live GREEN “Fabric-depth proof”.
- Treating **ten-bus** as a resize dial — cohesion decision label only.
- Equating **fabric seams** with **manifold authority**, **cutover**, **inversion**, or **capture** (those are phase/law verbs or paths).

## Slice roles

| Id    | Role                                                    |
| ----- | ------------------------------------------------------- |
| S0    | Contracts only — **no** fabric-seam land                |
| S1–S7 | Fabric-seam slices (`G10FabricSliceId`)                 |
| S8    | Campaign audit of frozen set — not a fabric-seam lander |

## Ownership

Exclusive `comm_id` ownership + sole-lander / handoff file rules remain as in
G10 `cross-slice-cohesion-index.md`. Fabric-depth does not reassign ownership
without handoff docs.

## Bridge purity

`runG10SeamBridge` stays a pure Effect authority selector: it does not mark
dual-run-exit, resize radius, invent G9 capture, or perform I/O itself.
Callers keep G9 capture-beside on the live/manifold Effects they pass.

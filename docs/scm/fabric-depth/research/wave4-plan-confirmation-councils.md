# Wave 4 — Plan confirmation vs Wave 4 cache (3 isolated)

<!-- Agent: confirmation wave. Separate context from Wave 4 research.
Reads fabric-definition-cache-wave4.json + fabric-depth plan package only.
Not authorization. Not implement. -->

- Date: 2026-10-19
- Size: **3** isolated councils; no peer findings; no research narratives
- Cache: `fabric-definition-cache-wave4.json` (W4-R1–R4)
- Plan: `docs/scm/fabric-depth/` README, glossary, design, planning-scope,
  session-runbook, proof-bar, authorization.DRAFT, ceremony-checklist,
  manifest.json, ops/soft-fallback-signal.md, evidence/manifold-io-census.md

## Ballot: PLAN_MATCH

| ID    | Lens           | PLAN_MATCH  | FALSE_FRIENDS | CONF |
| ----- | -------------- | ----------- | ------------- | ---- |
| W4-C1 | coverage       | **COVERED** | YES           | high |
| W4-C2 | plan fidelity  | **COVERED** | YES           | high |
| W4-C3 | open-questions | **COVERED** | YES           | high |

**Tally:** COVERED **3** · PARTIAL **0** · GAP **0**

## Council sense

Plan package **matches and covers** all four Wave-4 research cache artifacts.
Research/confirmation contexts stayed separated (confirm councils saw cache +
plan only).

### Covered well

- All W4-R1–R4 `necessary_properties` and `fabric_is_not` fences across
  glossary, design, planning-scope, proof-bar, soft-fallback-signal, census,
  auth DRAFT, and runbook (C1)
- Three-way split held; DRAFT ≠ unlock; `fabricDepthAuthorized: false`;
  distinct `T2CODE_SCM_FABRIC_DEPTH`; soft-fallback contract matches R3 (C2)
- W4-R3 dual-env concurrency and FD restart-vs-hot remain **implement-time**
  open Qs — correctly deferred post-ceremony; do not force PARTIAL (C3)

### Steward next

Ceremony docs-readiness remains GREEN (Wave 3). Wave 4 re-confirms fabric
definition post-batteries. Human unlock boxes still open
(`authorization.md` + `fabricDepthAuthorized: true`). No implement under DRAFT.

---
title: Fill the ASD-STE sandbox - Plan
type: feat
date: 2026-08-17
topic: asd-ste100-coverage
parent_campaign_plan: docs/plans/2026-08-13-001-feat-asd-ste100-enforcement-plan.md
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: operator-brief
execution: code
---

# Fill the ASD-STE sandbox - Plan

## Goal Capsule

- **Objective:** Keep the existing enforcement chassis. Replace bootstrap, synthetic, and provisional language-authority dependencies with a real Issue 9-derived authority, then grow rule and surface coverage monotonically.
- **Product authority:** Parent campaign `docs/plans/2026-08-13-001-feat-asd-ste100-enforcement-plan.md` remains the product contract. Do not edit that plan body. Do not start CAN. Do not import the complete official dictionary into Git.
- **Stop:** If a unit would rebuild a generalized language registry, add a new top-level profile family, claim language-authority approval, or treat heuristics as Issue 9 ids, stop.

---

## Product Contract

### Summary

The enforcement chassis is largely built.
The remaining campaign fills the sandbox.
Do not restart around a new architecture.

### Problem Frame

One public command, Forgejo trusted jobs, fail-closed admission, private vocabulary mount, digest pin, ownership, attestations, diagnostics, overrides, and the language-authority claim check already exist.
Five reviewed Issue 9 ids are live: 1.1, 4.5, 5.1, 6.3, 6.6.
The live pin is still the three-lemma fixture SHA.
`vocabularyReview` is `human-verified` on that fixture, which is the honesty gap, not a missing CLI.
Mapping machinery exists. Promotion of the rest of Issue 9 is incomplete.
`t2.asd-ste100.terms.json` is a string bank, not a concept model.
Extraction covers Markdown prose and TypeScript strings only.

### Actors

- A1. **Trusted runner:** Mounts `ASD_STE100_VOCABULARY`. Combines Git-derived metadata with the private source when a checker needs source.
- A2. **Bridge:** Private SQLite, scan-once, fork/mutate, export. Git stores hashes, counts, review state, and T2 terms.
- A3. **Admission:** A rule that applies but cannot be evaluated is uncheckable. It does not invent an ASD diagnostic.
- A4. **Human:** Git merge remains the gate for pin change, rule promotion, term consolidation, and refactor/delete of the live bank.

### Key Flows

- F1. Real Issue 9 mount replaces fixture bytes on `t2-trusted` without changing `cli.ts` as the public entry.
- F2. Real lexicon export feeds Rule 1.1. Stock rows stay in the private DB. Git does not gain official definitions or examples.
- F3. Every Issue 9 writing rule is classified, then promoted or marked uncheckable / not-applicable.
- F4. Natural-language surfaces expand before identifier projection.
- F5. T2 terms gain concept, canonical flag, and software forms. That extension is T2 policy, not an ASD claim.

### Requirements

- R1. Do not edit the parent enforcement plan body.
- R2. Do not start CAN.
- R3. Do not copy official dictionary rows, examples, definitions, or page images into Git.
- R4. Keep `npm run ci:asd-ste100` as the only public command.
- R5. Keep the profile bundle: `t2.asd-ste100.json` plus `rules`, `terms`, `ownership`, `reviewers`, `overrides`, `anchor`. Add structure inside those files before adding new top-level profile files.
- R6. Keep heuristics visible and outside G2 unless a later unit maps a writing failure to a reviewed Issue 9 id.
- R7. Classify each Issue 9 writing rule as exactly one of: `deterministic`, `parser-mechanical`, `contextual/semantic`, `human-review`, `not-applicable-to-surface`.
- R8. Uncheckable applicable rules use `admission.ts`. They do not mint a fake ASD id.
- R9. Private DB may hold source-derived detail. Git holds lemma identity or hash, status, part of speech, form information, checker class, source page identity, and review state.
- R10. Identifier projection (`MergeGate` / `mergeGate` / `merge-gate`) is labeled T2 policy.

### Acceptance Examples

- AE1. **Covers R4, R5.** Given the repo, when a maintainer runs the public command, then the same `cli.ts` path runs locally and on Forgejo trusted jobs.
- AE2. **Covers R3, R9.** Given a real Issue 9-derived pin, when Git is leak-scanned, then no official `words` dump or JPG is present, and G3 matches the trusted mount.
- AE3. **Covers R7, R8.** Given the coverage ledger, when classification is complete, then every writing-rule id has a class, and uncheckable applicable rows fail closed through admission.
- AE4. **Covers first milestone.** Given connected mode, when the synthetic three-lemma pin is gone, then `bootstrap-pending`, fixture SHA, and fixture-scale `lemmaCount` are no longer the live authority.

### Success Criteria

- The checker is a real Issue 9-derived enforcement platform for T2, still a mechanical rule-subset result, not a language-authority certificate.
- New rules and surfaces follow map → classify → implement or mark review-required → test → promote → ratchet.
- T2 terms can name a concept and canonical term without a second bank.

### Scope Boundaries

**In this slice**

- Qualify the real vocabulary source through the existing bridge and trusted mount.
- Complete Issue 9 writing-rule classification and promote what is mechanically enforceable.
- Enrich `terms.json` in place (concept, canonical, software forms).
- Expand natural-language surfaces after 1.1 is production-qualified.

**Deferred**

- Distinct-principal KTD28.
- Process-language model.
- Full repository migration of unchanged upstream T3 prose.
- Identifier projection until natural-language surfaces are solid.

**Outside this product**

- ASD certification claims.
- A new generalized language-registry architecture.
- CAN campaign start.
- Importing the complete official dictionary into Git.

### Assumptions

- Ordered Issue 9 JPGs and `lexicon-private` already exist off Git.
- GitHub Actions stay non-authoritative.
- Hash-in-Git is for repo size. Authority on the live bank is refactor, delete, and consolidate. Additions may merge without that privilege.

---

## Current chassis (retain)

| Layer               | State                                                     |
| ------------------- | --------------------------------------------------------- |
| CI entry            | `npm run ci:asd-ste100`                                   |
| Forgejo             | PR / main / release trusted jobs on `t2-trusted`          |
| Fail-closed         | Admission, vocabulary mount, claim checks                 |
| Vocabulary handling | Private mount + digest pin                                |
| Ownership           | Closed path classification                                |
| Evidence            | Diagnostics + attestations                                |
| Overrides           | Targeted override records                                 |
| Extraction          | Markdown prose + TypeScript strings                       |
| Promoted ASD ids    | 1.1, 4.5, 5.1, 6.3, 6.6                                   |
| Live pin            | Three-lemma fixture SHA; `human-verified` on that fixture |
| T2 terms            | `t2.asd-ste100.terms.json` string bank                    |

Profile bundle stays:

```text
t2.asd-ste100.json          profile / root authority
  ├── rules.json            ASD applicability + checker mappings
  ├── terms.json            T2 technical terminology
  ├── ownership.json        enforcement surfaces
  ├── reviewers.json        human authority
  ├── overrides.json        governed exceptions
  └── anchor.json           activation / protection state
```

Private side stays:

```text
Issue 9 scans → bridge.sqlite → normalized lexicon → ASD_STE100_VOCABULARY
```

---

## Four remaining problems

### P1. Complete Issue 9 mapping and promotion

Use existing chunk, wave, merge, coverage ledger, official-unreviewed records, and `admission.ts`.
Do not assume every writing rule becomes a hard mechanical check.
Classify, then promote or mark uncheckable / not-applicable.

### P2. Finish the real vocabulary bridge

Keep the pipeline. Change the export schema so Rule 1.1 is not the only consumer.
Private records may include forms, status, part of speech, alternatives, and source refs.
Git records stay derived metadata plus pin. No official definitions or examples in Git.

### P3. Strengthen `t2.asd-ste100.terms.json`

Do not add another bank.
Add concept, canonical term, subject fields, ASD basis ids, and software forms when a term is promoted.
Concept → canonical technical term → permitted code/schema/CLI shapes.

### P4. Expand governed surfaces gradually

Order: Markdown prose, TypeScript strings/comments/docblocks, JSON/YAML descriptive values, plan/work-registry prose, schema title/description, CLI help/error text.
Identifiers later, as T2 policy.

---

## Critical path

```text
REAL ISSUE 9 MOUNT
        ↓
REAL LEXICON EXPORT
        ↓
RULE 1.1 PRODUCTION QUALIFICATION
        ↓
COMPLETE ISSUE 9 RULE CLASSIFICATION
        ↓
PROMOTE MECHANICALLY ENFORCEABLE RULES
        ↓
EXPAND GOVERNED SURFACES
        ↓
STRENGTHEN T2 TECHNICAL TERM SCHEMA
        ↓
RATCHET OWNERSHIP / COVERAGE
        ↓
FULL T2 ENFORCEMENT
```

### First milestone

Replace every bootstrap, synthetic, and provisional language-authority dependency in the existing checker with a real Issue 9-derived authority, while preserving the fail-closed Forgejo contract.

Concretely leave behind:

- `anchor.json` `bootstrap-pending`
- fixture `lemmaCount` 3
- fixture SHA as live G3 pin
- fixture-scale approved set driving Rule 1.1
- Issue 9 mount absent on the trusted runner

Do not change the enforcement architecture to do that.

After that milestone, each new rule or surface is a coverage increment.

---

## Verification Contract

- `npm run test:asd-ste100` and `npm run ci:asd-ste100` remain the gates.
- GitHub Actions remain non-authoritative.
- Leak / AE10 holds remain.
- Parent enforcement plan body is untouched.

## Definition of Done (first milestone)

- Trusted mount bytes match a real Issue 9-derived export, not `synthetic.json`.
- G3 pin and lemma count match that export.
- Git still has no official `words` dump, definitions, examples, or JPGs.
- Claim text remains “ASD-STE100 mechanical rule-subset result.”

## Open Questions

None blocking the first milestone.

## Risks

- Classifying all writing rules as deterministic would over-claim. Mitigation: five-way class plus admission.
- Putting full forms in Git would bloat the repo and fight the size reason for pins. Mitigation: R9 split.
- Enriching `terms.json` before a real 1.1 pin would grow T2 exceptions on a fixture dictionary. Mitigation: first milestone before P3/P4.

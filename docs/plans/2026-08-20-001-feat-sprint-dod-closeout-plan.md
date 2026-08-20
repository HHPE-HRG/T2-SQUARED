---
title: Sprint DoD closeout for ASD-STE100 and the work registry - Plan
type: feat
date: 2026-08-20
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: parent-campaigns
execution: code
origin: docs/plans/2026-08-17-001-feat-fill-asd-ste-sandbox-plan.md
parent_campaign_plan: docs/plans/2026-08-13-001-feat-asd-ste100-enforcement-plan.md
work_registry_plan: docs/plans/2026-08-13-002-feat-t2-work-registry-plan.md
---

# Sprint DoD closeout for ASD-STE100 and the work registry - Plan

## Goal Capsule

- **Objective:** Make the sprint Definition of Done finite and checkable. Finish the remaining generative ASD-STE100 and work-registry requirements today. Stop treating Issue 9 coverage and registry identity as an open-ended campaign.
- **Product authority:** Parent ASD plan `docs/plans/2026-08-13-001-feat-asd-ste100-enforcement-plan.md` stays the ASD product contract. Do not edit that body. Fill-sandbox child `docs/plans/2026-08-17-001-feat-fill-asd-ste-sandbox-plan.md` stays the coverage child. Work-registry first slice stays the registry product contract. Binding remains ASD CI → T2 work-registry → CAN. Do not start CAN.
- **Stop:** Stop if a unit would copy official Issue 9 lemmas, definitions, examples, or page images into Git. Stop if a unit would implement remaining writing-rule checkers as live G2. Stop if a unit would start CAN ingest, LLM extractors, production intent/repair/runtime, GitHub Actions as authority, or a new top-level profile family. Stop if a unit would rebuild the enforcement chassis or the vocabulary bridge that already exists.
- **Execution:** Create the features and the proving tests in the T2 working tree. Git commit, merge, push, PR, tag, and host-protection work are outside this plan's Definition of Done.

## Product Contract

### Summary

This sprint closes generative DoD for two products that already have chassis.

ASD keeps the mechanical rule-subset claim. It finishes Issue 9 writing-rule classification as a frozen ledger, keeps live G2 at the five mechanical ids, and proves uncheckable applicable ids cannot silently pass.

The work registry finishes the first slice by requiring compiled `work`, `pull`, and `event` records from the proposal, with named AE1–AE5 tests and drift CI.

Surface expansion, CAN, certification, and git publishing stay out.

### Problem Frame

Parent ASD units U1–U7 and fill-sandbox first-milestone chassis already exist on the live Forgejo tree: one public command, fail-closed admission, private vocabulary pin, ownership, attestations, overrides, extraction, and five reviewed live ids `1.1`, `4.5`, `5.1`, `6.3`, `6.6`.

The remaining hole is not "more Issue 9 checkers." It is that classification is still provisional. `scripts/asd-ste100/mapping/records/official-unreviewed.json` already lists 63 writing-rule ids, all with `reviewed: false`. Live `scripts/asd-ste100/mapping/records/records.json` holds only the five deterministic ids. `coverage-ledger.json` is still 430 page-wave placeholders, not the writing-rule ledger of record. Fill-sandbox AE3 is therefore unmet.

GitHub `main` is not the live DoD surface. Its work-registry `CompiledSchema` is still terms-only. Forgejo already compiled identity records for live campaigns. This plan treats Forgejo as the feature baseline and GitHub as stale evidence.

The work-registry first slice is unmet on any tree whose compiler still emits terms without `work`, `pull`, and `event`.

### Actors

- A1. **Implementer:** Lands classification freeze, completeness CI, and identity compile in the working tree without publishing git.
- A2. **Admission:** A live `fail_closed_uncheckable` row cannot pass. A `not-applicable-to-surface` row does not mint an admission finding.
- A3. **Compiler:** Reads proposal identity sentences and writes `work`, `pull`, and `event` records.
- A4. **Human mapping reviewer:** Marks the 63-id ledger reviewed under R3. This is T2 mapping review, not an ASD language-authority certificate.

### Key Flows

- F1. Completeness CI loads the frozen writing-rule inventory. Every id has exactly one class. Missing or duplicate ids fail the public ASD command.
- F2. Promote and live-scan stay separate. Live G2 remains the five mechanical ids. Overlay classes for the other ids stay out of `t2.asd-ste100.rules.json`.
- F3. If a `fail_closed_uncheckable` row is present in live mapping records, `admission.ts` emits `T2-ADMISSION-uncheckable` and the aggregate gate fails unless a targeted override from a different principal exists.
- F4. Campaign compile greps the proposal for progeny and Forgejo-review identity sentences, writes `work` / `pull` / `event`, and drift-checks the full schema.
- F5. T2 terms already carry concept, canonical, subject, ASD basis, and software forms. Completeness CI fails if a promoted term drops those fields.

### Requirements

#### Classification freeze (fill-sandbox R7, R8, AE3)

- R1. Keep the writing-rule inventory closed at the existing 63 ids in `official-unreviewed.json` (`1.1`–`1.14`, `2.1`–`2.2`, `3.1`–`3.7`, `4.1`–`4.5`, `5.1`–`5.5`, `6.1`–`6.6`, `7.1`–`7.3`, `8.1`–`8.7`, `9.1`–`9.4`, `GR-1`–`GR-8`, `front-matter`, `part2-dictionary`). Do not add invented ids. Do not copy official rule text into Git.
- R2. Each inventory id has exactly one class from fill-sandbox R7: `deterministic`, `parser-mechanical`, `contextual/semantic`, `human-review`, or `not-applicable-to-surface`.
- R3. The classification ledger of record is reviewed (`reviewed: true`). Use distinct `authorId` and `reviewerId` when two mapping principals exist. If the tree is still under the existing KTD28 self-sign threshold in `scripts/asd-ste100/mapping/promote.ts`, self-sign is allowed for this mapping review. Mapping review is not a language-authority claim.
- R4. Live G2 (`t2.asd-ste100.rules.json` and live `records.json`) stays the five mechanical ids `1.1`, `4.5`, `5.1`, `6.3`, `6.6`. Uncheckable ids stay out of live G2.
- R5. Applicable uncheckable ids cannot silently pass. A live `fail_closed_uncheckable` row fails through `scripts/asd-ste100/admission.ts`. A `not-applicable-to-surface` row does not emit that finding.
- R6. Completeness of the 63-id ledger is enforced by `npm run ci:asd-ste100`. Page-wave `coverage-ledger.json` placeholders are not the writing-rule ledger of record.

#### Chassis freeze (parent U1–U7, fill-sandbox R1–R6, R9–R10, P3)

- R7. Do not edit the parent enforcement plan body.
- R8. Do not start CAN. Do not copy official dictionary rows, examples, definitions, or page images into Git.
- R9. Keep `npm run ci:asd-ste100` as the only public ASD command and `npm run ci:work-registry` as the only public registry command.
- R10. Keep the existing profile bundle. Add structure inside those files before adding new top-level profile files.
- R11. Promoted T2 terms keep `concept`, `canonical`, `subjectFields`, `asdBasis`, and software forms. Identifier projection remains T2 policy, not an ASD claim.
- R12. Governed natural-language surfaces stay the current extractors: Markdown prose, TypeScript strings/comments/docblocks, and JSON/YAML descriptive values. Identifier membership is out of this sprint.

#### Work-registry first slice

- R13. `CompiledSchema` includes `work`, `pull`, and `event` records. Compile writes those records from the proposal. Terms-only compile is a failure.
- R14. Identity extraction greps `The progeny (?:is|`is`) \`id\`.` and `The Forgejo-review (?:is|`is`) \`id\`.` Missing pull fails with `the pull is missing.`
- R15. When a campaign is Forgejo-approved, genesis `forgejoReviewId` matches the compiled pull id.
- R16. Drift CI compares the compiled dictionary plus `work` / `pull` / `event` to the campaign tree.
- R17. The five named first-slice tests (work-registry contract AE1–AE5) exist in `scripts/work-registry/work-registry.test.ts` and fail when identity compile is absent. Those registry ids are not this plan's Product Contract AE1–AE5.
- R18. No CAN ingest. No LLM extractors. Child work and event-chain *support* in the compiler is enough. Authored high-load event chains are out.

### Acceptance Examples

- AE1. **Covers R1–R3, R6.** Given the 63-id inventory, when completeness CI runs, then every id has one reviewed class and a missing id fails `npm run ci:asd-ste100`.
- AE2. **Covers R4, R5.** Given live mapping with only the five mechanical ids, when the public ASD command runs, then no `T2-ADMISSION-uncheckable` finding is minted for overlay-only uncheckable ids. Given a fixture that places `1.2` in live `records.json` as `fail_closed_uncheckable`, then admission fails closed.
- AE3. **Covers R11.** Given a promoted term missing `concept` or software forms, when the public ASD command runs, then the run fails.
- AE4. **Covers R13–R15.** Given a Forgejo-approved campaign proposal without a Forgejo-review identity sentence, when compile runs, then it fails with `the pull is missing.`
- AE5. **Covers R13, R16, R17.** Given a campaign whose schema has terms but no `work` / `pull` / `event`, when `npm run ci:work-registry` runs, then drift fails. The work-registry contract's named AE1–AE5 tests stay red until compile writes those records.

### Success Criteria

- Generative DoD is a finite checklist in this file, not a future mapping campaign.
- ASD still claims only a mechanical rule-subset result.
- After these units, ASD and the work registry have no remaining generative sprint work.
- Local `npm run ci:asd-ste100` and `npm run ci:work-registry` prove the freeze.

### Scope Boundaries

**In this sprint**

- Freeze and review the existing 63-id writing-rule classification.
- Prove live G2 vs overlay vs admission with tests.
- Require work/pull/event compile, drift, and named AE1–AE5 tests.
- Ratchet existing T2 term fields and current extractors.

**Deferred (explicitly not today)**

- Implementing additional Issue 9 writing rules as live G2 checkers.
- Expanding extractors to identifiers, CLI help, or schema title/description beyond what already exists.
- Authored event chains, child-campaign live data, and JSON Schema docs for the registry.
- Distinct-principal mapping KTD28 beyond the existing self-sign threshold already in `promote.ts`.
- Git commit, merge, push, PR, tag, host protection, and GitHub sync.

**Outside this product**

- ASD certification or language-authority claims.
- CAN campaign start.
- Production intent capture, translation, repair, and runtime admission hooks from parent exclusions.
- Importing the official dictionary into Git.
- GitHub Actions as acceptance evidence.
- Editing `docs/plans/2026-08-13-001-feat-asd-ste100-enforcement-plan.md`.

### Assumptions

- The operator calendar constraint ("cannot work on ASD and the work registry after today") selects classify-and-admit over implement-every-mechanical-rule. That choice is a confirmed sprint scope, not an open product question.
- The 63 ids already listed are the complete T2 Issue 9 writing-rule inventory for this product. Completeness CI locks that set. It does not scrape Issue 9 pages into Git.
- Live Forgejo is the feature baseline. GitHub `HHPE-HRG/T2-SQUARED` `main` is stale and must not be treated as DoD evidence.
- Where Forgejo already compiles `work` / `pull` / `event`, U3 is prove-and-ratchet, not a greenfield rewrite. Where the working tree is GitHub-stale (terms-only `CompiledSchema`), U3 implements the Forgejo identity compile locally.
- Fill-sandbox chassis rows that still say `pending-human` / protections not activated are stale relative to Forgejo. This plan does not re-qualify host protections.
- The work-registry plan file may be absent from Git. First-slice requirements in R13–R18 are the executable contract.

## Planning Contract

### Key Technical Decisions

- KTD1. **Generative DoD means freeze, not expand.** Classification, identity compile, and chassis ratchets are in. New live G2 checkers, new extractors, CAN, and git publishing are out.
- KTD2. **Live G2 and classification overlay stay separate files.** Overlay/completeness live in mapping records. Live scan continues to load `records.json` (five mechanical ids) plus `t2.asd-ste100.rules.json`. Do not dump 57 uncheckable rows into live `records.json`. That would emit 57 admission findings on every corpus run and brick merge.
- KTD3. **Fail-closed is a promotion invariant, not a per-sentence overlay scan.** Admission already runs on live mapping rows in `scripts/asd-ste100/cli.ts`. Completeness CI fails if an applicable uncheckable id is listed as a passing live G2 rule. A fixture proves the admission path if such a row is inserted.
- KTD4. **Reuse `official-unreviewed.json` plus `enforcement-classes.json` as the ledger.** Do not invent a third bank. Set `reviewed: true` with distinct principals. Either promote `official-unreviewed.json` to a reviewed name in place, or add a completeness reader that treats those 63 rows as the inventory. `coverage-ledger.json` page waves stay out of the writing-rule completeness predicate.
- KTD5. **Do not copy Issue 9 rule text.** Ledger rows keep id, class, source page numbers, proposed checker id, and review metadata only.
- KTD6. **Work-registry identity stays grep-from-proposal.** No LLM. Missing pull is a hard compile error. Genesis review id must match compiled pull when `forgejoApproved` is true.
- KTD7. **Authoritative proof is local `npm run ci:*`.** Forgejo trusted jobs remain the host authority after a later publish. GitHub Actions stay non-authoritative.
- KTD8. **This plan's Definition of Done is local feature completeness.** Publishing git is a later operator step, not a hidden unit.

### High-Level Technical Design

```text
Issue 9 writing-rule inventory (63 ids, no official text in Git)
        │
        ▼
reviewed classification ledger  ── completeness CI (R1–R3, R6)
        │
        ├── deterministic / parser-mechanical ── live G2 (5 ids) ── checkers
        ├── contextual/semantic, human-review ── overlay only
        └── not-applicable-to-surface         ── overlay only

live records.json ── if fail_closed_uncheckable ── admission.ts fail closed
                  ── else scan governed surfaces with live checkers

proposal.md ── identity grep ── CompiledSchema { terms, work, pull, event }
                            └── drift CI + named AE1–AE5
```

### Implementation Constraints

- Preserve `npm run ci:asd-ste100` → `node scripts/asd-ste100/cli.ts`.
- Preserve `npm run ci:work-registry` and `npm run test:work-registry` if present.
- STE on owned docs and proposals. Identity sentences stay backticked `is`.
- Tests first for any new public completeness symbol.
- No `print(` outside tests. Use existing logging rules of the T2 tree.
- Do not remount live vocab via `provision-vocab` (that forces `pending-human`).

### Sequencing

U1 classification ledger → U2 live-G2/admission contract → U3 work-registry identity → U4 term and surface ratchets.

U2 depends on U1 so completeness knows the frozen class of each id. U3 is independent of U1/U2 and may proceed in parallel. U4 is independent ratchet work and may proceed in parallel with U3.

### Risks

- Treating GitHub `main` as live will re-open identity compile as if Forgejo PR 6/7 never happened. Mitigate by compiling against the actual working tree and recording which baseline was used in the test names.
- Marking 57 uncheckable ids reviewed without a completeness test leaves DoD ethereal again. Mitigate with AE1.
- Putting overlay rows into live `records.json` bricks CI. Mitigate with KTD2 and AE2.

### Sources and Research

- Parent DoD: `docs/plans/2026-08-13-001-feat-asd-ste100-enforcement-plan.md` Global and U1–U7.
- Fill-sandbox remaining problems P1–P4: `docs/plans/2026-08-17-001-feat-fill-asd-ste-sandbox-plan.md`.
- Live mapping: `scripts/asd-ste100/mapping/records/official-unreviewed.json` (63 rows, `reviewed: false`), `records.json` (5 deterministic), `enforcement-classes.json` (63 overlay classes), `coverage-ledger.json` (430 page waves).
- Admission already imported by `scripts/asd-ste100/cli.ts` and applied to live `fail_closed_uncheckable` rows.
- Live rules: `t2.asd-ste100.rules.json` ids `1.1`, `4.5`, `5.1`, `6.3`, `6.6`.
- Terms: `t2.asd-ste100.terms.json` already has `concept`, `canonical`, `subjectFields`, `asdBasis`.
- GitHub `scripts/work-registry/registry.ts` `CompiledSchema` is still `{ product, campaign, terms }`. Forgejo identity compile is the intended baseline for U3.

## Implementation Units

### U1. Freeze the 63-id writing-rule classification ledger

**Goal:** Classification is complete, reviewed, and enforced. It is no longer an unreviewed overlay.

**Requirements:** R1, R2, R3, R6, R7, R8

**Files:**

- `scripts/asd-ste100/mapping/records/official-unreviewed.json`
- `scripts/asd-ste100/mapping/records/enforcement-classes.json`
- `scripts/asd-ste100/mapping/enforcement-class.ts`
- `scripts/asd-ste100/mapping/enforcement-class.test.ts`
- `scripts/asd-ste100/mapping/honesty.test.ts` or a new `scripts/asd-ste100/mapping/completeness.test.ts`

**Approach:** Treat the existing 63 ids as the closed inventory. Align overlay class and mapping class so each id has one fill-sandbox R7 class. Set reviewed metadata using principals already present in `principals.json`, following R3. Add a completeness predicate used by `npm run ci:asd-ste100`. Do not write official rule text. Do not change live `records.json` in this unit.

**Test scenarios:**

- Completeness passes when all 63 ids are present, unique, classed, and reviewed.
- Completeness fails when one inventory id is removed.
- Completeness fails when an id has two classes or an unknown class.
- Completeness fails when `reviewed` is false.
- Leak scan still fails if a fixture tries to commit official dictionary words or page images.
- Live `records.json` still contains only the five mechanical ids after this unit.

**Verification:** `npm run ci:asd-ste100`

**Dependencies:** none

### U2. Freeze live G2 versus overlay admission

**Goal:** Uncheckable applicable rules cannot silently pass. They also cannot brick CI by entering live G2.

**Requirements:** R4, R5, R9, R10

**Files:**

- `scripts/asd-ste100/cli.ts`
- `scripts/asd-ste100/admission.ts`
- `scripts/asd-ste100/admission.test.ts`
- `scripts/asd-ste100/admission-boundaries.test.ts`
- `t2.asd-ste100.rules.json`
- `scripts/asd-ste100/mapping/records/records.json`

**Approach:** Keep live G2 at the five mechanical ids. Add a promotion invariant: every live rule id is classed `deterministic` or `parser-mechanical` in the U1 ledger, and every live rule has a registered checker. Keep `admitFailClosedUncheckable` on live mapping rows. Add a fixture-only live mapping where one overlay uncheckable id is inserted and the public command fails with `T2-ADMISSION-uncheckable`. Assert `not-applicable-to-surface` overlay ids produce no admission finding.

**Test scenarios:**

- Default tree: five live ids, zero admission findings from overlay-only uncheckable ids.
- Fixture inserts `1.2` as live `fail_closed_uncheckable` without override: command fails with `T2-ADMISSION-uncheckable`.
- Same fixture with a valid different-principal override: admission passes.
- Live rule with no checker: command fails as unregistered checker.
- Overlay `not-applicable-to-surface` id is absent from live `records.json` and produces no finding.

**Verification:** `npm run ci:asd-ste100`

**Dependencies:** U1

### U3. Freeze work-registry identity compile

**Goal:** Compile always writes `work`, `pull`, and `event`. Terms-only schema is not done.

**Requirements:** R13, R14, R15, R16, R17, R18, R9

**Files:**

- `scripts/work-registry/registry.ts`
- `scripts/work-registry/work-registry.test.ts`
- `scripts/work-registry/cli.ts`
- `T2_Squared-Work-Registry/asd-ste100-compliance/proposal.md`
- `T2_Squared-Work-Registry/asd-ste100-compliance/schema.json`
- `T2_Squared-Work-Registry/registry-yaml-write/proposal.md`
- `T2_Squared-Work-Registry/registry-yaml-write/schema.json`

**Approach:** If `CompiledSchema` already includes `work` / `pull` / `event`, add or keep the work-registry contract's named AE1–AE5 tests and a drift failure for terms-only schema. If the working tree is GitHub-stale, implement identity grep and schema fields to match the Forgejo contract: progeny and Forgejo-review sentences, missing-pull error, genesis review id bound to compiled pull when Forgejo-approved. Reland identity into the two live campaign trees named above. Do not add CAN ingest. Do not author a multi-event chain. Synthetic 1:1 event from work+pull is enough for first slice.

**Test scenarios:**

- Work-registry AE1: compile writes work, pull, and event from a proposal that contains both identity sentences.
- Work-registry AE2: missing Forgejo-review sentence fails with `the pull is missing.`
- Work-registry AE3: Forgejo-approved genesis `forgejoReviewId` must equal compiled pull id.
- Work-registry AE4: drift fails when schema terms exist but work/pull/event are absent.
- Work-registry AE5: a second principal is not required for compile; human/Forgejo approval flags stay explicit on the campaign manifest.
- Compiler does not call a model and does not read CAN.

**Verification:** `npm run ci:work-registry` and `npm run test:work-registry`

**Dependencies:** none

### U4. Ratchet T2 terms and current governed surfaces

**Goal:** P3 term fields and current extractors are required, not optional leftovers.

**Requirements:** R11, R12, R8, R10

**Files:**

- `t2.asd-ste100.terms.json`
- `scripts/asd-ste100/work-registry-terms.test.ts`
- `scripts/asd-ste100/extract.ts`
- `scripts/asd-ste100/extract.test.ts`
- `scripts/asd-ste100/membership.ts`
- `scripts/asd-ste100/membership.test.ts`

**Approach:** Add failing tests that a promoted term without `concept`, canonical flag, `subjectFields`, `asdBasis`, or software forms is rejected. Confirm extractors still cover Markdown, TypeScript strings/comments/docblocks, and JSON/YAML descriptive values. Do not add identifier-as-prose extraction. Do not add a second term bank.

**Test scenarios:**

- Promoted term missing `concept` fails CI.
- Promoted term missing software forms fails CI.
- Markdown prose still extracts and is governed.
- TypeScript comment/string still extracts and is governed.
- JSON/YAML descriptive value still extracts and is governed.
- Identifier tokens are not treated as ASD prose in this sprint.

**Verification:** `npm run ci:asd-ste100`

**Dependencies:** none

## Verification Contract

Local commands are the acceptance evidence for this plan.

| Proof | Command | Units |
| --- | --- | --- |
| ASD freeze | `npm run ci:asd-ste100` | U1, U2, U4 |
| ASD unit tests | `npm run test:asd-ste100` | U1, U2, U4 |
| Registry freeze | `npm run ci:work-registry` | U3 |
| Registry unit tests | `npm run test:work-registry` | U3 |

Do not use GitHub Actions results as acceptance evidence.

Do not require Forgejo trusted-pr, tag promotion, or a live review as part of this plan's Definition of Done.

Scope tests to the files these units change. Do not run host reboot, soak, or unrelated production-machine lanes.

## Definition of Done

### Global

- Every requirement R1–R18 has a passing test or an explicit out-of-scope line in this file.
- Live G2 remains exactly the five mechanical Issue 9 ids.
- The 63-id writing-rule ledger is reviewed and completeness-checked.
- Uncheckable applicable ids cannot silently pass if promoted into live mapping.
- Compile writes `work`, `pull`, and `event`. Terms-only schema fails drift.
- The work-registry contract's named AE1–AE5 tests exist and pass on the working tree.
- No official Issue 9 lemmas, definitions, examples, or images enter Git.
- CAN is not started.
- Parent plan body is unchanged.
- Abandoned completeness experiments are absent from the working tree.
- Local `npm run ci:asd-ste100` and `npm run ci:work-registry` pass.
- Git publish is not required.

### Per unit

- U1 is done when completeness CI locks the reviewed 63-id ledger and live `records.json` still has only five ids.
- U2 is done when default scans mint no overlay admission findings and the inserted uncheckable live-row fixture fails closed.
- U3 is done when compile writes work/pull/event, missing pull fails, and named AE1–AE5 pass.
- U4 is done when promoted terms cannot drop required fields and current extractors remain governed.

### Already met — do not rebuild

These parent and child items are chassis, not remaining generative work:

- Public command `npm run ci:asd-ste100` and Forgejo trusted job wiring.
- Private vocabulary mount and Issue 9-derived pin (do not remount via `provision-vocab`).
- Ownership, diagnostics, attestations, targeted overrides, claim checks.
- Mechanical checkers for `1.1`, `4.5`, `5.1`, `6.3`, `6.6`.
- T2 terms concept/canonical/software-form fields already present (U4 only ratchets them).
- Work-registry identity compile on Forgejo after PRs 6 and 7 (U3 only implements if the working tree lacks it).

## Appendix

### Requirements completeness review (no local git diff)

No T2 checkout with a reviewable branch was mounted on this Mac. This is a requirements-completeness review of GitHub `main` plus prior Forgejo evidence, not a PR review.

| Claim | Evidence | Verdict |
| --- | --- | --- |
| Parent U1–U5 generative chassis | `scripts/asd-ste100/*`, profile bundle, admission, extractors | Met as chassis. Do not rebuild. |
| Parent U6 host protections / live G5 | Forgejo evidence from 2026-08-20; fill-sandbox chassis table still stale | Ops. Out of this plan. |
| Fill-sandbox P1 classification complete | 63 ids exist; all `reviewed: false`; live records only 5 ids | Gap. U1+U2. |
| Fill-sandbox P2 vocabulary bridge | Live pin and lexicon export exist; do not remount | Met as chassis. Out. |
| Fill-sandbox P3 term schema | `t2.asd-ste100.terms.json` already has concept/canonical/software forms | Mostly met. U4 ratchet only. |
| Fill-sandbox P4 all surfaces | Extractors already cover MD/TS/JSON descriptive; identifiers deferred | Freeze current. No expansion. |
| Work-registry first slice on GitHub | `CompiledSchema` terms-only | Gap on GitHub-stale trees. U3. |
| Work-registry first slice on Forgejo | Identity compile and live campaigns bound to review `7` | Met on Forgejo. Prove, do not rewrite, if that tree is the checkout. |

### What "done" is not

Done is not "every Issue 9 writing rule has a live checker."
Done is not "GitHub `main` matches Forgejo."
Done is not a language-authority certificate.
Done is not CAN.
Done is not a merged PR.

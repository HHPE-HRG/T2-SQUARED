# G9 design-approved changelog

<!-- Agent: design approved 2026-09-30. Planning authorized. No G9 runtime in this regen. -->

- Status `design-approved`. writing_plans_authorized=true. implementation_authorized=true (RFC-022: derived from validated authorization.md body).
- authorization.md present and valid; regen emits implementation_authorized=true.
- INV-T2-ORCH-QUEUE / queue-offered ledger equality_type is G9OrchQueueEqualityA (one public name).
- Previous counted fixture vectors: 763. Current: 763.
- Ledger counts: phases=184, retain_true=17, momentary=167, counted_fixture_vectors=763.
- Validation: shape-valid=True, source_checked_subset=True, source_exact=True, sole_blocker_claim=False, unresolved=[], design_approved=True, implementation_authorized=True.

## Retained notes

- Wave-5: FILE-LOGS `A.member_id` is aggregate member identity (`logsDir`, …); disposition remains `state_label` only. Dormant/absence machine fields unchanged.
- FILE-LOGS equality projection is `member_id` (request-side).

## Phase list changes this regen

- No phase-id changes.

## Historical freeze-candidate regeneration

## Historical equality-type string (`INV-T2-ORCH-QUEUE` / `queue-offered`)

- Retired ledger `equality_type` `G9OrchCommandOfferA`. Public name is `G9OrchQueueEqualityA` (same A: `command_type` `client` | `internal`).

# G9 design-freeze-candidate changelog

<!-- Agent: WP0 steward application. Counts copied from coverage-ledger.json. No implementation. -->

- Status `design-freeze-candidate`. Did not invoke `writing-plans`. No G9 runtime.
- Applied steward preferred amendments for `INV-T2-PROJECT-QUEUE` and `INV-T2-FLAG-TERM-ENV`.
- Previous counted fixture vectors: 790. Current: 790.
- Ledger counts: phases=184, retain_true=17, momentary=167, counted_fixture_vectors=790.
- Validation: shape-valid=True, source_checked_subset=True, source_exact=True, sole_blocker_claim=False, unresolved=[].

## Phase list changes

- No phase-id changes.

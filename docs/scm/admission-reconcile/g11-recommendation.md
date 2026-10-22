# Recommendation

<!-- Agent: Ownership recommendation. Does not mint a numbered G11. Does not
set admissionReconcileAuthorized. A dirty checkout does not authorize a gate. -->

- Date: 2026-10-21
- Campaign: admission-reconcile
- Status: **DRAFT**

Do not mint a numbered G11. The G10 auth freeze still forbids that number.
This charter stays a named draft. `admissionReconcileAuthorized` stays false
until a human `authorization.md` lands in the same changeset as the flag.

## Assign to SCM

- Routing of an admitted capability to the preview invoke boundary
- Admission state: proposed, admitted, suspended, revoked
- The mediation interface: `authorizeInvocation` in protected mode
- This gate's correlation records: the process-local decision and outcome

## Leave where they already are

| Concern             | Owner already in this tree                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campaign provenance | Work Registry under `scripts/work-registry`. The server does not import it. A grant may name a scope id and does not query the registry                                                       |
| Tool registry       | Capability catalog in `apps/server/src/scm/admissionCatalog.ts`                                                                                                                               |
| Skill catalog       | `discoverSkillEntries`. A `SKILL.md` is C1. A bundled script is a separate C3 row                                                                                                             |
| Node identity       | No node registry. G1B `comm_id`s stay seam ids. Node fields on a grant are caller-supplied                                                                                                    |
| 21-term lexicon     | ASD-STE100 governs Forgejo prose. It does not make this dispatch decision. Machine identifiers keep `judgeMachineIdentifier` and the existing `canBus` rejection. Opaque payloads stay exempt |
| Codec frames        | Codec campaign                                                                                                                                                                                |
| Equality IR         | Equality-IR campaign                                                                                                                                                                          |
| OpenTelemetry       | N08. Correlation, not this ledger                                                                                                                                                             |

G9, G10, and Fabric-depth stay as they are. This recommendation does not
redesign them. It does not claim authority equivalence.

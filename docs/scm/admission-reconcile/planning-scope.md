# Admission reconcile planning scope

<!-- Agent: in / out / unlock / false friends. DRAFT. Not unlock. Not G11. -->

- Date: 2026-10-21
- Campaign: admission-reconcile
- Contracts: `docs/scm/admission-reconcile/contracts.md`

## In scope

- Capability records and admission states `proposed`, `admitted`, `suspended`, `revoked`
- Snapshot compare that yields a pending delta instead of a broader grant
- Fail-closed dispatch for unknown ids, pending drift, suspension, revocation, and removal
- Four coverage classes from the review's section 5.4
- Read-only discovery of preview MCP tool names, host `.mcp.json` servers, skill files versus bundled scripts, and provider-native tool names
- Env `T2CODE_SCM_ADMISSION_RECONCILE` on the in-repo preview invoke path only
- Named compatibility mode and protected mode
- A grant bound to one admitted record, one catalog revision, and the canonical digest
- An explicit edge list, a policy hook, and a nested-child deny
- Process-local decision and outcome records
- A closed verdict for the ten execution classes

## Out of scope

| Item                                                                                                                                | Why                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Numbered G11 / `g11Authorized`                                                                                                      | Forbidden by the G10 auth freeze                                       |
| Home-bus activation / eleventh bus / radius resize                                                                                  | `home_bus_id` stays `unknown`. Radius stays 73 activatable + 1 dormant |
| Overload `g9toG10Authorized`, `fabricDepthAuthorized`, `equalityIrAuthorized`, `codecAuthorized`, `n08Authorized`, `appaAuthorized` | Separate campaigns                                                     |
| Rebuild work-registry `checkDrift`, Equality-IR fixture drift, or codec fixture drift                                               | Those compare different objects                                        |
| OpenAPPA composition or a second permit algebra                                                                                     | Not this charter                                                       |
| OS sandbox, egress ACL, SPIFFE, NATS                                                                                                | Not this charter                                                       |
| Treat provider-native tools as admitted                                                                                             | No proven pre-tool interceptor. Classify outside guarantees            |
| In-process wrappers around `canUseTool`, spawn, Git, or SQLite                                                                      | Those need a real interceptor or an OS boundary                        |
| Lexicon-check search text, code, or quoted rows                                                                                     | Opaque payloads are exempt                                             |

## Unlock

- Ceremony would add durable `authorization.md` and set `admissionReconcileAuthorized: true` in one changeset
- This draft does not authorize that flip
- `completed` stays false

## False friends

- Preview credential `"preview"` is a session check, not a per-tool grant
- G9 occurrences, G10 Ordered GREEN, inventoriable-live GREEN, codec C8, Equality-IR EQ8
- N08 `n08.client.receipt`
- AgentAPPA privilege raise or one-shot authority
- `canBus` as an SCM capability alias

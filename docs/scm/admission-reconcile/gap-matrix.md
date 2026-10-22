# Gap matrix

<!-- Agent: Review request against this tree. Not a claim that the gap is
closed. Not G11. admissionReconcileAuthorized stays false. -->

- Date: 2026-10-21
- Campaign: admission-reconcile
- Status: **DRAFT**

| Review request                                         | This tree                                                                                      | Verdict                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Catalog drift must not widen a grant                   | `compareCatalog` plus grant digest and revision                                                | Present for preview in protected mode                                                       |
| Fail closed when admission is missing                  | Missing snapshot and missing grant deny                                                        | Present in protected mode                                                                   |
| Legacy path stays available and is named               | Unset env is compatibility mode                                                                | Present. Not called authority                                                               |
| Grant bound to principal, adapter, edge, expiry, scope | `issueGrant` and `authorizeInvocation`                                                         | Present for a caller that uses the preview path                                             |
| Policy hook without information-flow labels            | Hook returns allow, deny, or unavailable                                                       | Present. OpenAPPA is not this hook                                                          |
| Nested child is not implied by the parent              | `nested-privilege`                                                                             | Present when `authorizeInvocation` is called                                                |
| Decision and distinct outcomes                         | Process-local decision and outcome records                                                     | Present. Not durable. Not the legal ledger                                                  |
| Every execution route mediated                         | Ten-class account                                                                              | Only preview MCP invoke is mediated, and only in protected mode                             |
| Provider `canUseTool`, spawn, Git, SQLite              | No interceptor in those modules                                                                | Unsupported in protected mode. Compatibility leaves them unmediated                         |
| Work Registry as the tool registry                     | Server does not import it                                                                      | Logical split: registry is campaign provenance; the capability catalog is the tool registry |
| Skill file is an executable node                       | `discoverSkillEntries`                                                                         | `SKILL.md` is C1. A bundled script is a separate C3 row. Neither is executed by this gate   |
| Node registry                                          | None                                                                                           | G1B `comm_id`s stay seam ids. Grant node fields are caller-supplied                         |
| Home bus and numbered G11                              | `home_bus_id` is `unknown`. Charter flag is false                                              | Not created                                                                                 |
| Authority equivalence                                  | Identity, topology, authorization, execution, and causal evidence are not jointly demonstrated | Not claimed                                                                                 |

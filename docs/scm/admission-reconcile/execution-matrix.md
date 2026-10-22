# Execution matrix

<!-- Agent: Closed account of ten execution classes. Not mediation of the
nine unsupported classes. Not authority equivalence. -->

- Date: 2026-10-21
- Campaign: admission-reconcile
- Status: **DRAFT**
- Source: `executionClassAccount` in `apps/server/src/scm/admissionGrant.ts`

Compatibility mode marks every class `compatibility-unmediated`. Protected
mode marks preview MCP tool invoke `mediated` and the other nine
`unsupported-prohibited`.

| Class                             | Entry point found in this tree                                                                                        | Compatibility            | Protected                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------- |
| Local functions and scripts       | `ChildProcessSpawner`. Skill scripts are C3 rows from `discoverSkillEntries` and are not spawned here                 | compatibility-unmediated | unsupported-prohibited           |
| MCP servers and tools             | `invokePreviewOperation` in `apps/server/src/mcp/toolkits/preview/handlers.ts`. Host `.mcp.json` is not this boundary | compatibility-unmediated | mediated for preview invoke only |
| Direct SDK and API                | sourceControl GitHub and GitLab clients                                                                               | compatibility-unmediated | unsupported-prohibited           |
| Database reads and mutations      | SQLite server state under the T3 home directory                                                                       | compatibility-unmediated | unsupported-prohibited           |
| Filesystem and Git                | VcsDriver and Git checkpoint. G10 seam selection is not this gate                                                     | compatibility-unmediated | unsupported-prohibited           |
| Browser and web search            | `provider.web_search` from `discoverProviderNative`. Preview navigate is the MCP row                                  | compatibility-unmediated | unsupported-prohibited           |
| Harness-native tools              | ClaudeAdapter `canUseTool` and `bypassPermissions`. This gate does not wrap them                                      | compatibility-unmediated | unsupported-prohibited           |
| Compound and nested operations    | `nested-privilege` inside `authorizeInvocation`. No child-process interceptor is installed                            | compatibility-unmediated | unsupported-prohibited           |
| Scheduled or background execution | No scheduler principal in this tree is bound to a grant                                                               | compatibility-unmediated | unsupported-prohibited           |
| Opaque third-party execution      | C9, C12, and B4 through `isOutsideGranularGuarantees`                                                                 | compatibility-unmediated | unsupported-prohibited           |

`provider.web_search` denies as `unsupported-prohibited` when protected invoke
is asked to authorize it, including a forged `admitted` row.

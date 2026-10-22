# Deferred

<!-- Agent: Work this changeset does not implement. Do not treat a named
dependency as a finished control. -->

- Date: 2026-10-21
- Campaign: admission-reconcile
- Status: **DRAFT**

These need a real interceptor, an OS boundary, or a later charter. An
in-process check in front of them would not be the control.

| Item                  | Why it is deferred                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider interception | Claude `canUseTool` is user approval. Full access uses `bypassPermissions`. This gate does not wrap that path                                         |
| Process isolation     | `ChildProcessSpawner`, skill scripts, and opaque third-party execution are not confined by this process                                               |
| Durable receipts      | Decision and outcome records are process-local. They are not G9 occurrences, N08 spans, or the legal ledger. `completed` still requires an effect ref |
| Home-bus edges        | The edge list is caller-supplied and defaults to empty. `home_bus_id` stays `unknown`. `HOME_BUS_ACTIVATED` stays false                               |
| OpenAPPA              | The policy hook does not evaluate information-flow labels. AgentAPPA remains a separate draft and is not composed here                                |

Also deferred: a node registry, a server import of the Work Registry, and any
claim that the nine unsupported execution classes are mediated.

# Current state

<!-- Agent: Evidence of what this process mediates after the authority-boundary
account. Not GREEN. Not unlock. admissionReconcileAuthorized stays false.
Does not claim authority equivalence. -->

- Date: 2026-10-21
- Campaign: admission-reconcile
- Status: **DRAFT**
- Baseline: catalog drift reconcile, plus this grant account
- Charter flag: `admissionReconcileAuthorized: false`

## What runs

Compatibility mode is the unset env. Preview invoke still checks the session
credential `"preview"` and then calls `broker.invoke`. It does not read the
snapshot. That mode is named compatibility. It is not authority.

Protected mode is `1`, `true`, `yes`, or `protected`. After the session check
and before `broker.invoke`, preview calls `authorizeInvocation`. That function
calls `decideDispatch`, then checks the grant.

A grant is issued for one admitted record and one catalog revision. It stores
the canonical catalog digest. Dispatch recomputes the digest. A later catalog
edit or a later revision denies as `stale-grant`.

The authority slot holds an edge list. The list defaults to empty. A requested
edge that is not listed denies. `home_bus_id` stays `unknown`.
`HOME_BUS_ACTIVATED` stays false. The G10 radius stays 73 activatable and 1
dormant.

The policy hook returns `allow`, `deny`, or `unavailable`. A missing or
unavailable hook denies in protected mode. The hook does not evaluate
information-flow labels.

C9, C12, and B4 deny as `unsupported-prohibited`, including a forged
`admitted` row. A parent grant does not cover a different child capability id.

Allow and deny write a process-local decision. An outcome may share
`correlation_id`. `completed` requires an effect ref supplied by the caller.
`failed` and `uncertain` stay distinct. Preview protected invoke writes the
decision and does not write `completed`, because the broker result is not an
effect ref. These records are not G9 occurrences, N08 spans, or the legal
ledger.

## What does not run

The server does not import `scripts/work-registry`. A grant may name a scope
id. It does not query the registry.

No wrapper was added around Claude `canUseTool`, `ChildProcessSpawner`, Git,
or SQLite. Host `.mcp.json` is discovery only. G9 occurrences and G10 seam
selection are not this decision. OpenAPPA is not implemented.

Only preview MCP tool invoke is mediated, and only in protected mode.

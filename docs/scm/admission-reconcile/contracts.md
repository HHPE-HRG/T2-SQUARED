# Admission reconcile contracts

<!-- Agent: Draft contract for catalog drift. Not GREEN. Not unlock.
Does not flip admissionReconcileAuthorized. -->

- Date: 2026-10-21
- Status: **DRAFT**
- Campaign: admission-reconcile
- Env: `T2CODE_SCM_ADMISSION_RECONCILE` (unset = compatibility mode; `1`, `true`, `yes`, `protected` = protected mode)

## 1. Capability record

Fields the drift compare uses:

- `capability_id`, `node_id`, `node_type`, `operation`, `bus_type`
- `home_bus_id` — only `unknown` (home bus stays dormant)
- `class_id` — C1 through C12
- `effect_classes` — one or more of E0 through E6
- `boundary` — B0 through B4
- `adapter_type`, `implementation_digest`, `input_schema`, `output_schema`
- `allowed_destinations`
- `admission_state` — `proposed`, `admitted`, `suspended`, `revoked`
- `nomenclature_version` — `admission-reconcile.machine-id.v1`
- `work_scope_ref` — campaign scope id, or null. A grant may name it. Dispatch does not query the Work Registry
- `work_scope_required` — when true, the grant and the invoke must carry that same scope id

A discovered tool starts `proposed`. Only an explicit admit moves it to `admitted`.
C9, C12, and B4 records are outside granular guarantees and cannot be admitted.

## 2. Drift delta

Compare an admitted snapshot to a newly verified catalog.

| Change                                     | Delta       | Next state | Dispatch                       |
| ------------------------------------------ | ----------- | ---------- | ------------------------------ |
| Same schema, digest, effects, destinations | unchanged   | keep       | allow when state is `admitted` |
| New capability id                          | new         | `proposed` | deny                           |
| `input_schema` or `output_schema`          | schema      | `proposed` | deny pending-drift             |
| `implementation_digest`                    | digest      | `proposed` | deny pending-drift             |
| class, effect, or boundary                 | effect      | `proposed` | deny pending-drift             |
| destinations                               | destination | `proposed` | deny pending-drift             |
| Admitted id missing from the new catalog   | removed     | `revoked`  | deny                           |
| Explicit revoke                            | revoked     | `revoked`  | deny                           |

No path copies a drifted catalog into `admitted`.

## 3. Machine identifiers

`capability_id`, `node_type`, `operation`, and `bus_type` are machine identifiers.
Unknown values fail admission and dispatch. `canBus`, `can-bus`, and `CAN_BUS` are not SCM capability aliases.

Quoted text and any value that contains whitespace is an opaque payload. It is not rejected for lexicon membership.

`bus_type` and `home_bus_id` accept only `unknown`.

## 4. Coverage classes

The join emits only these classes:

- `declared-but-unreachable` — admitted id with no G10 `comm_id` and no discovered invocable tool
- `executable-but-unregistered` — G10 `comm_id` or provider-native tool with no admitted record
- `executed-without-policy-record` — observed tool activity whose id is not admitted
- `policy-approved-but-unconfirmed` — admitted id with an activity and no effect receipt

G9 occurrences and orchestration tool activities are inputs to the last two classes. They are not the legal evidence ledger. N08 spans are not receipts.

## 5. Modes

Unset, blank, `0`, and `compatibility` are **compatibility** mode. Preview invoke does not read the snapshot or a grant. Compatibility mode is not authority.

`1`, `true`, `yes`, and `protected` are **protected** mode. In protected mode a missing snapshot, missing grant, stale catalog revision, expired grant, unauthorized edge, adapter mismatch, nested child, or unavailable policy hook denies before `broker.invoke`. The gate does not fail open.

## 6. Grant

A grant is issued against one admitted record and one catalog revision. It carries principal id, source node, target node, capability id, adapter type, effect classes, work-scope ref when the record requires one, expiry, and the canonical catalog digest.

Dispatch recomputes that digest. A catalog edit after issue denies as `stale-grant`. A later revision number denies as `stale-grant` even when the digest still matches.

Edges are an explicit list on the authority slot. The list defaults to empty. A requested edge that is not on the list denies as `unauthorized-edge`. This list does not create a home bus. `home_bus_id` stays `unknown`.

The policy hook returns `allow`, `deny`, or `unavailable`. Protected mode denies when the hook is missing or unavailable. The hook does not evaluate information-flow labels.

C9, C12, and B4 stay outside granular guarantees. Protected invoke denies them as `unsupported-prohibited` even if a caller forged `admitted`. A parent grant does not satisfy a different child capability id.

Allow and deny write a decision record. A later outcome record shares `correlation_id`. `completed` is stored only when the caller supplies an effect ref. `failed` and `uncertain` stay distinct. These records are process-local. They are not G9 occurrences, N08 spans, or the legal ledger.

## 7. Preview invoke

The session check `requireMcpCapability("preview")` stays. It does not admit a tool.

Compatibility mode leaves preview invoke unchanged. Protected mode runs `authorizeInvocation` after that session check and before `broker.invoke`. The preview path writes a decision. It does not write a `completed` outcome, because the broker result is not an effect ref.

## 8. Execution classes

The closed account has ten classes. Only preview MCP tool invoke is `mediated`, and only in protected mode. The other nine are `unsupported-prohibited` in protected mode and `compatibility-unmediated` in compatibility mode. No in-process wrapper is added around Claude `canUseTool`, process spawn, Git, or SQLite.

| Class               | Entry point in this tree                                 | Protected verdict      |
| ------------------- | -------------------------------------------------------- | ---------------------- |
| Local function      | `ChildProcessSpawner`; skill scripts stay discovery rows | unsupported-prohibited |
| MCP preview         | `invokePreviewOperation`                                 | mediated               |
| SDK or API          | sourceControl GitHub and GitLab clients                  | unsupported-prohibited |
| Database            | SQLite server state                                      | unsupported-prohibited |
| Filesystem and Git  | VcsDriver and Git checkpoint                             | unsupported-prohibited |
| Browser and web     | `provider.web_search`; preview navigate is the MCP row   | unsupported-prohibited |
| Harness-native      | Claude `canUseTool` and `bypassPermissions`              | unsupported-prohibited |
| Compound and nested | parent grant does not cover a different child id         | unsupported-prohibited |
| Scheduled           | no scheduler principal is bound to a grant               | unsupported-prohibited |
| Opaque third party  | C9, C12, and B4                                          | unsupported-prohibited |

Host `.mcp.json` is not the mediated MCP boundary. G10 seam selection is not this gate.

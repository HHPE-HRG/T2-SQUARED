# Admission reconcile contracts

<!-- Agent: Draft contract for catalog drift. Not GREEN. Not unlock.
Does not flip admissionReconcileAuthorized. -->

- Date: 2026-10-21
- Status: **DRAFT**
- Campaign: admission-reconcile
- Env: `T2CODE_SCM_ADMISSION_RECONCILE` (unset = gate not installed; set = preview invoke fail-closes)

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

## 5. Preview invoke

The session check `requireMcpCapability("preview")` stays. It does not admit a tool.

When the env is unset, preview invoke is unchanged. When the env is set, dispatch runs after that session check and before `broker.invoke`. A missing snapshot or a missing capability id denies. The gate does not fail open.

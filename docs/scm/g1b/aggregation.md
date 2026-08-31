# G1B aggregation rule

Rule id: `shared-d15c-identity`

A D15C row may aggregate multiple live paths only when every member is a
structured identity tuple sharing all of:

- `sender`
- `receiver`
- `authority_class`
- `equality_object`
- `home_or_authority`
- `transport_family` (must equal the row’s `transport_boundary`)

and the row’s `owner`. If any of those fields would differ, the path must
be its own `comm_id`.

Rows that aggregate must set:

- `aggregation_rule`: `shared-d15c-identity`
- `aggregated_members`: at least two unique tuples, each with `id` and `sourceSymbol`

The checker compares every member tuple to the aggregate row. Changing a
member’s sender or authority fails completeness.

## Applied in this package

| Row                         | Why aggregation is allowed                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `INV-T2-FILE-RUNTIME-STATE` | Local identity/runtime state files with the same writer/reader family, A2, and local-file transport. |
| `INV-T2-FILE-LOGS`          | Local log files with the same logger/reader family, observer class, and local-file transport.        |

## Split because identity differs

| Former grouping         | Split into                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INV-T2-HTTP-ENV`       | `INV-T2-HTTP-META`, `INV-T2-HTTP-AUTH`, `INV-T2-HTTP-ORCH`, `INV-T2-HTTP-PR`, `INV-T2-HTTP-CONNECT`                                                              |
| `INV-T2-TEL-DESKTOP-FD` | `INV-T2-TEL-DESKTOP-IN`, `INV-T2-TEL-DESKTOP-CONTROL`, native monitor protocol on `INV-T2-RES-MONITOR`                                                           |
| `INV-T2-RPC-STREAM`     | `INV-T2-RPC-STREAM-TERM`, `INV-T2-RPC-STREAM-ORCH`, `INV-T2-RPC-STREAM-TEL`, `INV-T2-RPC-STREAM-AUTH`, `INV-T2-RPC-STREAM-CONFIG`, `INV-T2-RPC-STREAM-DISCOVERY` |

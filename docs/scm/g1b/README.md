# G1B inventory package

Status: **G1 closed by independent Codex A7 review**.

G1A A7 (Codex, round 2) authorized this slice. Final narrow G1-exit review approved the corrected package. This package does **not**:

- claim that every conceivable live communication has a row
- authorize G3 (`g3Authorized: false`)
- authorize G4–G7 (`g4toG7Authorized: false`)
- unblock G8–G10
- treat Codex review as human-operator attestation

If governance requires a human A7, the human operator must still attest separately.

G1 closure is recorded as the legal tuple `approved` / `g1-closed` / `true`. Approval of G1 exit does not flip G3 or G4–G7 authorization in this artifact.

## Files

| File             | Role                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------- |
| `manifest.json`  | G1B status, A7 review state, per-gate authorization flags                              |
| `inventory.json` | Completed D15C rows                                                                    |
| `coverage.json`  | Maps each frozen G1A retained-result ID to rows, an exclusion, or a closed disposition |
| `aggregation.md` | When a row may aggregate members                                                       |

Frozen G1A registry: `docs/scm/g1a/retained-results.json`. Coverage IDs must equal that set.

## Mechanical checks

Implemented in `apps/server/src/scm/g1bInventory.ts`:

- Required D15C columns are non-empty.
- Frozen G1A retained-result IDs and G1B coverage IDs are an exact set (missing, duplicate, and unexpected IDs fail).
- Closed dispositions only: `no-live-t2-host-communication-discovered`, `enumerable-registry-not-communication`, `no-live-production-communication`, each with required evidence fields.
- MCP HTTP negative control is bound to `INV-T2-MCP-HTTP` / `NC-MCP-HTTP` / `apps/server/src/mcp/McpHttpServer.ts`. Transferring metadata to another row fails.
- Catalog reconciliation for `T2_CATALOG_BOUNDARIES`.
- Aggregation requires structured member identity tuples that match the row.
- RPC subscribe streams are split by D15C family rather than aggregated.

These checks prove consistency with the frozen G1A registry. They do not prove an unknowable universe.

# S4 cutover-equivalence evidence

<!-- Agent: G10 S4 Ordered proof step 3. ≡ under G9DeferredEquality — honesty partition. -->

- Date: 2026-10-18
- Slice: **S4**
- Step: **cutover-equivalence**
- Phase: `equiv`
- Authority: **live**
- inversionArmed: `false`
- S4 inventory comm_ids (16): INV-T2-HTTP-AUTH, INV-T2-HTTP-CONNECT, INV-T2-HTTP-META, INV-T2-HTTP-ORCH, INV-T2-HTTP-PR, INV-T2-HTTP-STATIC, INV-T2-MCP-HTTP, INV-T2-PROVIDER-CLAUDE, INV-T2-PROVIDER-CODEX, INV-T2-PROVIDER-CURSOR, INV-T2-PROVIDER-EVENTS, INV-T2-PROVIDER-GROK, INV-T2-PROVIDER-LIST-EVENTS, INV-T2-PROVIDER-OPENCODE, INV-T2-PROVIDER-PERM, INV-T2-PROVIDER-TURN
- Carrier: `asG9DeferredEquality` (`g10ProofHarness.ts` / `G9DeferredEquality`)

## Wired seams (16) — bridge traffic ≡

Live-vs-manifold identity after admit/route/replace via `g10SeamBridge` (not
G9 capture-beside alone):

| comm_id                       | Sample projection (representative)              |
| ----------------------------- | ----------------------------------------------- |
| `INV-T2-HTTP-AUTH`            | `{ "endpoint": "session" }`                     |
| `INV-T2-HTTP-CONNECT`         | `{ "endpoint": "linkState" }`                   |
| `INV-T2-HTTP-META`            | `{ "endpoint": "descriptor" }`                  |
| `INV-T2-HTTP-ORCH`            | `{ "endpoint": "snapshot" }`                    |
| `INV-T2-HTTP-PR`              | `{ "endpoint": "diff" }`                        |
| `INV-T2-HTTP-STATIC`          | `{ "comm_id": "static-file-200-selected" }`     |
| `INV-T2-MCP-HTTP`             | `{ "site": "mcp-http-handler-succeeded" }`      |
| `INV-T2-PROVIDER-CLAUDE`      | `{ "operation": "claude.sdk.query" }`           |
| `INV-T2-PROVIDER-CODEX`       | `{ "provider": "spawned" }`                     |
| `INV-T2-PROVIDER-CURSOR`      | `{ "provider": "spawned" }`                     |
| `INV-T2-PROVIDER-EVENTS`      | `{ "member_id": "turn.completed" }`             |
| `INV-T2-PROVIDER-GROK`        | `{ "provider": "spawned" }`                     |
| `INV-T2-PROVIDER-LIST-EVENTS` | `{ "comm_id": "present" }`                      |
| `INV-T2-PROVIDER-OPENCODE`    | `{ "provider": "spawned" }`                     |
| `INV-T2-PROVIDER-PERM`        | `{ "comm_id": "permission-outcome-succeeded" }` |
| `INV-T2-PROVIDER-TURN`        | `{ "comm_id": "send-turn-succeeded" }`          |

Call sites: `provider/**`, `McpHttpServer.ts`, `http.ts`, `withHttp*Capture`
(environmentHttp API handlers), via `g10SliceS4.ts` helpers.

## Explicitly not

- WP8 763-fixture-as-G10-proof (`refuse763AsProof`)
- Stealing FILE-PROVIDER-SESSION / FILE-LOGS provider-event-log / FLAG-CODEX-LAUNCH (S7)

## Verdict

**GREEN** — wired sixteen ≡ under bridge traffic.

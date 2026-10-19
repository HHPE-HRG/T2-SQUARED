# S8 campaign-cutover-equivalence evidence

<!-- Agent: G10 S8 aggregate ≡ under G9DeferredEquality — not WP8 763. -->

- Date: 2026-10-18
- Slice: **S8**
- Carrier: `G9DeferredEquality` / `asG9DeferredEquality` (`g10ProofHarness.ts`)
- sampleCount: **12** (representative campaign rollup via `G10_S8_AGGREGATE_EQUIV_SEED_PAIRS`)
- forbids763: `true`
- Machine: `aggregateCutoverEquivalence` / `g10SliceS8.ts`

## Aggregate pairs (representative)

| comm_id                     | projection                                                          |
| --------------------------- | ------------------------------------------------------------------- |
| `INV-T2-ORCH-EVENTS`        | `{ "site": "domain-event-published" }`                              |
| `INV-T2-FLAG-SERVER-CONFIG` | `{ "comm_id": "resolved" }`                                         |
| `INV-T2-GIT`                | `{ "method": "execute" }`                                           |
| `INV-T2-PROVIDER-CODEX`     | `{ "provider": "spawned" }`                                         |
| `INV-T2-TERM`               | `{ "phase": "pty-spawn-succeeded" }`                                |
| `INV-T2-RPC-WS`             | `{ "site": "rpc-ws" }`                                              |
| `INV-T2-SQLITE`             | `{ "operation": "execute" }`                                        |
| `INV-T2-FLAG-T3-OTEL`       | `{ "comm_id": "resolved" }`                                         |
| `INV-T2-FILE-CHECKPOINTS`   | `{ "operation": "captureCheckpoint" }`                              |
| `INV-T2-FLAG-CLOUDFLARED`   | `{ "member": "T3CODE_CLOUDFLARED_PATH", "state_label": "absent" }`  |
| `INV-T2-FLAG-CODEX-LAUNCH`  | `{ "member": "T3CODE_CODEX_LAUNCH_ARGS", "state_label": "absent" }` |
| `INV-T2-FLAG-TERM-ENV`      | `{ "kind": "terminal-child-env-filtered" }`                         |

Live≡manifold identity checked per pair under `asG9DeferredEquality`. Per-slice
Ordered proof ≡ packages (S1–S7) remain the detailed carrier evidence; this
document is the campaign rollup.

## Notes

- aggregate ≡ under G9DeferredEquality (12 pairs)
- not WP8 763; not type-name-only close
- WORK-000035 losslessness still deferred (G9DeferredEquality honesty)
- radius unchanged; home-bus dormant-exempt from ≡
- S8 lander-reopen critical rows included in rollup

## Explicitly not

- WP8 763 shadow fixtures as G10 campaign proof
- Type-name substitution alone without live≡manifold projections
- Home-bus activation
- Closing via 763 alone (`refuse763AsProof`)

## Verdict

**GREEN** — campaign aggregate ≡ under G9DeferredEquality.

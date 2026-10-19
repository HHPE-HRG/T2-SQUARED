# S6 cutover-equivalence evidence

<!-- Agent: G10 S6 Ordered proof step 3. ≡ under G9DeferredEquality — honesty partition. -->

- Date: 2026-10-18
- Slice: **S6**
- Step: **cutover-equivalence**
- Phase: `equiv`
- Authority: **live**
- inversionArmed: `false`
- S6 activatable comm_ids (12): INV-T2-FLAG-T2-OTEL, INV-T2-FLAG-T3-OTEL, INV-T2-ORCH-RPC, INV-T2-RPC-STREAM-AUTH, INV-T2-RPC-STREAM-CONFIG, INV-T2-RPC-STREAM-DISCOVERY, INV-T2-RPC-STREAM-ORCH, INV-T2-RPC-STREAM-TEL, INV-T2-RPC-STREAM-TERM, INV-T2-RPC-WS, INV-T2-TEL-T2-OTLP, INV-T2-TEL-T3-OTLP
- Carrier: `asG9DeferredEquality` (`g10ProofHarness.ts` / `G9DeferredEquality`)

## Wired seams (14) — bridge traffic ≡

Live-vs-manifold identity after admit/route/replace via `g10SeamBridge` (not
G9 capture-beside alone):

| comm_id                       | Sample projection (representative)                |
| ----------------------------- | ------------------------------------------------- |
| `INV-T2-FLAG-T2-OTEL`         | `{ "member": "T2CODE_TRACE_FILE" }`               |
| `INV-T2-ORCH-RPC`             | `{ "method": "orchestration.dispatchCommand" }`   |
| `INV-T2-RPC-STREAM-AUTH`      | `{ "method": "subscribeAuthAccess" }`             |
| `INV-T2-RPC-STREAM-CONFIG`    | `{ "method": "subscribeServerConfig" }`           |
| `INV-T2-RPC-STREAM-DISCOVERY` | `{ "method": "subscribeVcsStatus" }`              |
| `INV-T2-RPC-STREAM-ORCH`      | `{ "method": "orchestration.subscribeShell" }`    |
| `INV-T2-RPC-STREAM-TEL`       | `{ "method": "subscribeResourceTelemetry" }`      |
| `INV-T2-RPC-STREAM-TERM`      | `{ "method": "subscribeTerminalEvents" }`         |
| `INV-T2-RPC-WS`               | `{ "method": "server.probe" }`                    |
| `INV-T2-TEL-T2-OTLP`          | `{ "signal": "t2-otlp-export-succeeded" }`        |
| `INV-T2-TEL-T3-OTLP`          | `{ "signal": "t3-otlp-traces-export-succeeded" }` |
| `INV-T2-ORCH-LIVE`            | `{ "kind": "event" }`                             |
| `INV-T2-TEL-NDJSON`           | `{ "comm_id": "present" }`                        |
| `INV-T2-TEL-T3-TRACE`         | `{ "comm_id": "present" }`                        |

Call sites: `ws.ts`, `T2Observability.ts`, `Observability.ts`, via
`g10SliceS6.ts` helpers.

## Handoff-deferred stubs (1) — ≡ carrier only

| comm_id               | Status                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `INV-T2-FLAG-T3-OTEL` | S6→S2 handoff on `cli/config.ts`. Ledger A stub pair only. **Not** admit/route/replace wiring. |

## Dormant-exempt — not in ≡ set

| comm_id                    | Status                                        |
| -------------------------- | --------------------------------------------- |
| `INV-T2-SCM-HOME-BUS-LINK` | dormant-preserved; fixtures only; not cutover |

## Explicitly not

- WP8 763-fixture-as-G10-proof (`refuse763AsProof`)
- Stealing FLAG-T3-OTEL on `cli/config.ts` (S2 sole lander)
- Activating home-bus

## Verdict

**GREEN** — wired fourteen ≡ under bridge traffic; stub covers deferred FLAG-T3.

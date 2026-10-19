# S5 cutover-equivalence evidence

<!-- Agent: G10 S5 Ordered proof step 3. ≡ under G9DeferredEquality — honesty partition. -->

- Date: 2026-10-18
- Slice: **S5**
- Step: **cutover-equivalence**
- Phase: `equiv`
- Authority: **live**
- inversionArmed: `false`
- S5 inventory comm_ids (5): INV-T2-RES-MONITOR, INV-T2-TEL-DESKTOP-IN, INV-T2-TEL-NDJSON, INV-T2-TEL-T3-TRACE, INV-T2-TERM
- Carrier: `asG9DeferredEquality` (`g10ProofHarness.ts` / `G9DeferredEquality`)

## Wired seams (4) — bridge traffic ≡

Live-vs-manifold identity after admit/route/replace via `g10SeamBridge` (not
G9 capture-beside alone):

| comm_id                      | Sample projection (representative)           |
| ---------------------------- | -------------------------------------------- |
| `INV-T2-RES-MONITOR`         | `{ "site": "spawned" }`                      |
| `INV-T2-TEL-DESKTOP-IN`      | `{ "message_type": "setDiagnosticsDemand" }` |
| `INV-T2-TEL-DESKTOP-CONTROL` | `{ "operation": "setDiagnosticsDemand" }`    |
| `INV-T2-TERM`                | `{ "site": "spawned" }`                      |

Call sites: `terminal/Manager.ts`, `NativeTelemetryClient.ts`,
`DesktopTelemetryReceiver.ts`, via `g10SliceS5.ts` helpers.

## Handoff-deferred stubs (2) — ≡ carrier only

| comm_id               | Status                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `INV-T2-TEL-NDJSON`   | S5→S6 handoff on `T2Observability.ts`. Ledger A stub pair only. **Not** admit/route/replace wiring. |
| `INV-T2-TEL-T3-TRACE` | S5→S6 handoff on `Observability.ts`. Ledger A stub pair only. **Not** admit/route/replace wiring.   |

## Explicitly not

- WP8 763-fixture-as-G10-proof (`refuse763AsProof`)
- Stealing FILE-LOGS terminalLogs / FLAG-TERM-ENV (S7)

## Verdict

**GREEN** — wired four ≡ under bridge traffic; stubs cover deferred two.

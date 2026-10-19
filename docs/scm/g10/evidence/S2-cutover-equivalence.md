# S2 cutover-equivalence evidence

<!-- Agent: G10 S2 Ordered proof step 3. ≡ under G9DeferredEquality — honesty partition. -->

- Date: 2026-10-18
- Slice: **S2**
- Step: **cutover-equivalence**
- Phase: `equiv`
- Authority: **live**
- inversionArmed: `false`
- S2 inventory comm_ids (3): INV-T2-FILE-SETTINGS, INV-T2-FLAG-SERVER-CONFIG, INV-T2-ORCH-LIVE
- Plus SETTINGS-EVENTS S1→S2 handoff land (not S2 inventory; lander-owned)
- Carrier: `asG9DeferredEquality` (`g10ProofHarness.ts` / `G9DeferredEquality`)

## Wired seams (3) — bridge traffic ≡

Live-vs-manifold identity after admit/route/replace via `g10SeamBridge` (not
G9 capture-beside alone):

| comm_id                     | Sample projection                               |
| --------------------------- | ----------------------------------------------- |
| `INV-T2-FILE-SETTINGS`      | `{ "operation": "succeeded" }` (exists carrier) |
| `INV-T2-FLAG-SERVER-CONFIG` | `{ "comm_id": "resolved" }`                     |
| `INV-T2-SETTINGS-EVENTS`    | `{ "site": "subscribed" }` (S1 handoff land)    |

Call sites: `serverSettings.ts` (FILE-SETTINGS + SETTINGS-EVENTS),
`cli/config.ts` (FLAG-SERVER-CONFIG) via `g10SliceS2.ts` helpers.

## Handoff-deferred (1) — stub only

| comm_id            | Notes                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INV-T2-ORCH-LIVE` | S2→S6 handoff on `ws.ts`. Ledger A stub pair for Ordered-proof carrier coverage only. **Not** admit/route/replace wiring. **Not** credited as S2-wired ≡. |

## Explicitly not

- WP8 763-fixture-as-G10-proof (`refuse763AsProof`)
- Treating ORCH-LIVE stub as dual-run-exit (a)
- Committing `ws.ts` from S2
- Stealing FLAG-T3-OTEL (S6 handoff on `cli/config.ts`)

## Verdict

**GREEN** — wired three ≡ under bridge traffic; ORCH-LIVE disclosed as handoff-deferred stub.

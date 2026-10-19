# S1 cutover-equivalence evidence

<!-- Agent: G10 S1 Ordered proof step 3. ≡ under G9DeferredEquality — honesty partition. -->

- Date: 2026-10-18
- Slice: **S1**
- Step: **cutover-equivalence**
- Phase: `equiv`
- Authority: **live**
- inversionArmed: `false`
- S1 inventory comm_ids (7): INV-T2-LIFECYCLE-EVENTS, INV-T2-ORCH-EVENTS, INV-T2-ORCH-QUEUE, INV-T2-PREVIEW-AUTO, INV-T2-PROJECT-QUEUE, INV-T2-SETTINGS-EVENTS, INV-T2-VCS-EVENTS
- Carrier: `asG9DeferredEquality` (`g10ProofHarness.ts` / `G9DeferredEquality`)
- Binding: 5-panel majority **SYNTHESIZE** (stub-vs-wired escalation)

## Wired seams (6) — bridge traffic ≡

Live-vs-manifold identity after admit/route/replace via `g10SeamBridge` (not
G9 capture-beside alone):

| comm_id                   | Sample projection                                       |
| ------------------------- | ------------------------------------------------------- |
| `INV-T2-ORCH-EVENTS`      | `{ "member_id": "thread.activity-appended" }`           |
| `INV-T2-ORCH-QUEUE`       | `{ "command_type": "client"\|"internal" }`              |
| `INV-T2-LIFECYCLE-EVENTS` | `{ "comm_id": "present" }`                              |
| `INV-T2-PREVIEW-AUTO`     | `{ "comm_id": "present" }` (preview-auto-queue-offered) |
| `INV-T2-PROJECT-QUEUE`    | `{ "kind": "projection-event-succeeded" }`              |
| `INV-T2-VCS-EVENTS`       | `{ "comm_id": "present" }`                              |

Call sites: Engine sole lander for ORCH-\*; capture modules for the other four
(`g10SliceS1.ts` helpers + module publish/offer/project wrappers).

## Handoff-deferred (1) — stub only

| comm_id                  | Notes                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INV-T2-SETTINGS-EVENTS` | S1→S2 handoff on `serverSettings.ts`. Ledger A stub pair for Ordered-proof carrier coverage only. **Not** admit/route/replace wiring. **Not** credited as Engine-wired ≡. |

## Explicitly not

- WP8 763-fixture-as-G10-proof (`refuse763AsProof`)
- Treating SETTINGS stub as dual-run-exit (a)
- Treating the former five-row ledger-stub set as wired (LIFECYCLE / PREVIEW /
  PROJECT-QUEUE / VCS are now bridge-wired)

## Verdict

**GREEN** — wired six ≡ under bridge traffic; SETTINGS disclosed as handoff-deferred stub.

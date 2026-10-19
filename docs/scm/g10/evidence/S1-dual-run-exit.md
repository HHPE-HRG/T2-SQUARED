# S1 dual-run-exit evidence

<!-- Agent: G10 S1 Ordered proof step 5. Live path retired for wired six; SETTINGS handoff-deferred. -->

- Date: 2026-10-18
- Slice: **S1**
- Step: **dual-run-exit**
- Phase: `exited`
- Authority: **manifold**
- inversionArmed: `false` (armed only at next step)
- S1 inventory comm_ids (7): INV-T2-LIFECYCLE-EVENTS, INV-T2-ORCH-EVENTS, INV-T2-ORCH-QUEUE, INV-T2-PREVIEW-AUTO, INV-T2-PROJECT-QUEUE, INV-T2-SETTINGS-EVENTS, INV-T2-VCS-EVENTS
- Binding: 5-panel majority **SYNTHESIZE** (stub-vs-wired escalation)

## Wired + exited (6) — exit criteria (a)/(e)

Manifold admit/route/replace wired via `g10SeamBridge`; live path retired for:

| comm_id                   | Call site                                     |
| ------------------------- | --------------------------------------------- |
| `INV-T2-ORCH-EVENTS`      | `OrchestrationEngine.ts` (sole Engine lander) |
| `INV-T2-ORCH-QUEUE`       | `OrchestrationEngine.ts` (sole Engine lander) |
| `INV-T2-LIFECYCLE-EVENTS` | `serverLifecycleEvents.ts`                    |
| `INV-T2-PREVIEW-AUTO`     | `PreviewAutomationBroker.ts`                  |
| `INV-T2-PROJECT-QUEUE`    | `ProjectionPipeline.ts`                       |
| `INV-T2-VCS-EVENTS`       | `VcsStatusBroadcaster.ts`                     |

## Handoff-deferred (1) — not exit (a)

| comm_id                  | Status                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `INV-T2-SETTINGS-EVENTS` | S1→S2 handoff-pending on `serverSettings.ts`. Ledger stub only. **Do not claim Engine-wired or dual-run-exit (a) for this row from S1.** |

## Measurable exit (decisions.md) — scoped

- (a) Manifold admit/route/replace wired for the **six S1-owned** activatable `comm_id`s above (not SETTINGS)
- (b) Live-authoritative rehearsal green (`S1-live-rehearsal.md`)
- (c) Cutover ≡ recorded (`S1-cutover-equivalence.md`) — wired six bridge traffic; SETTINGS handoff stub disclosed
- (d) Rollback drill once OK (`S1-rollback-drill.md`)
- (e) Live path marked retired for the **wired six** — **this record**

## Sole owner

Authority flip performed **only** by `recordOrderedProofStep(model, "S1", "dual-run-exit")`
(`g10ProofHarness.ts`). `markDualRunExited` **refuses** (S0 escalation
KEEP_A / `S0-escalation-proof-step-sole-owner.md`).

## Verdict

**GREEN** for S1 Ordered proof on the wired six + SETTINGS handoff disclosure.
Not an all-7 Engine-wired exit claim.

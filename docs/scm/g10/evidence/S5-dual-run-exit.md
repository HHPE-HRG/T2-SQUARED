# S5 dual-run-exit evidence

<!-- Agent: G10 S5 Ordered proof step 5. Live path retired for four wired S5 seams. -->

- Date: 2026-10-18
- Slice: **S5**
- Step: **dual-run-exit**
- Phase: `exited`
- Authority: **manifold**
- inversionArmed: `false` (armed only at next step)
- S5 inventory comm_ids (5): INV-T2-RES-MONITOR, INV-T2-TEL-DESKTOP-IN, INV-T2-TEL-NDJSON, INV-T2-TEL-T3-TRACE, INV-T2-TERM

## Wired + exited (4) — exit criteria (a)/(e)

Manifold admit/route/replace wired via `g10SeamBridge`; live path retired for:

| comm_id                      | Call site                                          |
| ---------------------------- | -------------------------------------------------- |
| `INV-T2-TERM`                | `terminal/Manager.ts` (sole lander)                |
| `INV-T2-RES-MONITOR`         | `NativeTelemetryClient.ts` (sole lander)           |
| `INV-T2-TEL-DESKTOP-IN`      | `DesktopTelemetryReceiver.ts` (sole lander)        |
| `INV-T2-TEL-DESKTOP-CONTROL` | `DesktopTelemetryReceiver.ts` (S3→S5 handoff land) |

## Handoff-deferred — not exit (a) under S5

| comm_id               | Status                                                                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INV-T2-TEL-NDJSON`   | S5→S6 handoff-pending on `T2Observability.ts`. Ledger stub only. **Do not claim S5-wired or dual-run-exit (a) for this row from S5.** See `docs/scm/g10/handoffs/S5-TEL-NDJSON-to-S6.md`. |
| `INV-T2-TEL-T3-TRACE` | S5→S6 handoff-pending on `Observability.ts`. Ledger stub only. **Do not claim S5-wired or dual-run-exit (a) for this row from S5.** See `docs/scm/g10/handoffs/S5-TEL-T3-TRACE-to-S6.md`. |

## S7 handoffs — not exit (a) under S5

| comm_id                           | Status                                                  |
| --------------------------------- | ------------------------------------------------------- |
| `INV-T2-FILE-LOGS` (terminalLogs) | S7→S5 lander slot reserved on `Manager.ts` — not stolen |
| `INV-T2-FLAG-TERM-ENV`            | S7→S5 lander slot reserved on `Manager.ts` — not stolen |

## Measurable exit (decisions.md) — scoped

- (a) Manifold admit/route/replace wired for the **four S5 wired** seams above
- (b) Live-authoritative rehearsal green (`S5-live-rehearsal.md`)
- (c) Cutover ≡ recorded (`S5-cutover-equivalence.md`)
- (d) Rollback drill once OK (`S5-rollback-drill.md`)
- (e) Live path marked retired for the **wired four** — **this record**

Not an all-5 Engine-wired exit claim (TEL-NDJSON / TEL-T3-TRACE deferred to S6).

## Sole owner

Authority flip performed **only** by `recordOrderedProofStep(model, "S5", "dual-run-exit")`
(`g10ProofHarness.ts`). `markDualRunExited` **refuses** (S0 escalation
KEEP_A / `S0-escalation-proof-step-sole-owner.md`).

## Verdict

**GREEN** for S5 Ordered proof on four wired seams.

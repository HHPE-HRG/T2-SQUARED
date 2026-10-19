# S2 dual-run-exit evidence

<!-- Agent: G10 S2 Ordered proof step 5. Live path retired for wired three; ORCH-LIVE handoff-deferred. -->

- Date: 2026-10-18
- Slice: **S2**
- Step: **dual-run-exit**
- Phase: `exited`
- Authority: **manifold**
- inversionArmed: `false` (armed only at next step)
- S2 inventory comm_ids (3): INV-T2-FILE-SETTINGS, INV-T2-FLAG-SERVER-CONFIG, INV-T2-ORCH-LIVE

## Wired + exited (3) — exit criteria (a)/(e)

Manifold admit/route/replace wired via `g10SeamBridge`; live path retired for:

| comm_id                     | Call site                                                               |
| --------------------------- | ----------------------------------------------------------------------- |
| `INV-T2-FILE-SETTINGS`      | `serverSettings.ts` (exists/read/write)                                 |
| `INV-T2-FLAG-SERVER-CONFIG` | `cli/config.ts` (`EnvServerConfig` / `resolveServerConfig`)             |
| `INV-T2-SETTINGS-EVENTS`    | `serverSettings.ts` (S1→S2 handoff land: emitChange / subscribeChanges) |

## Handoff-deferred (1) — not exit (a)

| comm_id            | Status                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INV-T2-ORCH-LIVE` | S2→S6 handoff-pending on `ws.ts`. Ledger stub only. **Do not claim S2-wired or dual-run-exit (a) for this row from S2.** See `docs/scm/g10/handoffs/S2-ORCH-LIVE-to-S6.md`. |

## Measurable exit (decisions.md) — scoped

- (a) Manifold admit/route/replace wired for the **three S2 lander** seams above (not ORCH-LIVE)
- (b) Live-authoritative rehearsal green (`S2-live-rehearsal.md`)
- (c) Cutover ≡ recorded (`S2-cutover-equivalence.md`) — wired three bridge traffic; ORCH-LIVE handoff stub disclosed
- (d) Rollback drill once OK (`S2-rollback-drill.md`)
- (e) Live path marked retired for the **wired three** — **this record**

## Sole owner

Authority flip performed **only** by `recordOrderedProofStep(model, "S2", "dual-run-exit")`
(`g10ProofHarness.ts`). `markDualRunExited` **refuses** (S0 escalation
KEEP_A / `S0-escalation-proof-step-sole-owner.md`).

## Verdict

**GREEN** for S2 Ordered proof on the wired three + ORCH-LIVE handoff disclosure.
Not an all-3 inventory Engine-wired exit claim (ORCH-LIVE deferred to S6).

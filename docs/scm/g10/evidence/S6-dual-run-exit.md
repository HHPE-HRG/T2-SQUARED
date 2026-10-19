# S6 dual-run-exit evidence

<!-- Agent: G10 S6 Ordered proof step 5. Live path retired for fourteen wired S6 seams. -->

- Date: 2026-10-18
- Slice: **S6**
- Step: **dual-run-exit**
- Phase: `exited`
- Authority: **manifold**
- inversionArmed: `false` (armed only at next step)
- S6 activatable comm_ids (12): INV-T2-FLAG-T2-OTEL, INV-T2-FLAG-T3-OTEL, INV-T2-ORCH-RPC, INV-T2-RPC-STREAM-AUTH, INV-T2-RPC-STREAM-CONFIG, INV-T2-RPC-STREAM-DISCOVERY, INV-T2-RPC-STREAM-ORCH, INV-T2-RPC-STREAM-TEL, INV-T2-RPC-STREAM-TERM, INV-T2-RPC-WS, INV-T2-TEL-T2-OTLP, INV-T2-TEL-T3-OTLP

## Wired + exited (14) — exit criteria (a)/(e)

Manifold admit/route/replace wired via `g10SeamBridge`; live path retired for:

| comm_id                       | Call site                                 |
| ----------------------------- | ----------------------------------------- |
| `INV-T2-FLAG-T2-OTEL`         | `T2Observability.ts` (sole lander)        |
| `INV-T2-ORCH-RPC`             | `ws.ts` Rpc hooks (sole lander)           |
| `INV-T2-RPC-STREAM-AUTH`      | `ws.ts` Rpc hooks (sole lander)           |
| `INV-T2-RPC-STREAM-CONFIG`    | `ws.ts` Rpc hooks (sole lander)           |
| `INV-T2-RPC-STREAM-DISCOVERY` | `ws.ts` Rpc hooks (sole lander)           |
| `INV-T2-RPC-STREAM-ORCH`      | `ws.ts` Rpc hooks (sole lander)           |
| `INV-T2-RPC-STREAM-TEL`       | `ws.ts` Rpc hooks (sole lander)           |
| `INV-T2-RPC-STREAM-TERM`      | `ws.ts` Rpc hooks (sole lander)           |
| `INV-T2-RPC-WS`               | `ws.ts` Rpc hooks (sole lander)           |
| `INV-T2-TEL-T2-OTLP`          | `T2Observability.ts` (sole lander)        |
| `INV-T2-TEL-T3-OTLP`          | `Observability.ts` (sole lander)          |
| `INV-T2-ORCH-LIVE`            | `ws.ts` (S2→S6 handoff land)              |
| `INV-T2-TEL-NDJSON`           | `T2Observability.ts` (S5→S6 handoff land) |
| `INV-T2-TEL-T3-TRACE`         | `Observability.ts` (S5→S6 handoff land)   |

## Handoff-deferred — not exit (a) under S6

| comm_id               | Status                                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INV-T2-FLAG-T3-OTEL` | S6→S2 handoff-pending on `cli/config.ts`. Ledger stub only. **Do not claim S6-wired or dual-run-exit (a) for this row from S6.** See `docs/scm/g10/handoffs/S6-FLAG-T3-OTEL-to-S2.md`. |

## Dormant-exempt — not exit (a)

| comm_id                    | Status                           |
| -------------------------- | -------------------------------- |
| `INV-T2-SCM-HOME-BUS-LINK` | dormant-preserved; fixtures only |

## Measurable exit (decisions.md) — scoped

- (a) Manifold admit/route/replace wired for the **fourteen S6 wired** seams above
- (b) Live-authoritative rehearsal green (`S6-live-rehearsal.md`)
- (c) Cutover ≡ recorded (`S6-cutover-equivalence.md`)
- (d) Rollback drill once OK (`S6-rollback-drill.md`)
- (e) Live path marked retired for the **wired fourteen** — **this record**

Not an all-12 activatable Engine-wired exit claim (FLAG-T3-OTEL deferred to S2).
Not a home-bus activation claim.

## Sole owner

Authority flip performed **only** by `recordOrderedProofStep(model, "S6", "dual-run-exit")`
(`g10ProofHarness.ts`). `markDualRunExited` **refuses** (S0 escalation
KEEP_A / `S0-escalation-proof-step-sole-owner.md`).

## Verdict

**GREEN** for S6 Ordered proof on fourteen wired seams.

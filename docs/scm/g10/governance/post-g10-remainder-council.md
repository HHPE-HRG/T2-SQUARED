# Post-G10 remainder council (11 isolated)

<!-- Agent: advisory only. Not authorization. Not completed flip. -->

- Date: 2026-10-18
- Size: **11** isolated agents; no peer findings
- Question: What remains to implement/design/develop after G10 campaign-clean, given belief that G10 was the last large planned manifold item before live testing?

## Ballot: was G10 the last large planned item?

| ID  | Lens                   | G10_WAS_LAST_LARGE |
| --- | ---------------------- | ------------------ |
| L01 | gates roadmap          | **YES**            |
| L02 | G10 residuals          | **YES**            |
| L03 | live-test wire         | **YES**            |
| L04 | fabric depth           | **PARTIAL**        |
| L05 | deferred separate-auth | **YES**            |
| L06 | G0–G8 entry            | **YES**            |
| L07 | ship hygiene           | **YES**            |
| L08 | false-friend risk      | **YES**            |
| L09 | work taxonomy          | **PARTIAL**        |
| L10 | live-test ops          | **PARTIAL**        |
| L11 | steward next-gate      | **PARTIAL**        |

**Tally:** YES **7** · PARTIAL **4** · NO **0**

**Council sense:** Affirm user belief for the **numbered DoD ladder** (no G11 planned). PARTIAL votes mean “last large _gate_, but not last _work_ before honest live fabric / package complete.”

## Consensus remaining (before honest live test / package complete)

### Block live-test honesty (implement / ops)

1. **Wire `server.ts`** — merge non-empty `g10CutoverStackLayerFromEnv()` (today empty / unwired).
2. **Human live-cutover ops runbook** — env on/off, abort, worktree `.t3` isolation, smoke gates (session-runbook is pre-runtime binding, not ops SOP).
3. **Ship hygiene** — commit/baseline G10 tree; keep `manifest.completed: false` until live proof; don’t live-test a floating dirty tree.
4. **Live Ordered proof on a real process** — not harness-only GREEN.

### Optional / residual implement (accepted at S8, still open)

5. Phase handoffs still pending: FILE-LOGS provider-event-log→S4, terminalLogs→S5, FILE-PROVIDER-SESSION cache→S4.
6. Stale handoff docs still saying pending where S8 disposition is exited-lander.

### Develop / design (not required for first live opt-in; product depth)

7. Real manifold I/O under `manifoldEffect` (authority-flip ≠ second fabric bus) — L04 PARTIAL.
8. Soft-fallback retirement post-exit so inverted path is sole I/O.

### Out unless separate steward auth (not next)

- Codec / nibble / dictionary
- Home-bus activation / eleventh bus
- OQ7 / radius shrink
- WORK-000035 losslessness
- Kuatos / freeze-store / closed-loop product (deferred systems)
- Promoting G5–G8 into `server.ts` entry (intentionally in-process)

## Next steward decision

Package G10 campaign as closed-for-ladder; open **product live validation** under opt-in env after `server.ts` wire + ops runbook. Do **not** invent G11 or unlock deferred non-goals. Flip `completed: true` only after live evidence.

This ledger does **not** authorize ceremony changes or radius resize.

---

## Close applied — 2026-10-18 (auth-freeze)

Consensus residuals addressed under existing G10 auth:

1. `server.ts` merges non-empty `g10CutoverStackLayerFromEnv`
2. Ops live-cutover runbook landed
3. Three phase residuals wired on S4/S5 landers
4. `auth-freeze.md` + manifest `authorizedImplementComplete: true` /
   `completed: false`

Fabric-depth redesign, codec, home-bus, G5–G8 server entry remain **new auth**.
Live test is the next steward gate — not further authorized implement.

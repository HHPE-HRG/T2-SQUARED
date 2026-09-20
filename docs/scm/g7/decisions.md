# G7 binding decisions (human, 2026-09-20)

Decisions recorded from Max Holden’s authorization of the next SCM gate after
G6, bound to D10 / G7 DoD. Updated the same day: SCM is **not** a campaign or
workload plane; G7 attaches to existing DIP / bridge surfaces, not a new
identity.

## Settled

### Auth

G7 is human-authorized. G8–G10 remain barred unless separately authorized.
Do not flip G4/G5 `g6toG10Authorized` or G6 `g7toG10Authorized`.

### SCM has no campaign identity

HHPE D10 “campaign function” means **who may declare fail-closed** (steward /
ledger), not an SCM object named campaign and not a workload. SCM remains
buses, DIP switches, and (when present) a bridge. Do not add a campaign
controller, safety node, or OTEL-aligned extra identity.

### Where G7 lives

**Owner: the receiving bus’s DIP switch set** (bus-level positions, not
per-source mute rows).

**Obeyer: the communication bridge.** The bridge is infrastructure. It has no
halt identity. It consults source and destination DIP; if either bus is
frozen or halted, it must not forward.

404 recommend-stop is **not** a DIP write. It is observer OTEL only.

### Halt vs 404

- `node.observer.404` and any observer-class caller **cannot** set freeze or
  halt on DIP.
- A 404 **recommend-stop** must not freeze, halt, or change bus storage.
- G3 keeps `halt_initiator: no` on observers and `open` elsewhere. This slice
  does **not** set any roster cell to `yes`.

### DIP roles (mute vs safety)

| DIP surface                                              | Role                                          |
| -------------------------------------------------------- | --------------------------------------------- |
| Per-source row `hear` / `mute-source` / `mute-modifiers` | Population (G6). Unchanged. Mute is not halt. |
| Bus-level position `live` / `frozen` / `halted`          | G7 safety latch on that bus                   |

Steward sets bus-level position. Observer cannot.

### Freeze vs halt (per bus)

| DIP position | Effect on that bus                                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frozen`     | Latch readable snapshot. Publish/advance/DIP-row mutation fail closed. Hear/read of snapshot still allowed. Bridge will not use this bus as source or dest. |
| `halted`     | Fail-closed stop of that bus’s communication (same latch + halt observation). No unhalt in this slice.                                                      |

There is no “halt all campaigns” API. Stopping more than one bus means setting
halt/freeze on each bus’s DIP.

Unexpected identity / token / binding fails closed and sets that bus DIP to
`frozen`. That is not a 404 recommend.

### OTEL

Observes DIP/bridge decisions. Does not own them.

```text
t2.scm.halt
t2.scm.freeze
t2.scm.recommend_stop
```

### Out of scope

- G8 clocks / framing parameters
- G9/G10, codec, Kuato
- D16 freeze evidence-store product
- Auto-recovery / unfreeze / unhalt
- Mutating G1 inventory or G3 halt_initiator to `yes`
- Treating mute as halt
- A new SCM identity for safety or OTEL alignment

## Artifact sequence

1. This authorization + decisions (here)
2. `docs/superpowers/specs/2026-09-20-scm-g7-halt-freeze-design.md` — design
3. `docs/superpowers/plans/2026-09-20-scm-g7-halt-freeze.md` — implementation plan
4. Code under `apps/server/src/scm/` + `docs/scm/g7/` fixtures/manifest

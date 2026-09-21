# G8 binding decisions (human, 2026-09-20)

Authorized only after inherited blockers were checked clear (G1 closed, D5
closed, G2 record present). Codec remains forbidden.

## Settled

### Auth

G8 is human-authorized. G9–G10 remain barred. Do not flip G7
`g8toG10Authorized`.

### No extra SCM identity

Clocks are **parameters of the existing fundamental-timestep driver**, not a
new node, campaign, DIP owner, or OTEL controller. DIP still owns mute/freeze.
The bridge still obeys DIP. OTEL observes clock advances.

### What G8 fills (Increment 4)

1. **Timestep-producer name** — a named producer string on the existing
   injectable clock (`SharedFundamentalClock` / successor), not a `node_id`.
2. **Age/repeat numeric table** — integer rules for `state_age` and
   `request_age` (not wire widths).
3. **null / modifier-start parameters** — still named placeholders; G8 records
   them as framing parameters. **No wire values, nibbles, or encodings** (D8).
4. **Framing** — process interval = N fundamental timesteps; one word per
   active node per fundamental timestep. Frozen/halted DIP buses are not
   advanced (G7).

### Age/repeat table (prototype integers)

Inherited from G5/D5 unless tests prove otherwise:

| Event                                           | `request_age`                         | `state_age`                         |
| ----------------------------------------------- | ------------------------------------- | ----------------------------------- |
| Repeat same `fundamental_request` next timestep | unchanged                             | (see state row)                     |
| `fundamental_request` value changes             | reset to 0                            | unchanged unless state also changes |
| Same `fundamental_state` next timestep          | unchanged unless request row applies  | increment by 1                      |
| `fundamental_state` value changes               | unchanged unless request also changes | reset to 0                          |

Repeat is republication, not an ACK and not a `request_age` bump.

### Out of scope

- G9/G10, codec, nibble alphabet, dictionary, Kuato
- Independent production clock domains / SocketCAN time
- Binding halt to a G3 node
- Overload/soak product (overlap already fails closed on the precursor clock)
- Treating `g8SharedClock` precursor as G8 complete without this package

## Artifact sequence

1. This authorization + decisions
2. `docs/superpowers/specs/2026-09-20-scm-g8-clocks-framing-design.md`
3. `docs/superpowers/plans/2026-09-20-scm-g8-clocks-framing.md`
4. Code under `apps/server/src/scm/` + `docs/scm/g8/`

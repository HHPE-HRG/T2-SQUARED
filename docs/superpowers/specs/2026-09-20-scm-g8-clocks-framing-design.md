---
title: SCM G8 clocks and framing parameters design
date: 2026-09-20
status: design-approved
plan: docs/superpowers/plans/2026-09-20-scm-g8-clocks-framing.md
scope: G8 Increment 4 clock/framing parameters on in-process SCM
authorization: docs/scm/g8/authorization.md
decisions: docs/scm/g8/decisions.md
checkpoint: d992dfb40
---

# SCM G8 clocks and framing parameters design

## Purpose

Complete Increment 4 **parameters** on the existing in-process surface: name
the fundamental-timestep producer, publish the age/repeat integer table, treat
`modifier_start` / `null` as framing parameters without wire encodings, and
frame process intervals as N fundamental timesteps.

This does not complete G9 (parity onto W1) or G10 (cutover). It does not
replace Effect RPC. `g8SharedClock` remains a precursor until this package
lands.

Human authorization: `docs/scm/g8/authorization.md`. Blockers checked clear:
G1 closed, D5 closed, G2 disposition record present. Codec still forbidden.

## Existing constraints

- G1–G7 complete as packages. G8 human-authorized 2026-09-20. G9–G10 unauthorized.
- G7 `g8toG10Authorized: false` stays false. G8 auth is this package.
- Cadence already inherited: one word per active node per **fundamental
  timestep**; write at T readable at T+1; no sender ACK.
- Process interval may cover many fundamental timesteps. Do not call a
  fundamental timestep a “tick.”
- DIP freeze/halt skips advance on that bus (G7). Clock must not invent time
  for a frozen bus.
- OTEL observes; it does not produce time or admit words.
- No nibble alphabet, codec, dictionary membership, or production encoding.
- No new SCM node or campaign identity.

## Chosen architecture

Extend the existing injectable clock. Do not add a clock node.

```text
named producer (parameter)
        |
        v
SharedFundamentalClock / G8 clock
        |  N fundamental timesteps per process interval
        v
buses (G5) + DIP (G6/G7) + bridge (obeys DIP)
```

G8 owns a **parameter record** (JSON fixture + typed table) that the clock and
word-age helper consult. DIP/bridge code does not become a clock.

## Timestep producer

Name (prototype string, not a `node_id`):

```text
scm.fundamental-clock
```

The producer is the in-process injectable driver already used by the home-bus
link. Tests pin `producer_name === "scm.fundamental-clock"`. No wall-clock
source, no SocketCAN time, no second independent domain in this slice.

## Age/repeat table

Stewarded integer rules applied when a node publishes the next word:

| Condition                                          | `request_age`  | `state_age`  |
| -------------------------------------------------- | -------------- | ------------ |
| Same `fundamental_request` as prior published word | keep           | (state rule) |
| Different `fundamental_request`                    | 0              | (state rule) |
| Same `fundamental_state` as prior published word   | (request rule) | prior + 1    |
| Different `fundamental_state`                      | (request rule) | 0            |
| First word for a node                              | 0              | 0            |

Unsatisfied repeat = republish same request; `request_age` does not bump.
Helper (name plan-owned), e.g. `nextAges(previous, nextState, nextRequest)`.

G5 tests that construct ages by hand stay valid; G8 tests prove the table.

## Framing parameters (not encodings)

| Parameter                               | G8 value                             | Not                                         |
| --------------------------------------- | ------------------------------------ | ------------------------------------------- |
| `modifier_start`                        | named placeholder `"modifier_start"` | wire number / nibble                        |
| `null`                                  | named placeholder `"null"`           | wire number / nibble                        |
| word slot order                         | G4 W1 order                          | codec                                       |
| process interval                        | N ≥ 0 integer fundamental timesteps  | OS tick                                     |
| words per node per fundamental timestep | 1                                    | variable Increment-1 cadence as current law |

Negative tests already in G4 (omit request, shared life_age, encoding keys)
remain. G8 adds: clock overlap still fail-closed; N=0 is no-op; frozen bus is
not advanced by a process interval.

## Integration

- Promote/keep `SharedFundamentalClock` as the named producer; attach
  `producer_name` and the age table fixture.
- Optional: `observeClockAdvance` → `t2.scm.clock.advance` with
  `t2.scm.producer_name`, `t2.scm.elapsed_fundamental_timesteps`.
- DIP `assertMutable` / link skip-advance stays G7; G8 must not override freeze
  by ticking a frozen bus.
- Do not put clock state on DIP rows.

## Proof matrix

| Case           | Expect                                                            |
| -------------- | ----------------------------------------------------------------- |
| Producer name  | clock reports `scm.fundamental-clock`                             |
| Interval N=2   | two fundamental advances in order                                 |
| N=0            | no-op                                                             |
| Overlap        | fail closed                                                       |
| Repeat request | `request_age` unchanged; `state_age` +1 if state unchanged        |
| State change   | `state_age` 0                                                     |
| Request change | `request_age` 0                                                   |
| Frozen bus     | process interval does not advance that bus (G7)                   |
| Encoding keys  | still rejected by G4                                              |
| OTEL           | `t2.scm.clock.advance` observational; provider identity unchanged |

## Package / files (design intent)

```text
docs/scm/g8/
  authorization.md, decisions.md, README.md, manifest.json
  framing-parameters.json

apps/server/src/scm/
  g8SharedClock.ts          # producer, nextAges, clock, package loaders
  g8SharedClock.test.ts
```

## Out of scope

- G9 shadow parity, G10 cutover, codec, Kuato, D16 store
- Halt-initiator `yes` on G3
- Production clock domains
- Wire values for `modifier_start` / `null`

## Acceptance criteria

1. Named producer exists; not a node_id.
2. Age/repeat table is tested as integers.
3. Framing parameters recorded; no encodings.
4. Process interval vs fundamental timestep distinction holds.
5. Frozen DIP buses are not clocked.
6. OTEL observes advances only.
7. G8 package does not authorize G9–G10.

## Open plan choices

None. File names follow the existing gate pattern: `apps/server/src/scm/g8SharedClock.ts` plus
`g8SharedClock.test.ts`, and package files under `docs/scm/g8/` (same shape as
`docs/scm/g6/` / `docs/scm/g7/`). No `g8Ages.ts`. `nextAges` and `loadG8Package`
live in `g8SharedClock.ts` (same as G4/G5 keeping types+package in one gate file).

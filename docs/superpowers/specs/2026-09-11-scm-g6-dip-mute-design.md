---
title: SCM G6 DIP mute design
date: 2026-09-11
status: design-approved
plan: docs/superpowers/plans/2026-09-12-scm-g6-dip-mute.md
scope: G6 DIP mute on in-process receiving buses
authorization: docs/scm/g6/authorization.md
decisions: docs/scm/g6/decisions.md
checkpoint: 4e4571e30
review: incorporates 2026-09-12 precedence / authority-mismatch / mute-law clarifications
---

# SCM G6 DIP mute design

## Purpose

Enforce D12 mute law on in-process SCM receiving buses: a receiving bus may
mute same-or-lower authority sources; it must not mute greater authority;
authority-bus traffic is mandatory and unmutable. Prove `mute-source` and
`mute-modifiers` using the existing two-home-bus surface, including steward
modification of DIP position (mute one side / both / none).

This completes the G6 definition/prototype gate for DIP mute. It does not
complete G7–G10, codec, live cutover, or claim that `g6HomeBusLink` alone is
G6.

Human authorization: `docs/scm/g6/authorization.md`. Binding decisions:
`docs/scm/g6/decisions.md`.

## Existing constraints

- G1–G5 complete. G6 human-authorized 2026-09-11. G7–G10 unauthorized.
- G4/G5 keep `g6toG10Authorized: false` (compound flag not flipped).
- W1 has no `authority_class` field. Classification derives from governed
  node/bus identity (G3 `baseline_authority` / DIP class columns).
- Write at `T` is readable at `T+1`. Open-loop: no ACK/retry.
- Bridge (`BidirectionalHomeBusLink`) is infrastructure, not a node. It
  preserves origin identity and adds no authority.
- OTEL observes only; it must not admit, route, mute, satisfy, or halt.
- MVP DIP columns come from HHPE `dip-mute-and-aspect-matrix.md` (D12).
- Provisional class order: `A0` > `A1` > `A2` > `observer`.

## Chosen architecture

Attach a **DIP switch set** to each receiving home bus. Mute is evaluated only
on that bus’s **hear/read** path.

```text
publish / bridge forward  →  bus storage (unchanged)
                          →  hear/read applies DIP → heard word or silence
```

```text
authority bus (home-to-children, highest, unmutable)
        │
        ├── child home bus A  ↔  bridge  ↔  child home bus B
        │         DIP_A                         DIP_B
```

- **Bridge is not DIP-controlled.** Forwarding continues regardless of mute.
- **Publish is not DIP-controlled.** Muted peers keep writing unchanged.
- **Hear is DIP-controlled.** Receiving bus population filters at read time.

Prefer extending `InProcessOpenLoopBus` (or a thin hear-facade over it) over a
new framework. Reuse G5 storage and G6 home-bus link as the proof surface.

## Why hear-time mute (not write-time)

Mute is a receiving-bus population control. Writers must not change behavior
when a peer mutes them. Bridged buses may remain linked while one side refuses
to hear the other. That matches ethos DIP switches and the human binding:
infra share ≠ mandatory hear.

## Authority model for this slice

| Role             | Shape                                                                   | Mute                                |
| ---------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| Authority bus    | Home-shaped; permanent highest precedence; home relative to child homes | **Cannot be muted**                 |
| Child home buses | `bus.scm.a`, `bus.scm.b` (A2); children of authority                    | May mute each other when same/lower |

Prototype proof surface:

- One authority bus (existing `bus.control` or dedicated `bus.scm.authority`
  — plan picks one concrete id; default recommendation: `bus.scm.authority`
  with one `node.scm.authority` at `baseline_authority` A0 or A1-as-authority
  parent for the SCM prototype; if reusing `bus.control`, document that reuse).
- Two child homes already placed: `bus.scm.a` / `bus.scm.b`,
  `node.scm.home-a` / `node.scm.home-b` (A2).
- Bridge routes between the two child homes remain as today.

Hear-time class lookup:

1. Receiving class = DIP `receiving_authority_class` (must match receiving
   bus’s governed class).
2. Source class = DIP `source_authority_class` for the switch under evaluation,
   cross-checked against governed class of the word’s **origin** `node_id` /
   `bus_id` (preserved through bridge).
3. Never read class from W1. Never elevate via bridge or destination bus name.

## DIP row contract

MVP columns (steward-authored; position mutable in this slice):

```text
receiving_bus_id
receiving_authority_class
source_bus_id
source_node_id          # concrete id or "*"
source_authority_class
mode                    # hear | mute-source | mute-modifiers
steward
runtime_mutable         # true allowed for steward/driver mutation in this T2 slice
```

Modes:

| Mode             | Hear effect                                                               | Suppressive? |
| ---------------- | ------------------------------------------------------------------------- | ------------ |
| `hear`           | Source admitted; full word (including modifiers)                          | no           |
| `mute-source`    | Source not admitted; hear returns absence for that origin                 | yes          |
| `mute-modifiers` | Source admitted; fundamentals preserved; modifier region empty/suppressed | yes          |

### DIP row identity and matching precedence

Row key (unique per receiving bus DIP set):

```text
(receiving_bus_id, source_bus_id, source_node_id)
```

`setDip` **rejects** a second row with the same key (no silent overwrite
unless the steward API is an explicit replace-by-key; either way there is never
more than one row per key after a successful mutation).

When hearing an origin word with governed `(origin_bus_id, origin_node_id)`:

1. Candidate rows: same `receiving_bus_id`, `source_bus_id == origin_bus_id`,
   and (`source_node_id == origin_node_id` OR `source_node_id == "*"`).
2. **Specificity:** a concrete `source_node_id` match **overrides** a `"*"`
   match for that source bus. Wildcard never wins when a concrete row also
   matches.
3. After specificity, **exactly one** row applies (or none).
4. That single row’s `mode` is the hear decision. There is no separate
   mode-dominance rule (`mute-source` vs `hear`): conflicting intents for the
   same target must use different keys and are resolved only by specificity,
   not by merging modes.
5. If no candidate row: default **hear** (fail-open receive), subject to the
   authority-parent hard rule that mute of the authority parent is impossible
   even if a row somehow claimed it (such a row cannot be installed).

Example:

```text
(A, B, *)      hear
(A, B, node-7) mute-source
```

Hearing `node-7` from B uses `mute-source`. Hearing any other B node uses
`hear`.

### Fail closed at DIP apply/set time

Reject mutation and retain the prior DIP set when any of:

1. **Mute-law (D12, G6 binding):** any **suppressive** mode
   (`mute-source` **or** `mute-modifiers`) where
   `source_authority_class` > `receiving_authority_class`.
   HHPE schema text highlighted `mute-source` only; this slice binds the
   broader D12 rule (“must not mute greater authority” / mandatory higher
   communication) to **both** suppressives. Modifier mute of a higher-class
   source is not exempt.
2. **Authority parent:** any mute targeting the slice’s authority parent bus /
   authority-class source treated as unmutable.
3. **Governed class mismatch (explicit):**
   - `receiving_authority_class` must equal the governed class of
     `receiving_bus_id`.
   - For concrete `source_node_id`, `source_authority_class` must equal the
     governed class of that origin node (and be consistent with that node’s
     home/source bus governance).
   - For `source_node_id == "*"`, `source_authority_class` must equal the
     governed class of `source_bus_id`.
   - Disagreement → **reject at `setDip`**, never install and defer to hear.
4. Empty ids, unknown mode, class not in `{A0,A1,A2,observer}`, duplicate key
   policy violation, or `runtime_mutable=false` row targeted by steward
   mutation API (static fixture rows may exist; mutation API only rewrites
   mutable rows).

Default for unlisted sources: **hear** (fail-open receive), except the slice’s
explicit authority-parent protection which cannot be overridden to mute.

Hear-time stale mismatch (governed class changed after a previously valid
row): do **not** apply suppression for that origin (admit / fail-open hear);
observe the anomaly. Never mute on a mismatched row.

## Hear / read semantics

Keep `publish` and bus storage semantics from G5.

Add hear API used by receivers and tests (name in plan; conceptual contract):

```text
hear(origin_node_id) -> W1Word | undefined
```

**Identity assumption for this slice:** origin `node_id` values are
**process-globally unique** under G3 governance (as with existing G5/G6
in-process maps keyed by `node_id`). Bridge preserves `node_id` across buses.
If a future surface allows bus-local reuse of node ids, the API must become
`hear(origin_bus_id, origin_node_id)`; that change is out of G6 unless
governance invents collisions.

Rules:

1. Load stored readable word for `origin_node_id` (T-1 visibility unchanged).
2. If none, return undefined.
3. Resolve the single applicable DIP row via matching precedence above
   (using the word’s origin `bus_id` + `node_id`).
4. If winning mode is `mute-source` → return undefined (not heard).
5. If winning mode is `mute-modifiers` → return word with modifier region
   cleared; fundamentals and origin identity unchanged.
6. Else (`hear` or no row) → return word as stored.
7. Illegal mute configurations never silently apply; they fail at DIP
   mutation (or, if stale at hear, skip suppression per above).

Bridge forward path must call storage/publish only — **not** hear. Destination
bus stores the forwarded word; local hear on destination applies that bus’s DIP.

## Modifier region for mute-modifiers proof

G4 today requires `modifier_start` / `null` placeholders and rejects unknown
extra fields. To prove `mute-modifiers` without a codec:

- Extend W1 with an optional ordered `modifiers: ReadonlyArray<string>`
  (default `[]`) sitting conceptually between `modifier_start` and `null`.
- **Prototype semantic representation only** — not a pre-codec wire model, not
  a durable modifier dialect, and not authorized to survive into G9/codec work
  without a new design. Tests may use steward tokens; production encoding
  remains out of scope.
- Empty modifiers ≡ no modifier content.
- Non-empty modifiers are test/steward tokens only — **not** wire encodings,
  nibble alphabets, or dictionary membership.
- `mute-modifiers` hear returns the same word with `modifiers: []` (and
  placeholders unchanged).
- Protected fundamentals remain: `bus_id`, `node_id`, `fundamental_state`,
  `state_age`, `request_age`, and `fundamental_request` when not canonical
  absence.

Negative: `mute-modifiers` must not strip fundamentals or origin identity.

## Steward DIP mutation

In scope:

```text
setDip(row) / removeDip(key) / listDip(receiving_bus_id)
```

- Steward/test driver may change DIP **position** while buses exist (including
  mid-scenario transitions across mute-one / mute-both / mute-none).
- Each successful mutation is observable on the T2 plane (see Telemetry).
- No durable DIP history product; in-memory steward state is enough for G6.
- Kuato must not write DIP rows.

## Required proof matrix

Using bridged `bus.scm.a` ↔ `bus.scm.b` (same A2 class):

| Case                          | DIP                                                                       | Expect                                                                        |
| ----------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| No mute                       | both `hear`                                                               | Each hears the other’s published/forwarded origins after T+2 as today         |
| Mute from one                 | A:`mute-source` B; B:`hear`                                               | A does not hear B; B still hears A; both still publish; bridge still forwards |
| Mute from both                | A mutes B and B mutes A                                                   | Neither hears the other; publishes and bridge continue                        |
| mute-modifiers                | A:`mute-modifiers` B (with non-empty modifiers on B origin)               | A hears B fundamentals; modifiers empty on hear; storage on B unchanged       |
| Higher/authority mute attempt | child tries any mute on authority parent                                  | Fail closed at DIP set; authority remains heard                               |
| Invalid class mute            | `mute-source` **or** `mute-modifiers` with source class > receiving class | Fail closed at DIP set                                                        |
| Class mismatch                | DIP `source_authority_class` ≠ governed class for source                  | Fail closed at DIP set; prior DIP retained                                    |
| Precedence                    | wildcard `hear` + concrete `mute-source` for same source bus              | Concrete wins for that node; wildcard applies to others                       |

Also prove: after mute, flipping DIP back to `hear` restores hear without
republish from the muted peer (readable storage already present).

## Telemetry (OTEL)

Observation only. Provisional names:

```text
t2.scm.dip.set
t2.scm.dip.remove
t2.scm.hear          # optional when hear admits
t2.scm.hear.muted    # when mute-source suppresses hear
```

Attributes (minimum):

```text
t2.scm.receiving_bus_id
t2.scm.source_bus_id
t2.scm.source_node_id
t2.scm.dip.mode
t2.scm.word_id          # when a word is involved
t2.scm.origin_node_id
t2.scm.origin_bus_id
```

Rules:

- Publish telemetry remains even when peers mute the publisher.
- Mute must be visible so diagnosis can recommend unmute.
- OTEL must not perform mute or alter DIP.
- No `setGlobalTracerProvider`; isolated T2 provider only; no T3
  `server.trace.ndjson` writes.

## Package / files (design intent)

```text
docs/scm/g6/
  authorization.md          # exists
  decisions.md              # exists
  README.md                 # gate status + non-goals
  manifest.json             # authorized, not completed; does not unlock G7–G10
  dip-fixtures.json         # steward rows for proofs (optional if code-built)

apps/server/src/scm/
  g6DipMute.ts              # DIP store, mute law, hear projection
  g6DipMute.test.ts
  g4Word.ts / g5OpenLoop.ts # minimal hooks: modifiers + hear integration
```

Exact filenames are plan-owned if a smaller surface works without new
abstractions.

## Failure isolation

- Invalid DIP mutation fails closed; prior DIP set retained.
- Mute never retracts a published or bridged word from storage.
- Route/bridge failures remain independent of DIP.
- Observation failure after hear/mute decision does not change bus state.

## Out of scope / non-goals

- Reprioritization / node attention ordering
- Runtime Kuato mute advice
- Halt / freeze (G7)
- Clocks / framing parameters (G8)
- Codec, nibble alphabet, production encoding
- Live fabric / cutover (G9/G10)
- Durable DIP persistence or audit product
- DIP controlling bridge forward
- Claiming home-bus link precursor completes G6
- Flipping G4/G5 `g6toG10Authorized` to true

## Acceptance criteria

1. Same-authority child homes can mute each other (one / both / none).
2. Publish and bridge forward unchanged under mute.
3. Hear omits `mute-source` origins; `mute-modifiers` clears modifiers only.
4. Authority parent cannot be muted; any higher-class suppressive mode
   (`mute-source` or `mute-modifiers`) fails closed at DIP set; DIP/governed
   class mismatch fails closed at DIP set.
5. Steward can modify DIP position and restore hear without peer republish.
6. T2 OTEL observes DIP changes and muted hears; global provider unchanged.
7. G6 package records authorized/in-progress-or-completed without authorizing G7–G10.
8. Focused tests cover the proof matrix; G1–G5 regressions remain green.

## Implementation authorization boundary

Receipt of an approved implementation plan plus this design (after human review)
authorizes G6 DIP mute code under `apps/server/src/scm/` and `docs/scm/g6/`.
It does not authorize G7–G10 or codec work.

## Locked plan choices

1. Authority bus id: `bus.scm.authority` / `node.scm.authority` (A0) via injectable
   `docs/scm/g6/governed-classes.json` (no G3 pin churn in the G6 plan).
2. `hear` sits beside `read`; `read` remains raw storage.
3. OTEL spans: `t2.scm.dip.set`, `t2.scm.hear.muted` (option-2 `word_id` join).

Implementation plan: `docs/superpowers/plans/2026-09-12-scm-g6-dip-mute.md`.

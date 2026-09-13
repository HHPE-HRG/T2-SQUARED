# G6 binding decisions (human, 2026-09-11)

Decisions recorded from Max Holden against the pre-plan checklist. These bind
design and the later implementation plan.

## Settled

### Auth

G6 is human-authorized. Docs that barred G6 must reflect that intent. G7–G10
remain barred unless separately authorized.

### Mute surface

Mute applies on **receive/hear** of a home bus.

The **bridge is not affected by mute**. Bridge is infrastructure that shares
terminology / delivery path across buses. Messaging/hear behavior is separate:
comms happen given infra. DIP does not configure or suppress bridge forwarding.

### Write vs read

Mute does **not** change publish/write behavior. A muted peer may keep
publishing unchanged. Mute only changes which writes a receiving bus **hears**
(reads). Example: buses remain bridged; home A mutes B; B still publishes; A
does not hear B.

### Same-authority mute matrix (required proof)

Using the two home-bus communications already present, prove:

| Case               | Intent                                           |
| ------------------ | ------------------------------------------------ |
| Mute from one side | A mutes B (or B mutes A); other side still hears |
| Mute from both     | A mutes B and B mutes A                          |
| No mute            | both hear                                        |

Same-auth-level buses (`A2` / `A2` for `node.scm.home-a` / `node.scm.home-b`)
must be able to mute each other under mute law.

### Mute modes in scope

- `mute-source` — same/lower allowed; higher forbidden / fail-closed
- `mute-modifiers` — **in scope**, not a deferred stub. Prove with the two-home
  bus surface (modifier mute cases included in the matrix above as applicable)

Suppressive modes = `mute-source` | `mute-modifiers`. D12 “must not mute
greater authority” applies to **both** (not mute-source only). See design
matching / mismatch / mute-law sections.

### Out of scope

- **Reprioritization** — separate system from DIP mute; leave out of G6 plan
- Halt (G7), clocks (G8), codec, live cutover
- Claiming home-bus link precursor completes G6
- Kuato mute advice
- Durable DIP persistence/audit product (mutation of position is in; store product is not)

### OTEL

OTEL remains observational and must **see mutes**. It does not admit, route, or
perform mute. Mute visibility exists so diagnosis can explain missing hears
(example: unmute A so B can receive the word it needs from node K on A).

## Authority comparison (human binding, 2026-09-11)

W1 words intentionally have **no** `authority_class` field. Classification is
derived from governed bus/node identity, not carried on the word.

Human binding for this slice:

- An **authority bus** is still a home-shaped bus, but with **permanent highest
  precedence**.
- Authority-bus traffic **cannot be muted**.
- Authority bus stands as **home relative to child buses**.
- Prototype **home buses** (`bus.scm.a` / `bus.scm.b`) sit as **children** in
  that relationship: they may mute each other under same/lower law; they must
  not mute the authority parent.

Lookup at hear time uses governed bus/node class (G3 `baseline_authority` /
DIP class columns), never a word-borne class, and never elevates via bridge
travel.

Placement facts already usable:

| Store            | Field                                                 | Example                                 |
| ---------------- | ----------------------------------------------------- | --------------------------------------- |
| G1 inventory row | `authority_class`                                     | `INV-T2-SCM-HOME-BUS-LINK` → `A2`       |
| G3 node          | `baseline_authority`                                  | `node.scm.home-a` / `home-b` → `A2`     |
| G3 topology      | `row_authority_class`                                 | must equal frozen G1 for that `comm_id` |
| DIP row          | `receiving_authority_class`, `source_authority_class` | mute-law inputs                         |

## DIP mutation (human binding — in scope)

Slice scope is:

1. **DIP rows** (MVP columns from the aspect matrix),
2. **Modification of DIP position** (changing switch mode / targets),
3. **Those switches mapping to other buses** (receive-side hear population).

DIP is not frozen-static-only: **position changes are part of G6**. Prove
mute-from-one / both / none by changing DIP while exercising the two home
buses. Steward (test/driver) mutation of DIP position is in. Durable
persistence/audit product and Kuato-driven writes remain out.

## Ethos Q6 residual (detail)

HHPE ethos still lists full schema/granularity/persistence/audit as open.

Closed for this slice:

- MVP DIP columns
- mute-law enforcement on hear/read
- modification of DIP position
- switches mapping onto other buses (peer home buses; authority parent unmutable)

Still deferred:

- durable DIP history store / full audit product
- finer granularity beyond `source_node_id` / `*`
- Kuato / adaptive attention writing DIP rows

## Artifact sequence (what this means)

Same as home-bus work, in order:

1. This authorization + decisions (here)
2. `docs/superpowers/specs/2026-09-11-scm-g6-dip-mute-design.md` — binding design (approved)
3. `docs/superpowers/plans/2026-09-12-scm-g6-dip-mute.md` — implementation plan
4. Code under `apps/server/src/scm/` + `docs/scm/g6/` fixtures/manifest

“Artifact layout” only meant: write the design before the task plan, and keep
G6 fixtures/DoD under `docs/scm/g6/`.

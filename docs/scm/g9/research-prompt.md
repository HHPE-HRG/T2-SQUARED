# G9 research prompt (shadow integration)

Copy everything below the line into a high-level coding/research model with
repo access. Goal: **bill of materials to complete G9 today**, treating G9 as
**shadow labeling + integration**, not cutover (G10) and not a greenfield
protocol design.

Do not implement G9. Do not flip `g9toG10Authorized`. Do not copy restricted
HHPE/Issue-9 verbatim text into git. Cite `T2-SQUARED-References/` by path.
Do not invent a codec.

---

## Role

You are researching T2-SQUARED to determine **everything required to complete
G9 as it stands in the gate plan**, given that G0–G8 prototypes already exist.
The human already knows the destination: inventoried live communications get
**shadow W1 labels** and are shown to be the same communication under SCM law,
while Effect RPC remains the live transport until G10.

You are **not** only hunting ambiguities. Return a **complete work list** to
finish G9 today: what already exists, what must be bound in one line, and what
must be built as integration.

## G9 as intended here (do not redefine)

- **In:** Map each in-scope G1 inventory row onto W1; **shadow** beside live
  RPC/catalog/streams; semantic/operational parity, not byte-identity with
  old RPC; equality is the WORK-000035 typed object (or an **explicit**
  deferred-IR stand-in if IR still does not exist).
- **Out:** G10 cutover/replace Effect RPC; codec/nibble/production encode;
  Kuato; freeze-store product; OTEL as bus.
- **Claim:** Operational fabric **claim** starts at G9 (shadow). Live
  replacement is G10. G0–G8 are definition/prototype, not “modules speak SCM.”

Source one-liners (plan, not to be weakened):

- `docs/plans/2026-08-23-002-feat-scm-dod-gates-plan.md` §G9, Product Contract
  (G9 maps inventoried comms onto W1; G10 is cutover; G5–G7 may wrap/project
  RPC in-process).
- Increment 5: `T2-SQUARED-References/.../reconciliation/increment-map.md`
  (parity at 035 equality object; needs Inc4 params + inventory + typed IR
  **or explicit deferred IR**).
- G2 gap: `docs/scm/g2/rationale.md` `G2-GAP-TYPED-IR`; inventory
  `equality_object: unspecified` on rows.

## How to research (order)

1. Read gate plan G9/G10, G2 rationale + `work-000035-disposition.json`.
2. Inventory: `docs/scm/g1b/inventory.json`, coverage, G1B README (do not
   claim the inventory is the unknowable universe).
3. Placement: `docs/scm/g3/inventory-topology.json`, node-roster, bus-roster.
4. Prototype APIs (treat as **reusable integration surface**, not rewrite):
   - G4 `apps/server/src/scm/g4Word.ts`
   - G5 `g5OpenLoop.ts` (timestep, publish/read, OTEL publish/receive)
   - G6 `g6DipMute.ts`, `g6HomeBusLink.ts`
   - G7 DIP bus-level freeze/halt + bridge obedience
   - G8 `g8SharedClock.ts` (`scm.fundamental-clock`, `nextAges`, framing JSON)
   - T2 OTEL `apps/server/src/t2Observability/`
5. Live comms named by inventory `symbols`: Effect RPC (`apps/server/src/ws.ts`,
   `RpcInstrumentation.ts`, `packages/contracts/`), HTTP env APIs, streams,
   queues, persistence, flags. For each mechanism class in G1A boundary,
   find the **actual call site** that would be shadowed.
6. Existing observation joins: catalog `SpanLink`, `t2.scm.word_id` (option 2).
7. Satisfaction / ACK: confirm G5 left requester satisfaction unresolved.

## Required output (use these headings)

### A. Already in place for G9 (reuse, do not rebuild)

Table: artifact | path | what G9 can consume.

Include: inventory rows, topology mappings, W1 checker, buses, DIP, halt,
clock/ages, OTEL helpers, any RPC wrap that already looks like a projection.

### B. Distilled bindings (one-liners still missing)

Things that are **decisions**, not large builds. Propose a candidate for each
from evidence, marked `evidence` vs `guess`.

Must cover at least:

1. Equality: wait for 035 IR vs **explicit deferred-IR** stand-in (what type,
   where it lives, how a shadow test compares two values).
2. Shadow vs live: where the W1 word is **emitted** (in-process bus after RPC
   handler? observer-only span with W1 fields? dual publish?).
3. Cadence: how “one word per active node per fundamental timestep” applies
   when the live path is request/response or a stream.
4. Satisfaction: omit, observe-only, or a named T2 rule.
5. Scope of “each inventory row”: all G1B rows this slice, a stewarded subset,
   or exclusions with rationale.
6. Equivalence test: what “shadow equivalence” pass/fail is (same
   `comm_id` + node/bus + slot tuple? Effect schema isomorphism? fixture
   vectors?).
7. Mute/halt/clock: does shadow respect DIP/freeze, or is shadow
   observational-only even when the live path continues?

### C. Integration work (not one-liners)

Concrete build list to finish G9 **today** if bindings in B were locked:

- New files/modules following `gNName.ts` + `docs/scm/gN/` naming.
- Per-`comm_id` (or per mechanism class) adapter: live event → W1 fields
  (`bus_id`, `node_id`, `fundamental_state`, `fundamental_request`, ages,
  modifiers/absence).
- Clock: who advances `scm.fundamental-clock` in a live server process vs
  tests.
- OTEL: shadow spans/events vs existing `t2.scm.publish` / catalog links.
- Tests: minimum matrix that would let a G9 package say `completed` without
  claiming G10.
- Docs/package: `docs/scm/g9/` authorization, decisions, manifest
  (`g10Authorized: false`).

### D. Per-row or per-class shadow map (sample, then method)

Do **not** map all 70+ rows by guess. Pick **3–5 representative** `comm_id`s
across mechanism classes (e.g. WS RPC, HTTP, stream, queue/persistence if
present). For each: `comm_id`, G3 node/bus, live symbol, proposed W1 slot
fill, what is unknown.

Then state the **repeatable method** to finish the rest of the inventory
without a new research pass.

### E. Blockers that prevent “complete G9 today”

Hard stops vs steward-decidable. Call out stale comments (e.g. G1B
`equalityNote` still saying G3 unauthorized after G3 completed).

Codec remains forbidden while equality is unresolved **unless** B.1 is an
explicit deferred IR that still forbids encode.

### F. Recommended G9 slice

Smallest integration that still **is** G9 (shadow labeling of inventoried
comms), not a rewrite of G4–G8. Name the first `comm_id`s and the package
DoD in one short checklist.

## Constraints

- Repo: `/Users/maxholden/T2-SQUARED` (branch may be `feat/t2-opentelemetry`
  or `main` after local merge). Canonical HHPE drop:
  `/Users/maxholden/T2-SQUARED-References` — cite, do not paste restricted
  prose into the git tree.
- Do not treat `g6HomeBusLink` or `g8SharedClock` as live fabric.
- Do not propose SocketCAN / ISO-11898 / nibble alphabet.
- Prefer existing identities (bus, node, DIP, bridge, named clock). Do not
  add a campaign/workload node to “have something for OTEL.”
- Return paths and types. No implementation unless asked after this research.

## Done when

A later implementer can write `docs/scm/g9/decisions.md` + a G9 design/plan
**without another codebase archaeology pass**, because A–F already name
reuse, one-line binds, integration tasks, and the first shadow slice.

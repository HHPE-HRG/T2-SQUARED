---
title: Software Communication Manifold (SCM) DoD gates - Plan
type: feat
date: 2026-08-23
topic: scm-dod-gates
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-plan-bootstrap
execution: code
origin: T2-SQUARED-References CAN packs (HHPE-HRG / HHPE CAN); T2 OpenTelemetry peer plane
status: requirements-approved
---

# Software Communication Manifold (SCM) DoD gates - Plan

**Document class:** a proposed T2-SQUARED adaptation derived from HHPE-HRG CAN law, with explicit T2-specific extensions and unresolved deltas.

It is **not** a strict restatement of the CAN bundle. It is **not** yet authority to treat SCM as canonical T2 vocabulary, and it does **not** claim that G0–G7 makes live T2 modules communicate through SCM as their fabric.

---

## Goal Capsule

- **Objective:** Propose how T2-SQUARED can apply HHPE-HRG CAN law as a runtime adaptation, starting from the shipped T2 OpenTelemetry peer plane, without treating observation as communication.
- **Product authority:** HHPE CAN current-canon, human disposition, inventory, increment map, WORK-000035 pin, and WORK-000052 ethos remain source law. This document may adapt that law for T2. Adaptations are labeled. They do not override source law.
- **Stop:** If a unit would ship a production codec, Increment-4 clocks, Kuatos, a freeze-store product, Issue-9 verbatim text in git, T3 payload copy into T2 spans, mute of a higher-authority source, or treat OTEL as admit/mute/route/satisfy/halt, stop.

This artifact is **requirements-only**. G3–G7 describe inherited invariants and candidate exit shapes. They are not authorizing runtime topology, authority assignment, satisfaction mechanism, or transport replacement until G1 (G1A + G1B) closes.

First authorized work, if this document is approved, is **G1A discovery-contract and evidence work**. It is not a test that claims total communication completeness. G1B enforcement comes after G1A evidence exists.

---

## Accurate summary

**SCM is the proposed T2-SQUARED runtime adaptation of HHPE-HRG CAN law.** HHPE CAN defines cyclic open-loop publication of W1 words on passive, memoryless logical buses: every active node publishes one word per fundamental timestep, receivers judge satisfaction, senders do not prove delivery, and buses retain no history. SCM is not ISO-11898, SocketCAN, or a DBC-based vehicle bus.

Existing T2 OpenTelemetry is proposed as SCM’s observation plane, not as the communication fabric. This OTEL binding, the SCM name, provisional `t2.scm.*` telemetry vocabulary, and T2 gate structure are new T2 decisions rather than inherited HHPE canon.

Before runtime definition proceeds, G1 must close a bounded, falsifiable inventory of every in-scope live T2 communication using the complete D15C schema, independently of current OTEL coverage. G1A freezes the boundary and evidence protocol. G1B materializes rows and mechanical checks. G2 must disposition every applicable WORK-000035 pin output; no codec may exist while typed equality remains unresolved. G3 consumes G1 rows, not G2.

G3–G7 form the proposed **SCM definition/prototype milestone**: node and bus mapping, W1 types without encodings, in-process open-loop behavior, DIP mute law, and halt/404 separation as a T2 safety extension. They do not establish that live T2 modules use SCM as their communication fabric. Live semantic parity and cutover remain G9 and G10 unless one narrowly scoped live projection is deliberately added later.

Use “one word per active node per fundamental timestep,” never “one word per tick.” A process tick is a separate logical interval that may span multiple fundamental timesteps.

---

## Authority split

| Class                       | Meaning                                                                                                                          | Examples                                                                                                                                                                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inherited HHPE law**      | Restated from current-canon / disposition / pin. T2 must not weaken these.                                                       | W1 slots; one word per active node per fundamental timestep; no sender ACK; passive memoryless buses; DIP mute of own/lower only; 404 cannot halt; 035 typed object is equality oracle; D15C before further authorizing definition; codec forbidden until pin outputs exist or are listed deferrals |
| **T2 extension (proposed)** | Compatible with CAN observer/fail-closed model, not required by the bundle. Must stay observational or be labeled safety policy. | Name “SCM”; OTEL as observation plane; provisional `t2.scm.*`; G0–G10 T2 gate numbers; G7 in first T2 prototype; extra T2 rule that Increment 4 also wait on G2 pin disposition                                                                                                                     |
| **Unresolved delta**        | Source leaves this open, or T2 currently over-specified it. Do not treat as inherited.                                           | How the requester observes satisfaction; whether next-timestep request clearing is required; production timestep producer; live-fabric cutover timing; SCM vs `canBus` naming                                                                                                                       |

Until a naming gate closes, **SCM is the proposed campaign/runtime name** for T2’s CAN adaptation. Lexicon token `canBus` remains the product-surface name. Provisional internal identifiers (`t2.scm.*`) are allowed only while marked provisional. Do not publish them as durable public vocabulary while naming is still open.

---

## Product Contract

### Summary

HHPE-HRG CAN is software communication theory: cyclic open-loop W1 words on passive memoryless buses, with ASD/T2 typed identity as the equality object.

T2 already has a peer observation plane (`service.name=t2-server`, owned ALS, catalog `SpanLink` to T3, NDJSON `t2.trace.ndjson`). The proposed adaptation uses that plane to observe SCM/CAN words. OTEL does not admit, mute, route, satisfy, or halt communication.

T2 modules today still communicate through T3-era Effect RPC and catalog boundaries. Those paths are observed. They are not SCM words. G9 maps inventoried communications onto W1. G10 is cutover. G5–G7 may wrap or project existing Effect RPC in-process. Passing G0–G7 therefore does **not** mean live T2 modules speak SCM as their fabric.

### Problem Frame

HHPE CAN is documentation-only. Increment 1–3 biographies are frozen. A 2026-08-13 reconciliation overlay is current law. D15C inventory rows are empty. WORK-000035 pin outputs are only partly materialized in T2.

Without a T2-owned ladder that separates inherited law from T2 extensions, later code will mix three mistakes: treat OTEL spans as the bus, treat RPC request/response as current CAN cadence, or copy HHPE Increment 1 ACK windows back as law.

### Actors

- A1. **T2 module / proposed SCM node:** A T2-facing identity. After a prototype bus exists, every **active** node publishes one W1 word per **fundamental timestep**.
- A2. **Proposed SCM bus:** Passive, memoryless logical transport. History belongs to observers, not the bus.
- A3. **T2 OpenTelemetry plane (T2 extension):** Independent provider. Proposed observer of word publish, receive, mute, freeze, and satisfaction judgments. Must not parent T3 traces. Must not be a control plane.
- A4. **T3 execution plane:** Unchanged. Join only with catalog `SpanLink`.
- A5. **10,000-foot steward:** Humans and human-controlled agents. Own permanent bus IDs, DIP rows, and halt. No runtime node owns the manifold.
- A6. **404 observer:** May recommend stop. Cannot halt.
- A7. **G1 steward:** Independent reviewer of the G1 inventory boundary, completeness manifest, exclusions, and exit. Not the author of the discovery pass. Does not own non-host HHPE systems.

### Key Flows

- F1. A T2 catalog or T2-owned effect still runs. T2 OTEL already emits a catalog bridge or owned span. That is observation of current transports, not SCM.
- F2. G1A freezes the inventory boundary and records discovery evidence per mechanism class. G1B then writes a completed D15C row (or governed exclusion) for every discovered path. OTEL wrappers are reconciliation checks, not the inventory universe.
- F3. After G3–G4 (provisional until G1 closes), a row _may_ map to `bus_id` + `node_id` + W1 slots. Equality is the 035 typed object, not RPC JSON and not English.
- F4. After G5 prototype: an active node publishes one word per fundamental timestep. The requester judges satisfaction. Repeat is republication, not a `request_age` bump. How B’s satisfaction becomes visible to A is an unresolved delta (see G5).
- F5. Proposed T2 observation: provisional `t2.scm.publish` / `t2.scm.receive` with CAN attributes. Receive correlation is defined in the observation contract below. Catalog `SpanLink` to T3 stays a separate join.
- F6. After G6 prototype: a receiving bus may mute own-or-lower authority. Higher-authority words remain mandatory, cannot be muted, and remain visible on receive telemetry.

### Requirements

Inherited unless marked T2:

- R1. **T2.** SCM is the _proposed_ T2-SQUARED runtime adaptation of HHPE-HRG CAN. Do not implement ISO-11898, SocketCAN, or vehicle DBC as that adaptation.
- R2. **T2.** Build observation from the existing T2 OpenTelemetry peer plane. Do not call `trace.setGlobalTracerProvider`, `provider.register()`, `NodeSDK.start()`, or T2 auto-instrumentation. OTEL must remain observational.
- R3. **T2.** Every prototype word publish, receive, mute, freeze, and satisfaction judgment is a T2-owned span or span event. Do not copy T3 span payload into words or T2 spans.
- R4. **T2.** Catalog T3↔T2 `SpanLink` stays 1:1 at the architectural catalog only. Word publish↔receive correlation is a second join, on the T2 plane, and must identify the word (see observation contract).
- R5. Lossless means typed controlled-language round-trip. Not original protocol bytes. Not original English. Not a CAN-local type system that bypasses T2 ASD-STE100.
- R6. Current word is W1: `bus_id`, `node_id`, `fundamental_state`, always-present `fundamental_request` (canonical absence allowed), independent `state_age` and `request_age`, placeholder `modifier_start`, later modifier tokens, placeholder `null`.
- R7. Current cadence is cyclic open-loop: **one word per active node per fundamental timestep**. A process tick is a separate logical interval and may span many fundamental timesteps. Increment 1 ACK windows and variable quiet cadence are historical.
- R8. Buses are passive and memoryless. Classes: home, authority, linked, permissioned workflow/child. A node has one home bus.
- R9. DIP mute: a receiving bus may mute own or lower authority. It must not mute greater authority. Higher-authority communication is mandatory. Heard-source fundamentals cannot be stripped. Permitted mute must not delete original publish telemetry.
- R10. Halt is a campaign function. 404 cannot halt. Bind halt to a `node_id` only after buses exist.
- R11. Populate a live T2 communication inventory on the full D15C schema before any further _authorizing_ definition, including Increment 4 clocks, Increment 5 shadow, and Increment 6 cutover. G1 splits into G1A (discovery contract and evidence) and G1B (rows and enforcement).
- R11a. **T2.** G1 inventory boundary is frozen in G1A before paths are discovered. In-scope means behavior-bearing communication that originates, terminates, or crosses a component boundary in the T2 server repository (`apps/server` and T2-owned surfaces it loads) and its declared runtime configurations. The boundary includes RPC, service interfaces, streams, queues, callbacks, persistence, process flags used for coordination, subprocess communication, files or databases used as communication state, and external transport. Pure computation and state confined to one owning component are excluded. Every exclusion is recorded with rationale and steward. The boundary is non-shrinkable: later discovery cannot redefine “in scope” to omit a class already declared.
- R11b. **T2.** G1 maintains a versioned completeness manifest. For each declared mechanism class, the manifest records the discovery procedure, retained results, resulting inventory rows, exclusions, steward, and review status.
- R11c. **T2.** Enumerated registries such as `T2_CATALOG_BOUNDARIES` receive executable reconciliation tests. Mechanisms without an authoritative registry (including free-form `withOwnedSpan` names) receive retained audit evidence and steward approval. Tests validate the manifest and its referenced rows. They do not claim to prove an unknowable universe.
- R11d. **T2.** Negative control: at least one known unwrapped communication path must be discoverable by the G1A procedure. Removing its inventory row must fail the relevant G1B reconciliation or completeness check.
- R11e. **T2.** G1 closes only when all declared mechanism classes have evidence, every discovered path has a completed D15C row or governed exclusion, and an independent steward (A7) approves the boundary and evidence.
- R11f. **T2.** If a live T2 equivalent of an HHPE inventory seed exists, inventory it. Otherwise reference the canonical HHPE inventory disposition. Do not assign new T2 stewardship to non-host systems solely to close T2 G1.
- R12. No production codec until every applicable WORK-000035 pin output exists or is an explicit listed deferral (gap id, steward, consequence, forbidden work).
- R13. Unexpected behavior fails hard and fail-closed, freezes relevant communication state, and preserves evidence for human or externally controlled correction. Durable freeze-store _product_ is deferred (D16). Freeze _behavior_ is not deferred.
- R14. Kuatos, freeze evidence-store product, nibble alphabet, and global dictionary schema are out of first definition MVP (D11).
- R15. Do not copy ASD-STE100 Issue 9 or private lexicon source into the T2-SQUARED git tree.
- R16. **T2.** Reconcile lexicon `canBus` with proposed campaign name SCM in a later naming gate. Do not treat a rename as runtime. Keep `t2.scm.*` marked provisional until that gate.

### Scope

**Proposed T2 definition/prototype milestone (G0–G7), after G1 closes:**

Matches HHPE D11 for word, open-loop, buses, and DIP. Halt/404 (G7) is valid source law but **not** one of D11’s four MVP elements; keeping it in the T2 prototype is a **T2 safety extension**.

- Inventory of every in-scope live T2 communication (D15C), via G1A frozen boundary + G1B rows.
- Provisional node/bus map (non-authoritative until G1).
- W1 slot model in T2 types (no wire widths).
- In-process open-loop publish/receive, observed by T2 OTEL.
- Stewarded static DIP structure and mute tests.
- Halt vs 404 split (T2 safety extension).
- Full WORK-000035 pin disposition record.
- Freeze _behavior_ tests; no freeze-store product.

**Not claimed by G0–G7:**

- Live T2 modules using SCM/CAN as their communication fabric.
- Semantic parity of inventoried communications onto W1 (G9).
- Transport replacement / cutover (G10).

**Deferred (source order):**

- Increment 4: clock producer name, age/repeat numeric table, null/modifier-start **parameters**, framing. Source gate: D5 closed (already on current-canon) **and** inventory populated. Extra T2 policy: also wait on G2 pin disposition (labeled below, not inherited).
- Increment 5: parity of inventoried communications onto W1 at the 035 object. Source also requires Increment 4 parameters and typed IR or explicit IR deferral.
- Increment 6: cutover/rollback after G9 shadow equivalence.
- Kuatos, freeze-store product, nibble dictionary, physical CAN, Kafka/B0 as the word.

**Out of product identity:**

- Nesting T2 traces under T3.
- Using OTEL as the bus or as a mute/halt/satisfaction path.

---

## Source law (cite, do not copy)

Canonical drop (not git): `T2-SQUARED-References/`.

Read in this order:

1. `CANbus-ideation-definition-export-2026-08-12/docs/architecture/communication-manifold/reconciliation/current-canon.md`
2. `.../reconciliation/human-disposition-2026-08-13.md`
3. `.../reconciliation/communication-inventory.md`
4. `.../reconciliation/increment-map.md`
5. `.../reconciliation/work-000035-pin.md`
6. `.../reviews/WORK-000052-post-increment-3-runtime-ethos-settlement.md` (ethos; evidence plus current cadence/time distinction)
7. Frozen biographies `WORK-000049` … `WORK-000051` under `.../reviews/` (evidence, not current law)
8. Baseline proposal `.../proposals/unified-can-manifold-language-and-bus-model.md`

HHPE GitHub org has no dedicated canbus repo. This pack is the source.

HHPE D-IDs stay HHPE IDs. T2 gates below are proposed adaptations.

---

## Starting point in T2-SQUARED (G0, observation only)

Shipped on `feat/t2-opentelemetry`. This is a T2 observation plane. It is not CAN and not SCM.

| Piece                                     | Where                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Peer provider, ALS, NDJSON, optional OTLP | `apps/server/src/t2Observability/`                                                                                                    |
| Catalog bridges                           | `rpc`, `orchestration`, `provider-turn`, `git`, `sqlite`, `terminal`                                                                  |
| Owned spans                               | `withOwnedSpan` (admission is the test example; evidence, ASD-STE100, authority, work-registry, realization/projection still to hook) |
| Join to T3                                | `SpanLink` only, `root: true`                                                                                                         |
| Local file                                | `t2.trace.ndjson` (never T3 `server.trace.ndjson`)                                                                                    |
| Env                                       | `T2CODE_TRACE_FILE`, `T2CODE_OTLP_TRACES_URL`, `T2CODE_OTLP_SERVICE_NAME` (default `t2-server`)                                       |

G0 does not make T2 modules speak CAN/SCM. It only preserves an isolated observer that later prototype words can emit into.

---

## Gate ladder

Legend: **path** = work that makes the next slice legal. **DoD** = check that slice is done. **Class** = inherited / T2 extension / provisional sketch.

G3–G7 remain a **non-authorizing requirements sketch** until G1 (G1A + G1B) closes. No T2 topology, authority assignment, satisfaction mechanism, or runtime contract becomes authoritative before that.

### G0. Observation substrate (T2 extension)

**Origin:** none in the CAN bundle. T2 peer-plane plan `docs/plans/2026-08-23-001-feat-t2-opentelemetry-peer-plane-plan.md`.

**Path:** Keep the T2 provider isolated. Provisional attribute namespace `t2.scm.*` only if marked provisional. Do not grow `ServerConfig` for SCM env. Do not let OTEL admit, mute, route, satisfy, or halt.

**DoD:**

- T2 spans still come from the T2 provider only.
- Catalog bridges still `SpanLink` T3; they still do not copy T3 payload.
- Missing T2 layer remains identity so existing tests keep running.
- New prototype tests can use `InMemorySpanExporter` without touching the global tracer provider.

**Still forbidden if G0 regresses:** any SCM/CAN prototype runtime work that depends on T2 OTEL.

### G1. Live communication inventory (D15C) — inherited hard gate

**Origin:** `communication-inventory.md`; D15C; WORK-000047 completion criterion.

D15C must exist before **any further authorizing definition**, not only before G8–G10. Empty seeds do not count.

G1 is two slices. **G1A** defines and evidences the universe. **G1B** materializes D15C rows and mechanical checks. First authorized work is G1A. A test that every `T2_CATALOG_BOUNDARIES` entry has a row is a G1B reconciliation check. It is not a proof that every live communication has a row.

Today `T2_CATALOG_BOUNDARIES` enumerates six catalog bridges. `withOwnedSpan` accepts any string and is not a complete owned-path registry. Streams, queues, persistence, relays, flags, and process boundaries do not share an authoritative catalog. G1A must therefore declare mechanism classes and discovery procedures _before_ treating discovered paths as the whole set.

Split until each distinct message/effect has its own row. Candidate T2 `comm_id` values below are **not** the universe; they are hints for G1B after G1A discovery.

| Candidate `comm_id` | Notes (not completeness)                                 |
| ------------------- | -------------------------------------------------------- |
| INV-T2-RPC          | RPC method / stream — only if live                       |
| INV-T2-ORCH         | orchestration command / event                            |
| INV-T2-PROVIDER     | provider turn                                            |
| INV-T2-GIT          | git execute                                              |
| INV-T2-SQLITE       | sqlite execute                                           |
| INV-T2-TERM         | terminal session lifecycle                               |
| INV-T2-ADMIT        | admission                                                |
| INV-T2-EVIDENCE     | evidence                                                 |
| INV-T2-STE          | ASD-STE100 check                                         |
| INV-T2-AUTH         | authority evaluation                                     |
| INV-T2-REGISTRY     | work-registry                                            |
| INV-T2-REALIZE      | realization / projection                                 |
| INV-T2-TEL          | T2 OTEL export itself                                    |
| …                   | other live paths found by G1A, including unwrapped paths |

Required D15C columns (all yes except `notes`):

| Column               | Required                                     |
| -------------------- | -------------------------------------------- |
| `comm_id`            | yes                                          |
| `source_system`      | yes                                          |
| `name`               | yes                                          |
| `owner`              | yes                                          |
| `sender`             | yes                                          |
| `receiver`           | yes                                          |
| `transport_boundary` | yes                                          |
| `authority_class`    | yes                                          |
| `equality_object`    | yes (`unspecified` only until 035 IR exists) |
| `home_or_authority`  | yes                                          |
| `notes`              | no                                           |

HHPE pack seeds are not T2-SQUARED. If a live T2 equivalent exists, G1B inventories it. Otherwise G1A/G1B **reference** the canonical HHPE inventory disposition. Do not assign new T2 stewardship to non-host systems solely to close T2 G1.

**Still forbidden after G0–G7 until G1 (A+B) exits:** Increment 4 clocks, Increment 5 shadow design, Increment 6 cutover definition, and any T2 claim that a node/bus/satisfaction/runtime contract is authoritative. Those remain blocked until G1 closes; they are not licensed merely by finishing G1A.

#### G1A. Discovery contract and evidence

**Class:** T2 closure protocol for inherited D15C.

**Inventory boundary (frozen in G1A, non-shrinkable):**

G1 covers behavior-bearing communication originating, terminating, or crossing a component boundary in the T2 server repository (`apps/server` and T2-owned surfaces it loads) and its **declared runtime configurations** (the configurations the T2 server actually ships and tests: process env, local vs relayed modes, and other modes named in T2 docs or config).

Included mechanism classes (closed list at G1A; adding a class reopens G1A, shrinking a class is forbidden):

1. RPC and other service interfaces
2. Streams
3. Queues
4. Callbacks
5. Persistence used as communication state (files or databases)
6. Process flags used for coordination
7. Subprocess communication
8. External transport
9. Other declared classes added only by G1A reopen

Excluded: pure computation; state confined to one owning component. Every exclusion must be recorded with rationale and steward.

**Discovery evidence:** a versioned completeness manifest. For each mechanism class, record:

- discovery procedure (repository search, runtime inspection, config enumeration, or named audit)
- retained results (paths, symbols, endpoints, stores)
- resulting inventory row ids (filled in G1B) or “pending G1B”
- governed exclusions
- steward
- review status

**DoD (G1A only — does not close G1):**

- Boundary text, runtime modes, and mechanism-class list are written and frozen.
- Communication vs internal Effect computation is defined with examples and counterexamples.
- Completeness manifest exists with a row per mechanism class, including procedures and retained results.
- At least one known **unwrapped** communication path is listed as a negative-control target.
- Independent steward (A7) has reviewed G1A (review may be “approved to proceed to G1B” without yet closing G1).

G1A tests may validate that the manifest exists, names every declared class, and references retained evidence files. They must **not** assert “every live communication has an inventory row.”

#### G1B. Inventory rows and enforcement

**Depends on:** G1A.

**Path:**

- Materialize a completed D15C row for every discovered path, or a governed exclusion.
- Reconcile `T2_CATALOG_BOUNDARIES` (`rpc`, `orchestration`, `provider-turn`, `git`, `sqlite`, `terminal`) to rows (executable).
- Add registries for other mechanically enumerable mechanisms where useful (owned-path names are a candidate; not required to invent a false-complete registry).
- Validate manifest-to-row coverage: every retained discovery result maps to a `comm_id` or exclusion.
- Negative control: removing the G1A unwrapped-path row fails the completeness or reconciliation check.
- Independent steward (A7) approves G1 exit.

**DoD (closes G1 with G1A):**

- Inventory lives in T2-SQUARED as a versioned artifact under T2 ownership. It does not copy the HHPE pack into git.
- Every discovered in-scope path has a completed D15C row or governed exclusion. Empty seeds fail.
- Catalog-bridge reconciliation tests pass. Manifest-to-row coverage tests pass. Negative-control test passes.
- Tests still do not claim an unknowable universe; they claim the frozen boundary, manifest, and rows are consistent.
- A7 has approved the boundary and evidence.

### G2. WORK-000035 pin disposition — inherited for codec; T2 record for all pin items

**Origin:** D3, D6, `work-000035-pin.md`. T2 ASD-STE100 **is** WORK-000035.

Deferring only typed IR does not disposition the pin. G2 requires a versioned disposition record covering every applicable pin output:

| Pin output                               | If present       | If absent                                                |
| ---------------------------------------- | ---------------- | -------------------------------------------------------- |
| Versioned controlled-language profile    | evidence pointer | gap id, steward, consequence, work forbidden by deferral |
| Owner-attributed term dictionary         | evidence pointer | same                                                     |
| Typed semantic bindings (encoder IR)     | evidence pointer | same                                                     |
| Outward-communication enforcement        | evidence pointer | same                                                     |
| Controlled-language equivalence fixtures | evidence pointer | same                                                     |
| Explicit enforcement cutover             | evidence pointer | same                                                     |

Capture point (still TBD in the pin): typed IR **after** T2 governed translation, **before** CAN encode.

**DoD:**

- Disposition record exists and lists all six rows.
- Codec remains forbidden while typed equality is unresolved (no IR and no explicit IR deferral).
- SCM/CAN types must not invent a parallel meaning system.
- No production encode of English or T3 payload.

**T2 delta (informed, not inherited):** this proposal permits **non-codec** G4–G7 prototype work (types, in-process open-loop, DIP tests, halt/404 tests) after G1 closes and after the G2 _record_ exists, even if some pin rows are listed gaps — provided those gaps name the forbidden work (at least: codec, nibble alphabet, global dictionary, production encode). If a gap forbids more than codec, G4–G7 must respect that gap.

G2 does **not** block G3. G3 consumes G1 inventory rows. G2 consumes the 035 pin. They may proceed in parallel after G1.

**Still forbidden throughout G0–G7 and after G2 while typed equality is unresolved:** any SCM/CAN codec; production encode of English or T3 payload. Silent skip of pin items remains forbidden after the G2 record exists.

### G3. Node and bus map (provisional sketch)

**Origin:** Increment 2 biography (frozen); D9 roster; D11 buses in first definition MVP.

**Class:** inherited invariants; T2 topology assignments stay provisional until G1. G3 depends on G1 rows, not on G2 pin outputs.

**Inherited invariants:** a node is the CAN-facing identity of a component; each node has one home bus; the manifold is not a runtime-owned node; permanent bus IDs are stewarded.

First T2 sketch (not topology law):

| Surface                                           | Candidate node       | Likely bus class              |
| ------------------------------------------------- | -------------------- | ----------------------------- |
| RPC                                               | `node.rpc`           | home or permissioned workflow |
| Orchestration                                     | `node.orchestration` | authority or home             |
| Provider                                          | `node.provider`      | home                          |
| Git                                               | `node.git`           | home                          |
| SQLite                                            | `node.sqlite`        | home                          |
| Terminal                                          | `node.terminal`      | home                          |
| Admission / evidence / STE / authority / registry | T2-owned nodes       | authority or home             |
| T2 OTEL exporter                                  | observer node        | observer                      |

Unplaceable Increment 2 functions stay `unplaced` / `open`. Do not guess halt initiator `node_id` before buses exist.

**DoD (prototype, non-authoritative until G1):**

- Every G1 row names a `node_id` or `unplaced`.
- Home vs authority vs linked vs child is assigned or `unknown` with a steward.
- A test asserts: a node has exactly one home bus; origin `bus_id` on a word is that home bus.
- Roster halt-initiator column exists. 404 row is `no`.

**Still forbidden throughout this milestone:** binding halt to a concrete `node_id`; claiming a process-global singleton is “the bus.” Halt binding remains later (Increment 4/6 placement).

### G4. W1 word as T2 types (inherited slots; no encodings)

**Origin:** D4, D7, D8; word-layout W1.

**DoD:**

- A T2-owned W1 type exists with the ethos slots.
- Canonical absence for `fundamental_request` is a named value, not a missing field.
- `state_age` and `request_age` are independent.
- `modifier_start` and `null` exist as placeholders with **no** wire numbers.
- Tests reject W0 (optional omitted request, single life counter) as current law.

**Still forbidden throughout G0–G7:** nibble alphabet, global dictionary schema, Node Kuato authorship of words. Completing G4 does not license those.

### G5. Open-loop publish observed by OTEL (inherited cadence; T2 observer)

**Origin:** D5; ethos WORK-000052; Increment 1 biography as historical mapping for ACK/silence → age/repeat/satisfaction.

**Cadence (inherited):** every active node publishes one word per **fundamental timestep**. A write at `T` is first readable at `T+1`. Senders do not prove delivery. A requesting node repeats an unsatisfied request on the next fundamental timestep. Repeat is live publication, not an increment of `request_age`.

**Process tick (inherited distinction):** a process tick is a declared logical unit of progress. It may span one or many fundamental timesteps. Tests and APIs must not use “tick” as a synonym for fundamental timestep.

**Satisfaction (unresolved in source):** the requester determines satisfaction. Source does not define how B’s satisfaction becomes observable to A, and does not require A’s next word to clear to canonical absence. G5 inherited tests cover **unsatisfied repetition only**.

**T2 delta (only if later chosen, must be labeled new adaptation law):** a non-ACK satisfaction observation rule, and/or next-fundamental-timestep clearing to canonical absence. Not current inherited DoD.

OTEL tracking is a T2 extension; see observation contract.

**DoD (prototype):**

- A test **fundamental timestep** advances. Two nodes on one in-process bus: A publishes a request; B does not satisfy; A’s next word repeats the request; `request_age` does not bump from repeat alone.
- No delivery ACK API exists.
- T2 in-memory exporter shows publish (and receive, if a receive path exists in the prototype) with CAN attributes. Global tracer provider identity is unchanged.
- Do **not** require “when B satisfies, A’s next `fundamental_request` is canonical absence” unless the T2 delta above is explicitly adopted.

**Still forbidden throughout G0–G7:** treating RPC success as CAN/SCM satisfaction; bringing Increment 1 confirmation windows back as current law; writing prototype spans into T3 `server.trace.ndjson`; using “one word per tick” as the cadence rule. Completing G5 does not license those.

### G6. Buses + DIP mute (inherited)

**Origin:** D11, D12.

**Path:** Logical buses in-process. Several buses may share one Node process. Default: no peer home-to-home unless stewarded. Authority-to-home is required. MVP mutes are stewarded and static (`runtime_mutable=false`).

Two mute layers (do not collapse):

1. Source mute: the receiving bus does not admit a source.
2. Field mute: if heard, fundamentals stay.

**DoD:**

- Receiving bus may mute same/lower authority source.
- Receiving bus **cannot** mute higher authority. Higher-authority required traffic remains visible on **receive** telemetry.
- Permitted same/lower mute does **not** delete original **publish** telemetry.
- Heard-source fundamentals cannot be stripped. Modifier mute is allowed once modifiers exist (placeholder now).
- Reprioritization of a heard word is not mute.
- Invalid DIP row (`mute-source` while source class > receiving class) fails closed in tests.

**Still forbidden throughout G0–G7:** runtime-mutable DIP; Kuato mute advice; using the OTEL exporter as a mute switch. Completing G6 does not license those.

### G7. Halt vs 404 — source law, T2 safety extension relative to D11

**Origin:** D10. Valid current law. **Not** one of D11’s four first-definition MVP elements (word, open-loop, buses, DIP). Included here as a T2 safety extension, not as “G0–G7 equals D11.”

**DoD:**

- 404 recommendation does not halt the bus.
- Halt API is not callable from observer-class nodes.
- `node_id` for halt initiator may remain `open` until buses are placed.
- T2 spans record recommend-stop vs halt as distinct events.
- Unexpected identity/token/binding fails closed and **freezes** relevant communication state (behavior required; freeze-store product deferred).

**Still forbidden throughout G0–G7:** observer spans that halt; telemetry that halt.

### G8. Clocks and framing parameters (Increment 4) — blocked

**Origin:** increment map; D8, D13, D14.

**Inherited gate:** current-canon D5 closed (already) **and** G1 (G1A + G1B) closed.

**T2 extra safety policy (not source-derived):** also wait on G2 pin disposition record before Increment 4 implementation. Source maps typed IR / IR deferral as Increment 5 prerequisite, when communications map onto W1.

**Path (not open):** timestep producer name, age/repeat numeric table, null and modifier-start **parameters**, framing. Still no Kuatos, no freeze-store product.

### G9. Parity onto W1 (Increment 5) — blocked

Map each inventory row onto W1 at the 035 equality object. Shadow design. Semantic/operational parity, not byte-identity with old RPC.

This is where inventoried live communications become W1 words. **Operational fabric claim starts here, not at G7.**

### G10. Cutover (Increment 6) — blocked

Cutover/rollback only after G9 shadow equivalence. Do not replace Effect RPC in G5–G7. G5–G7 may wrap or project RPC onto words in-process. Replacement is G10.

### Deferred-systems (not first definition MVP)

Kuato training, closed-loop node/bus-Kuato, automatic candidate promotion, auto-recovery, freeze evidence-store **product**. Freeze **behavior** stays in G7/ethos.

---

## Native tracking contract (T2 extension)

OTEL is proposed as observer only. It must not admit, mute, route, satisfy, or halt.

**Correlation (choose one; current mixed contract is invalid):**

A `SpanLink` targets a span context, not an individual event. Therefore the plan must not say “publish may be a span **or** an event” and also “receive `SpanLink` identifies that word” while multiple word publications are events on one episode span.

Pick exactly one:

1. **Word-span:** each linkable word publish has its own span context. Receive uses `SpanLink` to that publish span. Episode grouping may be a parent or a separate join.
2. **Word-id events:** per-word events carry a stable `word_id` / correlation id. `SpanLink` represents episode-level causality only. Word identity is the id, not the link.

Until an implementation plan picks (1) or (2), prototype tests must not require receive `SpanLink` to identify a specific word published as an event on a shared episode span.

| Communication fact            | Proposed T2 observation                               | Not                                      |
| ----------------------------- | ----------------------------------------------------- | ---------------------------------------- |
| Word publish                  | T2 span (option 1) or event with `word_id` (option 2) | T3 child span                            |
| Word receive                  | matching link **or** `word_id`, per chosen option     | Shared trace id with T3                  |
| Permitted mute                | T2 event/attribute on receive; publish retained       | Deleted publish telemetry                |
| Illegal higher-authority mute | must not occur; receive still shows the word          | “muted higher-priority-required traffic” |
| Satisfaction                  | T2 event/status if T2 defines observation; else omit  | RPC ACK; invented next-word clear        |
| Freeze                        | T2 event + fail-closed state                          | Halt by telemetry                        |
| Catalog cause                 | existing catalog bridge + T3 `SpanLink`               | Nested T2 under T3                       |
| 404 recommend                 | T2-owned observer span                                | Halt                                     |

Do not add a second tracer provider. Same T2 `BasicTracerProvider`, same ALS, same `t2.trace.ndjson`. A sibling `t2.scm.ndjson` is a later design question; it must still be T2-owned and must not write T3 files. `t2.scm.*` names stay provisional until the naming gate.

---

## Build order

```text
G0 T2 OTEL observer (shipped; not CAN)
    → G1A discovery contract, frozen boundary, completeness manifest
    → G1B D15C rows, mechanical reconciliation, negative control
         [G1 closes on A7 approval]
    ├── G2 pin disposition (does not consume inventory rows)
    └── G3 provisional node/bus mapping (consumes G1 rows)
G2 + G3 → G4–G7 where applicable
         (G7 is T2 safety extension relative to D11;
          G3–G7 non-authoritative until G1 closes)
    ── inherited block ──
    G8 Increment 4 clocks (source: G1 + D5; T2 extra: G2 record)
    → G9 Increment 5 live parity onto W1
    → G10 Increment 6 cutover
```

First authorized work after requirements approval: **G1A** (boundary, mechanism classes, discovery procedures, versioned completeness manifest, governed exclusions, steward review). That work must not be described as a test proving total communication completeness.

G1B follows G1A. Do not start G3–G7 as authorizing implementation until G1 closes. Sketch types are allowed if marked provisional. G2 may run in parallel with G3 after G1.

---

## HHPE D-ID → T2 gate

| HHPE                         | T2 gate          | Note                                                            |
| ---------------------------- | ---------------- | --------------------------------------------------------------- |
| D1 reconciliation first      | this document    | No Inc 4/5/6 biography until G1                                 |
| D2 frozen bios + overlay     | cite pack        | Do not rewrite biographies in git                               |
| D3 / D6 035 equality         | G2               | Full pin disposition, not IR-only                               |
| D4 / D7 W1 slots             | G4               | Types + negative tests; no encodings                            |
| D5 open-loop                 | G5               | One word per active node per **fundamental timestep**           |
| D8 placeholders              | G4 / G8          | No wire values in G4                                            |
| D9 roster                    | G3               | `unplaced`/`open` allowed                                       |
| D10 halt                     | G7               | Source law; T2 includes it before D11 would require             |
| D11 first MVP                | G4–G6 (+ buses)  | Word + open-loop + buses + DIP. Not G7. Not live fabric.        |
| D12 mute                     | G6               | Own/lower only; higher cannot be muted                          |
| D13 clocks after D5 on canon | G8               | Source blocked on G1                                            |
| D14 4/5/6 only               | G8–G10           | 7–14 retired                                                    |
| D15C inventory               | G1A + G1B        | Boundary frozen before discovery; wrappers are not the universe |
| D16 freeze store             | deferred product | Freeze **behavior** still required                              |

---

## Assumptions

- T2-SQUARED remains the implementation home. HHPE-CORE registry bind (`WORK-000047` depends on T2 035 SHA; proposed `WORK-000053`) is documentation/registry work, not a T2 runtime unit.
- In-process logical buses are enough for a G5–G7 _prototype_. Shared memory, unix sockets, and Kafka-as-word are later.
- `apps/server` may host many logical nodes and buses in one process (provisional until G1).
- Cardinality/sampling is deferred. Prototype tests must still see every word in the in-memory exporter.
- Option 1 vs option 2 for OTEL word correlation is deferred to the first implementation-ready plan.

## Open Questions

- OQ1. **Blocking for G8+.** Who produces the production **fundamental timestep** in a Node/Effect server?
- OQ2. **Blocking for G2 full IR.** What is the first typed IR (orchestration command vs admission vs git execute)?
- OQ3. **Deferred.** Same `t2.trace.ndjson` vs sibling file. `t2.scm.*` remains provisional.
- OQ4. **Deferred until G1.** Is `apps/server` one home bus with many nodes, or many home buses in one process?
- OQ5. **Deferred naming gate.** Campaign name SCM vs lexicon `canBus` / CLI `can-bus`.
- OQ6. **Unresolved source delta.** Satisfaction observation and request-clearing timing. Inherited G5 tests only unsatisfied repeat.
- OQ7. **Product choice (does not block this requirements artifact).** Keep G0–G7 as definition/prototype only, or add one narrowly scoped live projection to MVP while leaving full parity/cutover at G9/G10?
- OQ8. **OTEL correlation (does not block this requirements artifact).** Word-span (option 1) vs word-id events (option 2).
- OQ9. **Deferred to G1A execution.** Name the independent G1 steward (A7) for the first completeness review. Default: the human operator of this campaign.

---

## Definition of Done

### Definition/prototype milestone (G0–G7)

This milestone is done when:

1. G1A freezes a non-shrinkable inventory boundary and completeness manifest; G1B materializes full D15C rows, reconciles enumerated registries, validates manifest-to-row coverage, and passes a negative control. An independent steward approves G1 exit. Catalog/owned-span checks remain reconciliation, not the universe (G1).
2. A WORK-000035 disposition record covers all six pin outputs; codec remains forbidden while typed equality is unresolved (G2).
3. Provisional node/bus map exists; origin identity is home-bus + node; assignments are not treated as live fabric law (G3).
4. W1 exists as T2 types with canonical absence and dual ages; W0 is rejected (G4).
5. In-process open-loop publish works: one word per active node per fundamental timestep, no ACK, unsatisfied request repeats without aging from repeat alone; T2 OTEL records it observationally (G5).
6. DIP mute law holds: higher-authority required traffic cannot be muted and remains visible on receive telemetry; permitted mute does not delete publish telemetry (G6).
7. 404 cannot halt; halt is not an observer or telemetry side effect; fail-closed freeze **behavior** is tested (G7, T2 safety extension vs D11).
8. No Issue 9 verbatim in git. No T3 payload copy. No second global OTEL provider. OTEL cannot admit/mute/route/satisfy/halt.
9. Increment 4/5/6, Kuatos, and freeze-store product are still out.

This is **not** “T2 modules actually speak SCM.” That claim waits on G9/G10, or on an explicit later decision to add one live projection to MVP (OQ7).

### Operational fabric (not this artifact’s campaign DoD)

- G9: inventoried live communications map onto W1 at the 035 object with shadow equivalence.
- G10: cutover/rollback so chosen T2 modules communicate through the manifold rather than only through wrapped Effect RPC.

---

## Appendix — what not to copy

Do not put into T2-SQUARED git: ASD-STE100 Issue 9 body, private lexicon SQLite, restricted OCR, or wholesale HHPE biography text. Cite the drop folder. Paraphrase law as T2 gates, and label T2 extensions as T2 extensions.

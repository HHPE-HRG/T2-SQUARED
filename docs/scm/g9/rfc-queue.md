# G9 RFC queue

<!-- Agent: Manager answers RFCs as they come up. Redispatch only after 10 answered in batch. -->

**Resolver:** G9 Manager (not human), per operator 2026-10-17.
**Answer policy:** Answer **immediately** when an RFC is opened. Never leave `status: open` for a human or for a later session.
**Redispatch gate:** Do not dispatch Worker/Reviewer/Planner triplets until **10** RFCs have clear Manager answers in one answered batch (or the operator lifts the freeze).
**Human interrupt:** Disabled for RFC resolution.

Current open count: **0**.
Prior batch (RFC-001–010): **10 / 10** complete.
Prior batch (RFC-011–020): **10 / 10** complete (adversarial seal residual; Worker/Reviewer/Planner redispatch gated until 10/10; adversarial seal panel is not a triplet).
Current batch toward redispatch (RFC-021+): **3 / 10** (RFC-021 execution contract; RFC-022 generator gates; RFC-023 ownership repair after wave-8 A5).

## Schema

```text
id:
wp:
unit:
opened_at:
status: open | answered | applied | wont_change
question:
worker_claim:
reviewer_position:
planner_position:
options:
manager_answer: (chosen option + rationale; Manager is resolver)
answered_at:
applies_to_paths:
```

`human_answer` is obsolete for this queue. Use `manager_answer`.

## Open items

(none)

## Closed items

### RFC-001

- id: RFC-001
- wp: WP1–WP4 / later runtime
- unit: U1
- opened_at: 2026-10-17
- status: applied
- question: At runtime authorization, is the public entry module a single `g9ShadowParity.ts` re-export, or the foundation File Map modular `g9*.ts` split without a mandatory monolith name?
- worker_claim: File Map modular split is the implementation split; design name is canonical narrative.
- reviewer_position: Accept U1; C1 stays open until implementation planning closes naming (non-blocking for definition).
- planner_position: Accept U1; File Map sufficient for later tasks; RFC only if single entrypoint re-export required.
- options:
  - A: Modular File Map only; design name is documentation alias
  - B: `g9ShadowParity.ts` re-exports modular modules
  - C: Single-file coordinator named `g9ShadowParity.ts` (rejects modular File Map)
- manager_answer: **B**. Design keeps the canonical public name `g9ShadowParity.ts`. Foundation File Map modular `g9*.ts` files are the implementation split. `g9ShadowParity.ts` (and WP7 bootstrap wiring) re-exports / composes those modules. Reject C (monolith). Reject A (drops the design public name).
- answered_at: 2026-10-17
- applies_to_paths: docs/scm/g9/wp1-wp4-foundation-cohesion.md; docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md; docs/superpowers/specs/2026-09-26-scm-g9-shadow-parity-design.md; docs/scm/g9/cross-wp-cohesion-index.md

### RFC-002

- id: RFC-002
- wp: WP6
- unit: U3
- opened_at: 2026-10-17
- status: applied
- question: Should RpcServer admit/unary/stream phases be added to `coverage-validation.json` `planned_typed_hooks` (or a sibling machine array) before implementation, or remain text-only in the WP6 plan until WP8?
- worker_claim: Text contracts in WP6 §2.2 are enough for definition; machine array currently lists four MCP/OTLP hooks only.
- reviewer_position: Accept U3; §9 items are RFC-track, not blocking.
- planner_position: Accept U3; resolve machine tracking before implementation kickoff if validation must mirror full hook inventory.
- options:
  - A: Extend `planned_typed_hooks` (or sibling) via generator before runtime auth
  - B: Keep text-only until WP8; validation stays four-row machine set
- manager_answer: **A**. Before any runtime authorization, extend machine tracking via `regen_coverage_ledger.py` (preferred: sibling array if changing `planned_typed_hooks` shape is risky) so RpcServer admit/unary/stream phases are machine-visible. Do **not** hand-edit `coverage-validation.json`. WP6 §2.2 text contracts remain authoritative until that regen lands. Status stays `answered` until regen applies (`applied`).
- answered_at: 2026-10-17
- applied_at: 2026-10-18
- apply_note: Regen set `rpc_pair` phases to `planned-typed-hook` with `capture_module: apps/server/src/ws.ts`. `planned_typed_hooks` is **21** rows (17 RpcServer + 4 MCP/OTLP). Post-regen sole `captureOccurrence` owner is **WP6** (RFC-012 flip).
- applies_to_paths: docs/superpowers/plans/2026-10-17-scm-g9-wp6-typed-hooks-plan.md; docs/scm/g9/coverage-validation.json; docs/scm/g9/regen_coverage_ledger.py

### RFC-003

- id: RFC-003
- wp: WP7
- unit: U4
- opened_at: 2026-10-17
- status: applied
- question: When runtime is later authorized, how is production G9 Layer activation gated while keeping “G9 absent = today’s live” as the default?
- worker_claim: Prefer two-mode absent/present until RFC; env/settings vs always-merged-but-stopped waker listed as open.
- reviewer_position: Accept U4; §10 are RFC candidates, not normative TBD.
- planner_position: Accept U4; activation gate deferred to implement-time RFC; does not block definition.
- options:
  - A: Explicit env/settings opt-in merges G9 Layer; default absent
  - B: Layer always merged; waker stopped and capture unwired until arm flag
  - C: Decide only at runtime authorization with a short addendum
- manager_answer: **A**. Default is G9 Layer **absent** (today’s live path unchanged). Opt-in env/settings merges the G9 Layer (present). No third “merged but unwired” mode. Reject B (always-merged changes default composition). Reject C (decision is made now for definition cohesion).
- answered_at: 2026-10-17
- applies_to_paths: docs/superpowers/plans/2026-10-17-scm-g9-wp7-composition-plan.md; docs/scm/g9/cross-wp-cohesion-index.md

### RFC-004

- id: RFC-004
- wp: WP8 / docs
- unit: U5
- opened_at: 2026-10-17
- status: applied
- question: Should `docs/scm/g9/integration-readiness.md` §7 prose saying “788” fixtures be updated to **790** to match `coverage-validation.json` `counted_fixture_vector_count`?
- worker_claim: Validation JSON 790 is authoritative; prose sync is docs-only at regen time.
- reviewer_position: Accept U5; note prose sync at regen.
- planner_position: Accept U5; §9 item 8 is doc sync only.
- options:
  - A: Edit integration-readiness.md now to 790
  - B: Sync only on next ledger regen
- manager_answer: **A**. At answer time, `counted_fixture_vector_count` **790** was authoritative and prose was synced to that snapshot. **Current authority** is always the live `coverage-validation.json` count (currently **763** after the 2026-10-18 Bitbucket `extract_literals` fix). Do not treat the historical **790** in this answer as a freeze pin.
- answered_at: 2026-10-17
- applies_to_paths: docs/scm/g9/integration-readiness.md; docs/scm/g9/coverage-validation.json; docs/superpowers/plans/2026-10-17-scm-g9-wp8-exact-set-proof-plan.md

### RFC-005

- id: RFC-005
- wp: WP5 / WP6
- unit: U6
- opened_at: 2026-10-17
- status: applied
- question: Who is the sole serial editor of `apps/server/src/t2Observability/T2Observability.ts` for G9 capture/hook wiring when B2, B5, and WP6 all touch observer surfaces?
- worker_claim: U6 index flags C6 — avoid duplicate hooks at implementation; no prior RFC id.
- reviewer_position: Accept U6 after sync; RFC-005 non-blocking for definition.
- planner_position: Accept U6; RFC-005 pre-implementation serial ownership.
- options:
  - A: WP6 owns T2Observability.ts; B2/B5 hand off patches
  - B: B5 owns T2Observability.ts; WP6 OTLP hooks hand off
  - C: Split by symbol with an explicit merge owner named in cohesion index
- manager_answer: **A**. Sole serial editor of `T2Observability.ts` for G9 is **WP6-Consumer-Owner** (typed hooks / OTLP). B2 and B5 author patches in their family modules and hand off; they do not land concurrent edits on that file. Reject B (OTLP is WP6 full-row). Reject C (split-by-symbol invites dual landings).
- answered_at: 2026-10-17
- applies_to_paths: docs/scm/g9/cross-wp-cohesion-index.md; docs/superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md; docs/superpowers/plans/2026-10-17-scm-g9-wp6-typed-hooks-plan.md

### RFC-006

- id: RFC-006
- wp: WP6
- unit: U3 harvest
- opened_at: 2026-10-17
- status: applied
- question: Do unary/stream success hooks require Effect patch changes beyond server admit, or can they reuse handler wrappers in `ws.ts` only?
- worker_claim: WP6 §9 Q3 — patch owner decides with smallest live diff.
- reviewer_position: n/a (Manager harvest)
- planner_position: n/a (Manager harvest)
- options:
  - A: Prefer `ws.ts` wrappers for unary/stream; patch only admit seams that cannot live in consumers
  - B: All RpcServer hooks (admit/unary/stream) must be Effect-patch seams
  - C: Defer entirely until runtime authorization
- manager_answer: **A**. Smallest live diff: unary/stream post-success capture from `ws.ts` consumer wrappers when the live success boundary is already there; Effect patch only for admit (and any seam that cannot be expressed without patching Effect). Serial owner remains **WP6-Effect-Patch-Owner** for the patch file; **WP6-Consumer-Owner** for `ws.ts`.
- answered_at: 2026-10-17
- applies_to_paths: docs/superpowers/plans/2026-10-17-scm-g9-wp6-typed-hooks-plan.md

### RFC-007

- id: RFC-007
- wp: WP6
- unit: U3 harvest
- opened_at: 2026-10-17
- status: applied
- question: MCP `mcp-http-session-deleted` hook: fire inside patched Effect transport, or callback from `McpHttpServer.ts` after 204?
- worker_claim: WP6 §9 Q4 — must preserve live success first.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: Callback from `McpHttpServer.ts` after HTTP 204 (live success first)
  - B: Inside patched Effect transport before response commit
  - C: Either, left to implementer
- manager_answer: **A**. Hook after 204 in `McpHttpServer.ts` so live success is already committed; G9 fault cannot rewrite the 204. Matches live-safe law and WP6 consumer ownership of that file.
- answered_at: 2026-10-17
- applies_to_paths: docs/superpowers/plans/2026-10-17-scm-g9-wp6-typed-hooks-plan.md

### RFC-008

- id: RFC-008
- wp: WP7
- unit: U4 harvest
- opened_at: 2026-10-17
- status: applied
- question: Where does G9 merge into `server.ts` — `RuntimeDependenciesLive`, `makeServerLayer`, or both?
- worker_claim: WP7 §10 Q4 — smallest diff that wires capture service and RpcServer hook routes.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: Both — capture/deps via `RuntimeDependenciesLive`; route/hook fragments via `makeServerLayer`
  - B: Only `RuntimeDependenciesLive`
  - C: Only `makeServerLayer`
- manager_answer: **A**. Split by concern: optional `G9CaptureService` / stack deps in `RuntimeDependenciesLive`; RpcServer hook route wiring in `makeServerLayer`. Sole editor **WP7-Bootstrap-Owner**. Aligns with RFC-003 default-absent (neither merge runs unless opt-in present).
- answered_at: 2026-10-17
- applies_to_paths: docs/superpowers/plans/2026-10-17-scm-g9-wp7-composition-plan.md; docs/scm/g9/cross-wp-cohesion-index.md

### RFC-009

- id: RFC-009
- wp: WP7
- unit: U4 harvest
- opened_at: 2026-10-17
- status: applied
- question: If `loadG9Package` fails when G9 is explicitly enabled, fail-fast the server or degrade to absent?
- worker_claim: WP7 §10 Q7 — design favors fail-fast when G9 explicitly on.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: Fail-fast entire server when G9 opt-in is on and package load fails
  - B: Degrade to absent (log and continue live)
  - C: Fail-fast only in CI; degrade in dev
- manager_answer: **A**. Explicit opt-in (RFC-003) means a broken G9 package is a configuration error: fail-fast. Default absent path never calls `loadG9Package`, so today’s live is unchanged when G9 is off.
- answered_at: 2026-10-17
- applies_to_paths: docs/superpowers/plans/2026-10-17-scm-g9-wp7-composition-plan.md

### RFC-010

- id: RFC-010
- wp: WP8
- unit: U5 harvest
- opened_at: 2026-10-17
- status: applied
- question: Fixture runner placement — single test file vs per-bundle shards?
- worker_claim: WP8 §9 Q1 — CI time for counted fixture vectors (validation count).
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: One entrypoint `g9FixtureRunner.test.ts` with optional internal shard partitions driven by manifest
  - B: Separate per-bundle test files as the only entrypoints
  - C: Defer structure until runtime authorization
- manager_answer: **A**. Single public entrypoint owns the counted-fixture close gate (validation `counted_fixture_vector_count`, currently **763**) and zero-skip manifest. Internal shard partitions allowed for CI wall-clock; each shard still re-checks `counted_fixture_vector_count` against validation JSON. Reject B as sole model (fragments the exact-set close). Reject C (definition needs a runner shape now).
- answered_at: 2026-10-17
- applies_to_paths: docs/superpowers/plans/2026-10-17-scm-g9-wp8-exact-set-proof-plan.md

### RFC-011

- id: RFC-011
- wp: WP5 / WP1 ledger
- unit: adversarial seal repair
- opened_at: 2026-10-18
- status: applied
- question: Ledger `INV-T2-SC-BITBUCKET` places typed failure identities and English error-message strings into success-path `A.operation` / `request_label`. Does that violate payload / live-failure law?
- worker_claim: Adversary A4 Critical.
- reviewer_position: n/a (Manager adversarial repair)
- planner_position: n/a
- options:
  - A: Treat failure-identity / error-string labels as live-failure (no occurrence) until regen; B3 must not enqueue them into `A`
  - B: Keep success-path fixtures as written (accept error strings in `A`)
  - C: Hand-edit ledger now
- manager_answer: **A**. Design Equality + Capture lifecycle: typed live failure = no occurrence; English error strings are payload-class, not finite success labels. Until generator regen removes those members from success fixtures, B3 bounded-`A` domains exclude them. Reject B. Reject C (no hand-edit of generated ledger).
- answered_at: 2026-10-18
- applied_at: 2026-10-18
- apply_note: Regen fixed `extract_literals` (`]);` closer). `INV-T2-SC-BITBUCKET` success `request_label` is exactly 10 `BitbucketApiOperation` members. Counted fixtures **763**. Residual cleared.
- applies_to_paths: docs/superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md; docs/scm/g9/cross-wp-cohesion-index.md; docs/scm/g9/regen_coverage_ledger.py
- residual: none

### RFC-012

- id: RFC-012
- wp: WP5 / WP6
- unit: adversarial seal repair
- opened_at: 2026-10-18
- status: applied
- question: Who owns RpcServer admit/unary/stream `captureOccurrence` while ledger still says `existing-local-boundary` and RFC-002 regen is pending?
- worker_claim: Adversaries A1/A4/A5/A6 — B4 vs WP6 dual claim; RFC-006 harvest vs ledger.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: Ledger wins — B4 sole capture owner until regen flips strategy to `planned-typed-hook`; RFC-006 A is post-regen technique only
  - B: WP6 owns capture now despite ledger strategy
  - C: Both may capture (duplicate allowed)
- manager_answer: **A**. Design + ledger beat plans and Manager narration. B4 proves the 98/81/stream partition at local boundaries today. WP6 §2.2 is future hook design; no dual `captureOccurrence`. After RFC-002 regen, ownership flips to WP6 and B4 stops. RFC-006 **A** (prefer `ws.ts` wrappers) applies only post-regen. Reject B and C.
- answered_at: 2026-10-18
- applied_at: 2026-10-18
- apply_note: **Post-regen (RFC-002 applied):** ledger strategy is `planned-typed-hook`; sole `captureOccurrence` owner is **WP6-Consumer-Owner** on `ws.ts`. B4 no longer captures RpcServer phases. RFC-006 **A** technique is in force for WP6 implementation.
- applies_to_paths: docs/superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md; docs/superpowers/plans/2026-10-17-scm-g9-wp6-typed-hooks-plan.md; docs/scm/g9/cross-wp-cohesion-index.md

### RFC-013

- id: RFC-013
- wp: WP6
- unit: adversarial seal repair
- opened_at: 2026-10-18
- status: applied
- question: Does RFC-007 A (callback after any 204 in `McpHttpServer.ts`) satisfy ledger `mcp-http-session-deleted` (patched transport existing-session select-204)?
- worker_claim: Adversary A6 Critical — harvest moved off ledger predicate.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: Narrow RFC-007 — hook only on existing-session select-204 edge; optional `McpHttpServer` bridge only from that edge
  - B: Keep generic post-204 callback as sufficient
  - C: Force Effect-patch-only with no consumer bridge
- manager_answer: **A**. Ledger `capture_symbol` / success predicate win: patched Effect MCP HTTP transport deletes an existing session and selects 204. A thin `McpHttpServer.ts` bridge is allowed only if it is invoked exclusively from that edge (live success already committed). Generic any-204 callbacks are forbidden. Reject B. C is unnecessary if the bridge is edge-gated.
- answered_at: 2026-10-18
- applies_to_paths: docs/superpowers/plans/2026-10-17-scm-g9-wp6-typed-hooks-plan.md; docs/scm/g9/rfc-queue.md

### RFC-014

- id: RFC-014
- wp: WP5 / WP6 / WP7
- unit: adversarial seal repair
- opened_at: 2026-10-18
- status: applied
- question: How are dual landers on shared live files (`ws.ts`, `McpHttpServer.ts`, `Observability.ts`, `serverSettings.ts`, `VcsDriver.ts`, `relayClient.ts`, `DesktopTelemetryReceiver.ts`) and RFC-005/RFC-008 plan drift resolved?
- worker_claim: Adversaries A5/A6 — RFC-005 marked applied but WP5 still listed direct surfaces; unserialized dual landers; RFC-008 vs WP7 §5.1.6.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: Expand sole-lander + handoff tables (WP6 for ws/Mcp/Observability/T2Observability; named B1/B3/B5 for WP5-shared files); clarify RFC-008 thin makeServerLayer merge
  - B: Allow concurrent dual commits with informal coordination
  - C: Defer all serial rules to runtime authorization
- manager_answer: **A**. Apply sole-lander tables in cohesion index + WP5/WP6 plans; B2/B5 never commit `T2Observability.ts` (RFC-005). WP7: hook bodies not authored in `server.ts`; RFC-008 route fragments are thin merges of `g9Bootstrap` exports via `makeServerLayer`. Canonical-absence FILE-LOGS phase is fixture-only (no invented writer). Reject B and C.
- answered_at: 2026-10-18
- applies_to_paths: docs/scm/g9/cross-wp-cohesion-index.md; docs/superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md; docs/superpowers/plans/2026-10-17-scm-g9-wp6-typed-hooks-plan.md; docs/superpowers/plans/2026-10-17-scm-g9-wp7-composition-plan.md

### RFC-015

- id: RFC-015
- wp: WP1–WP8
- unit: adversarial seal repair (wave 4)
- opened_at: 2026-10-18
- status: applied
- question: Who widens `G9CaptureOccurrenceInput` / coordinator validation from the ORCH-QUEUE slice to all 74 rows / 184 phases before WP5/WP6/WP8 non-slice capture?
- worker_claim: Adversary A1 Critical — Task 8 placement-faults non-slice `comm_id`s; no frozen owner for widen.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: Foundation Task 14 sole widen owner before WP5/WP6/WP8 non-slice capture
  - B: Each WP5/WP6 bundle widens types ad hoc
  - C: Leave slice-only forever; WP8 skips non-slice vectors
- manager_answer: **A**. Add foundation **Task 14** (WP2-Foundation-Owner / WP2+WP3-Foundation-Owner) that widens the closed union to all 184 ledger phases and package-backs coordinator validation. WP5/WP6/WP8 bind after Task 14; they must not edit core `g9*.ts` to invent unions. Reject B and C.
- answered_at: 2026-10-18
- applies_to_paths: docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md; docs/scm/g9/wp1-wp4-foundation-cohesion.md; docs/scm/g9/cross-wp-cohesion-index.md; docs/superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md; docs/superpowers/plans/2026-10-17-scm-g9-wp8-exact-set-proof-plan.md
- apply_note: **Superseded in scope by RFC-017** — wave-4b showed Task 14 input-only was incomplete; full occurrence/`toW1` widen required.

### RFC-016

- id: RFC-016
- wp: WP4 / WP6 / WP7
- unit: adversarial seal repair (wave 4)
- opened_at: 2026-10-18
- status: applied
- question: Must `G9LiveSafeCaptureLayer` isolate capture defects (not only typed `G9InvariantFault`) so post-success live work cannot die, and must fault evidence use package row identity?
- worker_claim: Adversary A3 Critical — typed-only `matchEffect` leaves defects on live fiber; hard-coded node/bus context.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: Cause-level isolation via `Effect.exit` + latch; package-derived node/bus; waker supervised under bootstrap scope
  - B: Keep typed-only matchEffect; accept live die on defects
  - C: Catch defects but skip supervisor sink
- manager_answer: **A**. Live-safe layer uses cause isolation so the capture service error channel stays `never`; defects become latched faults with `sink.deliver`. Fault `node_id`/`bus_id` from loaded package row for `input.comm_id`. Waker fiber supervised under G9 bootstrap scope so defects cannot silent-kill or skip the sink. Reject B and C.
- answered_at: 2026-10-18
- applies_to_paths: docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md; docs/scm/g9/wp1-wp4-foundation-cohesion.md; docs/superpowers/plans/2026-10-17-scm-g9-wp6-typed-hooks-plan.md; docs/superpowers/plans/2026-10-17-scm-g9-wp7-composition-plan.md
- apply_note: **Completed by RFC-018** — adds `capture-defect`/`waker-defect`, tick isolation, sandboxed latch, no reserved sentinels, WP7 `forkScoped` + Layer arity.

### RFC-017

- id: RFC-017
- wp: WP1–WP8
- unit: adversarial seal repair (wave 5)
- opened_at: 2026-10-18
- status: applied
- question: Does Task 14 widen only `G9CaptureOccurrenceInput`, or the full capture/enqueue projection including `G9Occurrence`, equality/labels/retain, and `toW1`?
- worker_claim: Adversary A6 Critical — Task 14 input-only; occurrence stays slice-narrow; no owner for real widen.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: Task 14 sole full widen (input + occurrence + toW1 + coordinator); set-equal 184; absence/dormant never enqueue
  - B: Keep input-only Task 14; allow WP5 to widen occurrence types
  - C: Defer occurrence widen to WP8
- manager_answer: **A**. Supersede incomplete RFC-015 scope. Task 14 is the sole full widen with cohesion sole-landers (WP2 occurrence/promotion; WP1 package lookup; WP2+WP3 coordinator; Slice orch helper only). WP5/WP6/WP8 bind after Task 14 completes; they must not edit core `g9*.ts`. Reject B and C.
- answered_at: 2026-10-18
- applies_to_paths: docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md; docs/scm/g9/wp1-wp4-foundation-cohesion.md; docs/scm/g9/cross-wp-cohesion-index.md; docs/superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md; docs/superpowers/plans/2026-10-17-scm-g9-wp8-exact-set-proof-plan.md
- apply_note: **RFC-019** corrects the absence/dormant collapse in early Task 14 text — dormant fixture enqueue remains legal.

### RFC-018

- id: RFC-018
- wp: WP4 / WP6 / WP7
- unit: adversarial seal repair (wave 5)
- opened_at: 2026-10-18
- status: applied
- question: How are waker/`admitPublish` defects delivered to the sink, which fault codes apply, and what fault-context identities are legal?
- worker_claim: Adversaries A3/A6 — waker supervision open; preflight mislabel; 404/authority sentinels; latch outside isolation.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: Isolate at tick (`waker-defect`); capture defects (`capture-defect`); sandboxed latch; package-row context only; WP7 forkScoped + four-arg Layer
  - B: Catch defects inside Task 8 commit
  - C: Allow live die on waker defects
- manager_answer: **A**. Completes RFC-016. Task 8 still does not catch admitPublish on the coordinator fiber. Task 10 `tick` isolates Fail/Die → latch → sink → `faulted`. Codes are distinct from `preflight`/`clock-overlap`. No reserved-identity sentinels. Interrupt ≠ latch. Reject B and C.
- answered_at: 2026-10-18
- applies_to_paths: docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md; docs/scm/g9/wp1-wp4-foundation-cohesion.md; docs/superpowers/plans/2026-10-17-scm-g9-wp6-typed-hooks-plan.md; docs/superpowers/plans/2026-10-17-scm-g9-wp7-composition-plan.md
- apply_note: **RFC-019** completes latch context optionality. **RFC-020** clarifies observation emission (identity omit; `scope` latch-only, not on wire).

### RFC-019

- id: RFC-019
- wp: WP1–WP8
- unit: adversarial seal repair (wave 5 post-dispatch)
- opened_at: 2026-10-18
- status: applied
- question: May `dormant-prototype` phases enqueue under fixture wiring, and what latch context is legal when no package row / waker-only fault exists?
- worker_claim: A1/A6 — RFC-017 collapsed absence with dormant; Task 7 required node/bus; generated A union had no owner.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: Split classes — absence never enqueue; dormant fixture-enqueue OK; optional latch identities; generator owns TS unions
  - B: Keep never-enqueue for both
  - C: Add `G9CaptureResult` skip variant
- manager_answer: **A**. `declaration-absence` → `placement` / no capture call from WP8. `dormant-prototype` → enqueue allowed from B6/WP8 fixtures only. Latch `node_id`/`bus_id` optional; waker uses `scope: "waker"` as latch call-site only. `G9EqualityA` / capture-input unions emitted by **G9-Generator-Owner**. Capture path keeps typed `G9InvariantFault` codes via Effect.try (no Die→`capture-defect` for `sequence-overflow`). Reject B and C.
- answered_at: 2026-10-18
- applies_to_paths: docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md; docs/scm/g9/cross-wp-cohesion-index.md; docs/superpowers/plans/2026-10-17-scm-g9-wp8-exact-set-proof-plan.md; docs/scm/g9/rfc-queue.md
- apply_note: **RFC-020** completes cohesion §2 apply + Task 6 observation signature + no fabricated fault identities.

### RFC-020

- id: RFC-020
- wp: WP1–WP8
- unit: adversarial seal residual close (human-directed after SEAL_FAIL)
- opened_at: 2026-10-18
- status: applied
- question: After wave-5b SEAL_FAIL, how should the stale cohesion §2 enqueue note and Task 6/design fault-observation gap be closed without reopening production topology?
- worker_claim: Human — Decision A (preserve RFC-019 absence≠dormant) + Decision C (optional fault identity attrs) with qualifications.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A+C: Fix cohesion §2 to RFC-019 split; Task 6 optional identities; exact five-key allowlist; `fault_code`+`waker_state` required; identities omitted when no occurrence; capture keeps identities when available; no fabricated system identity; `scope` latch-only not on wire
  - B: Collapse dormant to never-enqueue (reopen ledger/design)
  - D: Keep five required attrs via approved system identity
  - E: Extend design allowlist with `scope` attribute
- manager_answer: **A+C** as human-directed. (1) Cohesion §2 sole-owner note: non-enqueue for declaration-absence; dormant-prototype fixture enqueue OK (RFC-019). Do not reopen design. (2) Task 6 `fault` / design / catalog: exact five-key allowlist preserved; optional = omit key; `fault_code` and `waker_state` always required; `comm_id`/`node_id`/`bus_id` optional only when no associated occurrence; capture faults preserve complete identities when available; never fabricate reserved identities. Latch `scope` remains call-site bookkeeping and must not be emitted. Reject B/D/E.
- answered_at: 2026-10-18
- applies_to_paths: docs/scm/g9/cross-wp-cohesion-index.md; docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md; docs/superpowers/specs/2026-09-26-scm-g9-shadow-parity-design.md; docs/scm/g9/observation-catalog.json; docs/scm/g9/regen_coverage_ledger.py; docs/scm/g9/wp1-wp4-foundation-cohesion.md; docs/scm/g9/rfc-queue.md

### RFC-021

- id: RFC-021
- wp: WP1–WP8
- unit: execution contract close (definition-only)
- opened_at: 2026-10-18
- status: applied
- question: How does `implementation_authorized: true` survive required regeneration of ledger/validation JSON without hand-editing generated artifacts, and when may Workers write `g9*.ts`?
- worker_claim: Audit — generator hardcodes `false`; Task 13 / WP8 §8 conflict with auth-before-code; seal status hash drift on `definition-progress.md`.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: Derive `implementation_authorized` from presence of human-authored `docs/scm/g9/authorization.md`; regen emits true when file exists; auth before any `g9*.ts`; Task 13 dual-mode; WP8 auth-first
  - B: Hand-edit generated JSON after regen
  - C: Sidecar flag file outside `authorization.md`
  - D: Authorize after bootstrap/drivers/runner (keep WP8 §8 order)
- manager_answer: **A**. Source of truth is human-authored `authorization.md` (required body: gate `G9`, date, human identity, scope `WP1–WP8 runtime`). `regen_coverage_ledger.py` sets `implementation_authorized` from that file into both ledger and validation — never invent the file. Hand-edits of generated JSON remain forbidden. Workers write `apps/server/src/scm/g9*.ts` only after the file exists **and** regen has emitted `true`. Task 13 unauthorized hygiene (`! -e` + expect false) does not authorize Tasks 1–14; authorized mode requires file + expect true then tests. WP8 §8 step 1 = human auth + regen. Reject B, C, D.
- answered_at: 2026-10-18
- applies_to_paths: docs/scm/g9/regen_coverage_ledger.py; docs/scm/g9/manager-charter.md; docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md; docs/superpowers/plans/2026-10-17-scm-g9-wp8-exact-set-proof-plan.md; docs/scm/g9/cross-wp-cohesion-index.md; docs/scm/g9/integration-readiness.md; docs/scm/g9/adversarial-review-charter.md; docs/scm/g9/rfc-queue.md
- apply_note: **RFC-022** tightens derive to validated body (not bare `is_file()`), ROOT from `__file__`, and changelog retained notes.

### RFC-022

- id: RFC-022
- wp: WP1–WP8
- unit: generator gates + seal currency (definition-only)
- opened_at: 2026-10-18
- status: applied
- question: How does regen stay worktree-local, keep `authorization.md` from authorizing via an empty file, preserve changelog curated notes under WP8 no-diff, and restore a seal that matches the current corpus?
- worker_claim: Audit — hardcoded ROOT; existence-only auth; changelog rewrite drops Wave-5 FILE-LOGS notes; wave-6 hashes stale after RFC-021 subjects changed.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: ROOT from `__file__`; validate auth body (absent=false, invalid=fail regen, valid=true); Retained notes + skip identical changelog write; freeze + re-blind A1/A2/A6
  - B: Keep hardcoded Mac ROOT
  - C: Existence-only auth (RFC-021 bare is_file)
  - D: Always rewrite changelog without retention
- manager_answer: **A**. (1) `ROOT = Path(__file__).resolve().parents[3]` so isolated worktrees regen locally. (2) Absent `authorization.md` ⇒ `implementation_authorized: false`; present but missing `gate: G9` / `date: YYYY-MM-DD` / non-empty `human` / `scope: WP1–WP8 runtime` ⇒ non-zero exit, never emit true; valid ⇒ true. (3) Changelog `## Retained notes` migrates curated bullets (incl. Wave-5 FILE-LOGS); skip write when rendered text equals prior. (4) Wave-7 freeze excluding status-only `definition-progress.md`; re-blind A1/A2/A6. Reject B, C, D.
- answered_at: 2026-10-18
- applies_to_paths: docs/scm/g9/regen_coverage_ledger.py; docs/scm/g9/coverage-changelog.md; docs/scm/g9/manager-charter.md; docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md; docs/superpowers/plans/2026-10-17-scm-g9-wp8-exact-set-proof-plan.md; docs/scm/g9/integration-readiness.md; docs/scm/g9/adversarial-freeze-manifest.md; docs/scm/g9/rfc-queue.md

### RFC-023

- id: RFC-023
- wp: WP5 / WP7
- unit: adversarial seal repair (wave 8 post-dispatch — A5)
- opened_at: 2026-10-18
- status: applied
- question: May B1 commit to `OrchestrationEngine.ts` for non-slice phases, and may WP7 bootstrap on empty family stubs?
- worker_claim: A5 — cohesion §2 sole Slice-Foundation-Owner on Engine vs WP5 B1 “non-slice” lander; WP7 “stubs” vs empty-stub ban; ORCH-EVENTS ledger module is `apps/server/src/orchestration` not Engine.
- reviewer_position: n/a
- planner_position: n/a
- options:
  - A: Engine capture hook remains Slice-only forever; B1 lands ORCH-EVENTS on ledger `apps/server/src/orchestration` surfaces only; WP7 requires callable modules (no empty stubs)
  - B: Promote B1 to co-owner of OrchestrationEngine.ts after slice freeze
  - C: Allow empty stubs for bootstrap gating
- manager_answer: **A**. Design/ledger beat plans. `OrchestrationEngine.ts` (capture hook) stays **Slice-Foundation-Owner** only — B1 must not commit there. `INV-T2-ORCH-EVENTS` uses ledger `capture_module: apps/server/src/orchestration`. Empty WP5 family stubs remain forbidden; WP7 waits on real callable family/hook modules. Reject B and C.
- answered_at: 2026-10-18
- applies_to_paths: docs/superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md; docs/superpowers/plans/2026-10-17-scm-g9-wp7-composition-plan.md; docs/scm/g9/cross-wp-cohesion-index.md; docs/scm/g9/rfc-queue.md

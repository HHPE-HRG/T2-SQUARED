# SCM G9 WP6 typed hooks — definition plan (U3)

<!-- Agent: definition only. No apps/server/src/scm/g9*.ts. No authorization.md. Do not edit patches/effect@*.patch or server.ts in this pass. Do not execute. -->

- Date: 2026-10-17
- Unit: **U3** (G9 Manager charter)
- Governing design: `docs/superpowers/specs/2026-09-26-scm-g9-shadow-parity-design.md` (families → `captureOccurrence` only; optional hooks summarized in `docs/scm/g9/integration-readiness.md` §2)
- Foundation cohesion (frozen contracts): `docs/scm/g9/wp1-wp4-foundation-cohesion.md`
- WP5 boundary: `docs/superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md` (RpcServer/MCP/OTLP deferral; B4 does not implement patch-owned RPC phases)
- Machine ledger: `docs/scm/g9/coverage-ledger.json`
- Validation: `docs/scm/g9/coverage-validation.json` → `planned_typed_hooks`
- Effect patch path (repo): `patches/effect@4.0.0-beta.103.patch`

## Authorization

```yaml
implementation_authorized: false
writing_plans_authorized: true # planning definition only; mirrors coverage-validation.json
```

Do **not** create `docs/scm/g9/authorization.md`, flip `g9toG10Authorized`, edit `patches/effect@4.0.0-beta.103.patch`, edit `server.ts`, or implement hook wiring in this pass.

---

## 1. Outcome

Deliver a **closed definition** for optional **typed live hooks** that let G9 observe successes inside Effect `RpcServer`, Effect MCP HTTP transport, and OTLP export success channels **after** live work has already succeeded, without retaining payloads and without changing live behavior when hook services are absent.

When `implementation_authorized` becomes true in a future session, WP6 implementation will:

1. Extend **`patches/effect@4.0.0-beta.103.patch`** (serial owner only) with server-side `RpcServer` hook injection points and any MCP HTTP hook seams required for deferred phases.
2. Add a **WP6 family module** (proposed: `apps/server/src/scm/g9FamilyTypedHooks.ts`) whose hook callbacks project ledger-bounded `input` and call `captureOccurrence({ comm_id, phase, input })` through the WP4 **live-safe** boundary (`G9LiveSafeCaptureLayer` / `G9CaptureService` error channel `never`).
3. Wire **consumer layers** in `ws.ts`, `McpHttpServer.ts`, `T2Observability.ts`, and `Observability.ts` so hook services are optional `Context.Service` dependencies; WP7 bootstrap composes them (WP7 owns `server.ts` join — not WP6).

## Depends on (WP4 frozen)

Bind without re-opening:

- `G9CaptureOccurrenceInput`, `G9CaptureResult`, `G9InvariantFault`, `G9LiveSafeCaptureLayer`, `G9FaultController` / supervisor propagation (`wp1-wp4-foundation-cohesion.md` §3).
- **Absent optional service ⇒ unchanged live** (integration-readiness §2 stable contracts).
- **Hook fault ⇒ G9 escalation** (fault latch, metadata observation, supervisor delivery); hook must **not** convert a successful live RPC/export/MCP DELETE into live failure and must **not** rewrite live results (`integration-readiness.md` §2, ledger OTLP/MCP predicates).
- **No payload retention**; equality types and finite labels come from the ledger only.
- WP5 **B4** continues local-boundary capture for MCP phases **not** listed under WP6 hook inventory; RpcServer admit/unary/stream are **WP6-only** (`planned_typed_hooks`, RFC-002 applied).

## Non-goals

| Non-goal                                        | Rationale                                                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generic HTTP middleware capture                 | WP6 hooks are **typed** seams at RpcServer, MCP transport, and exporter success channels only (`integration-readiness.md` WP6 row).                                             |
| WP5 local-boundary MCP phases                   | e.g. `mcp-http-message-admitted`, `mcp-http-handler-succeeded` stay **B4** planning ownership (handoff to WP6 sole lander on `McpHttpServer.ts`). RpcServer rows are fully WP6. |
| FIFO, waker, bus map, observation catalog edits | WP2–WP4 closed law.                                                                                                                                                             |
| `server.ts` bootstrap / G9 Layer composition    | **WP7** single owner (`integration-readiness.md` §6).                                                                                                                           |
| Completing WP8 fixture runner                   | WP8 exact-set proof.                                                                                                                                                            |
| Concurrent Effect patch edits                   | Serial hotspot (§4).                                                                                                                                                            |
| Execution in this definition pass               | `implementation_authorized: false`.                                                                                                                                             |

---

## 2. Hook inventory (text contracts)

### 2.1 Machine `planned_typed_hooks` (normative deferral set)

Source: `docs/scm/g9/coverage-validation.json` → `planned_typed_hooks` (**21** phase rows; `capture_strategy: planned-typed-hook` in ledger). Includes RpcServer (RFC-002 applied) + MCP/OTLP.

| `comm_id`                                                   | `phase_id`                         | Hook contract (text)                                                                                                                                                                                                                                                                                                                                                                                             | Ledger equality                                                                                                 | Live seam (text)                                                                                                                              |
| ----------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `INV-T2-RPC-WS` / `INV-T2-ORCH-RPC` / `INV-T2-RPC-STREAM-*` | admit / unary / stream (17 phases) | See §2.2 — **WP6 sole capture**                                                                                                                                                                                                                                                                                                                                                                                  | `G9RpcAdmitA` / `G9RpcUnarySuccessA` / `G9RpcStreamElementA`                                                    | `apps/server/src/ws.ts` + Effect patch admit seam                                                                                             |
| `INV-T2-MCP-HTTP`                                           | `mcp-http-session-deleted`         | **Post-success only:** after patched Effect MCP HTTP transport deletes an **existing** session and selects **204** (ledger `capture_symbol` / predicate). Missing session, unknown session, or failed DELETE ⇒ no hook, no occurrence. Hook may bridge through `McpHttpServer.ts` **only** if invoked exclusively from that existing-session select-204 edge (RFC-013). Generic any-204 callbacks are forbidden. | `G9McpDeleteA` — `A.site = "mcp-http-session-deleted"`                                                          | Effect `McpServer.layerHttp` DELETE route (patch) → existing-session 204 edge; optional thin bridge in `apps/server/src/mcp/McpHttpServer.ts` |
| `INV-T2-TEL-T3-OTLP`                                        | `t3-otlp-traces-export-succeeded`  | **Post-success only:** after `OtlpExporter` `execute` + `filterStatusOk` succeeds for a **nonempty** traces batch. Empty buffer, export failure ⇒ no hook. SCM-only batches excluded. Hook fault must not fail live export.                                                                                                                                                                                      | `G9T3OtlpTracesA` — `A.signal = "t3-otlp-traces-export-succeeded"`                                              | `apps/server/src/observability/Layers/Observability.ts` (`OtlpTracer.make` → export path)                                                     |
| `INV-T2-TEL-T3-OTLP`                                        | `t3-otlp-metrics-export-succeeded` | Same law as traces row; **metrics** batch nonempty + filtered OK.                                                                                                                                                                                                                                                                                                                                                | `G9T3OtlpMetricsA` (ledger `equality_type` for metrics phase) — `A.signal = "t3-otlp-metrics-export-succeeded"` | Same module; metrics export member                                                                                                            |
| `INV-T2-TEL-T2-OTLP`                                        | `t2-otlp-export-succeeded`         | **Post-success only:** after `OTLPTraceExporter.export` success callback for a **filtered** batch. Failure callback ⇒ no hook. SCM-only batches excluded.                                                                                                                                                                                                                                                        | `G9T2OtlpA` — `A.signal = "t2-otlp-export-succeeded"`                                                           | `apps/server/src/t2Observability/T2Observability.ts` (`BatchSpanProcessor` / exporter success channel)                                        |

### 2.2 RpcServer typed hooks (current ownership — RFC-002/012 applied)

Source: ledger phases with `capture_strategy: planned-typed-hook` and `capture_module: apps/server/src/ws.ts`; `integration-readiness.md` §2.

**Normative ownership:** **WP6** is the sole `captureOccurrence` owner for admit/unary/stream (`g9FamilyTypedHooks` + patch/consumer wiring). B4 must not dual-capture. Validation `rpc_registered_set_equal` / `rpc_unary_stream_partition` remain WP6 acceptance gates.

**Proposed Effect service (text):** `RpcServerRequestHooks` — optional `Context.Service` installed in the RpcServer layer stack (exact tag string chosen at implementation; must not collide with existing patch `RpcClient.RequestHooks`).

| Hook callback (text contract)                                     | Ledger `phase_id`            | When it runs                                                                                         | `input` / equality                                           | Applies to `comm_id`s                                                                                                                                                                                |
| ----------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admit** — after decode, registered `WsRpcGroup` method admitted | `rpc-request-admitted`       | Once per incoming RPC request after successful decode/admit; unregistered / decode failure ⇒ no hook | `G9RpcAdmitA` — `A.method = request_label` (method tag only) | `INV-T2-RPC-WS`, `INV-T2-ORCH-RPC`, `INV-T2-RPC-STREAM-TERM`, `INV-T2-RPC-STREAM-ORCH`, `INV-T2-RPC-STREAM-TEL`, `INV-T2-RPC-STREAM-AUTH`, `INV-T2-RPC-STREAM-CONFIG`, `INV-T2-RPC-STREAM-DISCOVERY` |
| **Unary success** — handler returned success                      | `rpc-handler-succeeded`      | After unary handler **success**; stream methods excluded; typed handler error ⇒ no hook              | `G9RpcUnarySuccessA` — `A.method = request_label`            | Only comm_ids where the ledger lists `rpc-handler-succeeded` (currently `INV-T2-RPC-WS`, `INV-T2-ORCH-RPC`)                                                                                          |
| **Stream element** — logical element emitted                      | `rpc-stream-element-emitted` | Once per **logical stream element** (N hook calls per chunk); stream close is **not** a phase        | `G9RpcStreamElementA` — `A.method = request_label`           | Stream partition rows (ledger `stream` family on `WsRpcGroup` stream methods)                                                                                                                        |

**Live wiring surface (text):** `apps/server/src/ws.ts` — `RpcServer.toHttpEffectWebsocket(WsRpcGroup, …)` layer merge provides optional `RpcServerRequestHooks` + WP6 bridge into `g9FamilyTypedHooks`. **RFC-006 A** in force: prefer `ws.ts` wrappers for unary/stream; Effect patch for admit / unavoidable seams.

**Non-interference:** If `RpcServerRequestHooks` (or WP6 bridge) is absent, RpcServer behavior matches **install baseline** (Effect patch is always applied at install; “absent” means no WP6 hook layer / no G9 capture calls — not an unpatched Effect tree). RFC-003 present mode merges hook layers atomically with `G9LiveSafeCaptureLayer` (WP7).

### 2.3 MCP hooks — readiness vs WP5/WP6 split

Readiness summarizes MCP as “decoded-message / typed-success / session-delete” (`integration-readiness.md` §2). Ledger mapping:

| Readiness hook class     | Ledger `phase_id`            | WP owner   | Mechanism                                                                                                                                      |
| ------------------------ | ---------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Decoded message admitted | `mcp-http-message-admitted`  | **WP5 B4** | Local boundary `McpHttpServer.authenticateRequest` — **not** WP6                                                                               |
| Typed handler success    | `mcp-http-handler-succeeded` | **WP5 B4** | Local boundary `normalizeMcpHttpResponse` — **not** WP6                                                                                        |
| Session delete 204       | `mcp-http-session-deleted`   | **WP6**    | `planned_typed_hook` + Effect `layerHttp` DELETE existing-session select-204 (RFC-013); optional `McpHttpServer.ts` bridge only from that edge |

WP6 is the **sole lander** on `McpHttpServer.ts` for all G9 edits (RFC-014). B4 authors the two non-hook MCP phases as handoff patches; WP6 integrates them. WP6 does **not** re-home those phases’ planning ownership out of B4.

### 2.4 Cross-hook live-safe law (all inventory rows)

From readiness + ledger predicates (text, closed for planners):

1. **Absent hook service** ⇒ live code path identical to today (no no-op stub that changes timing/errors unless Effect upstream already requires it — prefer `Effect.serviceOption` / optional fields).
2. **Hook present** ⇒ invoke **only after** live success predicate is true (post-success / post-admit).
3. **Hook body** ⇒ project bounded `input`, call `captureOccurrence`; Fail/Die route through `G9LiveSafeCaptureLayer` (RFC-018): **`capture-defect`** for defects, sandboxed latch/sink, package-row fault context only; capture service error channel stays `never`; live exit unchanged.
4. **Unexpected invariant inside G9** ⇒ `G9InvariantFault`, fault controller, **no** live result rewrite.
5. **No** command bodies, stream payloads, OTLP bodies, MCP bodies, or tokens in `input` / `A`.

---

## 3. Full-row OTLP ownership (WP6)

Both telemetry-export rows are **fully deferred** from WP5 — no B5/B3 family capture on these `comm_id`s (WP5 plan § WP6-deferred rows).

| `comm_id`            | `node_id`          | `home_bus_id`  | Phases (all WP6)                                                          | Consumer file owner                                     |
| -------------------- | ------------------ | -------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| `INV-T2-TEL-T2-OTLP` | `node.t2-observer` | `bus.observer` | `t2-otlp-export-succeeded` (1)                                            | `apps/server/src/t2Observability/T2Observability.ts`    |
| `INV-T2-TEL-T3-OTLP` | `node.t3-observer` | `bus.observer` | `t3-otlp-traces-export-succeeded`, `t3-otlp-metrics-export-succeeded` (2) | `apps/server/src/observability/Layers/Observability.ts` |

WP6 owns **all phases** on these rows, hook wiring, and tests that prove post-success capture + absent-hook noninterference. WP5 **B5** retains NDJSON / T3 trace **non-OTLP** rows (`INV-T2-TEL-NDJSON`, `INV-T2-TEL-T3-TRACE`) only.

---

## 4. Serial owner — Effect patch

| Hotspot                               | Sole owner role                                                                                                           | Others                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `patches/effect@4.0.0-beta.103.patch` | **`WP6-Effect-Patch-Owner`** (exactly one assignee at implementation kickoff; G9 Manager records name in progress ledger) | May prepare **tests**, hook **types**, and **consumer** diffs in separate files; **must not** commit concurrent patch edits |

Rules (normative, from `integration-readiness.md` §6):

- One open patch-editing session at a time; rebase/merge patch changes through the named owner.
- Patch must continue to apply cleanly on pinned Effect version (`effect@4.0.0-beta.103`).
- Foundation Task 13 currently expects **empty patch diff** until G9 runtime is authorized — WP6 patch work begins only after human authorization, not in definition passes.
- **Current patch note (2026-10-17):** patch already contains MCP HTTP DELETE routing and **RpcClient** `RequestHooks`; **server-side `RpcServerRequestHooks` are not yet present** — WP6 implementation adds them under this serial owner.

---

## 5. Absent hook vs hook failure

| Case                                                            | Required behavior                                                                                                                |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Hook `Context.Service` **absent**                               | Live RPC, MCP DELETE, and OTLP export outcomes unchanged from pre-G9 wiring.                                                     |
| Hook **present**, capture enqueues                              | Live success already committed; occurrence follows WP2 FIFO law.                                                                 |
| Hook **present**, `rejected-capacity` / `rejected-bus-withheld` | Live success still stands; G9 records expected capture outcome only.                                                             |
| Hook **present**, G9 invariant break                            | **Escalate:** `G9InvariantFault` → fault controller → supervisor; **do not** rewrite successful live response/export/MCP status. |
| Live failure (handler error, export fail, 404 DELETE)           | **No hook**, no occurrence (ledger `live_failure_no_capture_disposition`).                                                       |

---

## 6. File ownership (consumers + module)

| Path                                                     | WP6 role                                            | Notes                                                                                         |
| -------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `patches/effect@4.0.0-beta.103.patch`                    | **WP6-Effect-Patch-Owner** only                     | RpcServer hook seams; MCP transport existing-session 204 edge                                 |
| `apps/server/src/scm/g9FamilyTypedHooks.ts` (proposed)   | **WP6 hook family owner**                           | Maps hook callbacks → `captureOccurrence`; colocated tests                                    |
| `apps/server/src/ws.ts`                                  | **WP6-Consumer-Owner** (sole lander)                | RpcServer hooks post-regen; integrates B1 `INV-T2-ORCH-LIVE` handoff                          |
| `apps/server/src/mcp/McpHttpServer.ts`                   | **WP6-Consumer-Owner** (sole lander)                | Existing-session select-204 → `mcp-http-session-deleted`; integrates B4 MCP non-hook handoffs |
| `apps/server/src/t2Observability/T2Observability.ts`     | **WP6-Consumer-Owner** (sole lander, RFC-005 **A**) | T2 OTLP export success hook; integrates B2 flag + B5 NDJSON handoffs                          |
| `apps/server/src/observability/Layers/Observability.ts`  | **WP6-Consumer-Owner** (sole lander, RFC-014 **A**) | T3 OTLP hooks; integrates B5 `INV-T2-TEL-T3-TRACE` handoff                                    |
| `apps/server/src/server.ts`                              | **WP7** — not WP6                                   | Layer merge only                                                                              |
| `apps/server/src/scm/g9*.ts` core (coordinator, FIFO, …) | **WP2–WP4** owners                                  | WP6 calls capture service only                                                                |

### 6.1 WP5 → WP6 handoff sequence (normative)

1. **B2 → WP6 (`T2Observability.ts`):** B2 delivers `INV-T2-FLAG-T2-OTEL` / `flag-resolved` patch; WP6 lands it before or with T2 OTLP hook.
2. **B5 → WP6 (`T2Observability.ts`):** B5 delivers `INV-T2-TEL-NDJSON` / `ndjson-export-succeeded` patch; WP6 lands it; B5 does not commit the file.
3. **B5 → WP6 (`Observability.ts`):** B5 delivers `INV-T2-TEL-T3-TRACE` patches; WP6 lands them alongside T3 OTLP hooks.
4. **B4 → WP6 (`McpHttpServer.ts`):** B4 delivers non-hook MCP phase patches; WP6 lands them; then WP6 adds session-delete edge (RFC-013).
5. **B1 → WP6 (`ws.ts`):** B1 delivers `INV-T2-ORCH-LIVE` patch; WP6 lands it; RpcServer hook wiring is ledger-backed (`planned-typed-hook` on `ws.ts` after RFC-002/RFC-012 regen — applied).

**Parallelization after patch owner assigned:** consumer-file work may proceed in parallel **only** if patches are merged first and no second worker touches the patch file; handoffs above serialize each sole-lander file.

---

## 7. Acceptance gates (when implementation authorized)

1. **Patch applies:** package install applies `patches/effect@4.0.0-beta.103.patch` without drift (or with WP6-approved hunk only).
2. **Hook-absent noninterference:** integration tests with G9 capture layer **absent** — RPC, MCP DELETE, OTLP exports behave as baseline.
3. **Hook-present post-success:** for each inventory row, one live success → exactly one `captureOccurrence` with ledger `comm_id`, `phase_id`, and bounded `input`.
4. **Hook fault isolation:** injected fault in hook/capture path after live success does not change live exit status (RPC response / HTTP 204 / export callback success).
5. **Payload exclusion:** fixtures for WP6 phases pass finite-label equality checks; no bytes in observations/FIFO.
6. **OTLP rows:** both `INV-T2-TEL-T2-OTLP` and `INV-T2-TEL-T3-OTLP` covered in full (three phases total).
7. **RpcServer partition:** admit / unary / stream-element hooks align with ledger method partitions (`rpc_registered_set_equal`, `rpc_unary_stream_partition` in validation JSON).
8. **WP5 boundary:** B4 tests for local MCP phases still pass; WP6 does not duplicate capture for WP5-owned MCP phases.
9. **Typecheck / targeted tests:** `vp test run` on WP6 module + consumer tests; no wall sleeps.

Global gates remain in `integration-readiness.md` §7 (package validation, regen script, G9 properties).

---

## 8. Proposed implementation sequence (not executed here)

1. G9 Manager assigns **`WP6-Effect-Patch-Owner`**.
2. Patch owner adds `RpcServerRequestHooks` (and any missing MCP hook callbacks) to `patches/effect@4.0.0-beta.103.patch`.
3. Hook family owner implements `g9FamilyTypedHooks.ts` + unit tests (mock capture service).
4. Consumer owners land thin wiring in `ws.ts`, `McpHttpServer.ts`, `T2Observability.ts`, `Observability.ts`.
5. WP7 integrates optional hook layers into bootstrap (`server.ts`) without eleventh bus or home-bus-link fabric.

---

## 9. Open questions — Manager-answered (as they came up)

| #   | Topic                                               | Manager RFC                 | Decision                                                                                     |
| --- | --------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | `planned_typed_hooks` vs RpcServer machine tracking | **RFC-002 A**               | **Applied** — 21 machine rows including 17 RpcServer                                         |
| 2   | `Context.Service` tag naming vs RpcClient hooks     | (implement-time name check) | Document no-collision in WP6 module header at code time; not a definition blocker            |
| 3   | Patch vs `ws.ts` for unary/stream                   | **RFC-006 A** + **RFC-012** | Prefer `ws.ts` wrappers; WP6 sole capture post-regen                                         |
| 4   | MCP DELETE hook placement                           | **RFC-007 A** + **RFC-013** | After existing-session select-204; bridge may live in `McpHttpServer.ts` only from that edge |
| 5   | SCM-only OTLP batch predicate                       | (ledger notes)              | Shared predicate from ledger exclusion notes; one helper used by T2 and T3 hooks             |
| 6   | RpcServer phases in WP8 runner                      | **RFC-010 A** + WP8 plan    | Full fixture runner includes them; targeted WP6 tests may precede                            |

Resolver: G9 Manager. See `docs/scm/g9/rfc-queue.md`.

---

## Authoritative cross-links

| Document                                                              | Role                                               |
| --------------------------------------------------------------------- | -------------------------------------------------- |
| `docs/scm/g9/manager-charter.md`                                      | U3 unit; blind consensus                           |
| `docs/scm/g9/integration-readiness.md`                                | WP6 row; §6 serial patch ownership                 |
| `docs/scm/g9/wp1-wp4-foundation-cohesion.md`                          | Live-safe capture; patch explicitly not foundation |
| `docs/superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md` | WP6 deferral; RpcServer normative inventory        |

---

_U3 deliverable: definition only. No patch edits. No runtime files. No commits._

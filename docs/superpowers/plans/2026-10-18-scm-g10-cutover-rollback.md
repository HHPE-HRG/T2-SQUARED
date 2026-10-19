---
title: SCM G10 cutover and rollback plan
date: 2026-10-18
status: runtime-authorized
design: docs/superpowers/specs/2026-10-18-scm-g10-cutover-rollback-design.md
package: docs/scm/g10/
implementation_authorized: true
g9toG10Authorized: true
proof_bar: docs/scm/g10/proof-bar.md
seam_inventory: docs/scm/g10/seam-inventory-completeness.json
governance: docs/scm/g10/governance/clean-slice-panel.md
---

# SCM G10 cutover and rollback plan

<!-- Agent: single campaign plan for slices S0–S8. Definition DoD closed (H2).
Runtime authorized 2026-10-18 (authorization.md + g9toG10Authorized).
Clean-slice lands: docs/scm/g10/governance/clean-slice-panel.md. -->

## Goal

Define (and later, only after runtime auth, implement) **full Increment 6**
cutover/rollback so inventoried T2 surfaces communicate through the SCM
manifold, as **one session of multiple cutover slices** S0–S8.

## Constraints

- Prerequisite: G9 Mode B landed (`docs/scm/g9/definition-progress.md`).
- Decisions: `docs/scm/g10/decisions.md` (1A + 2A one-session slices).
- Matrix: `docs/scm/g10/integration-readiness.md`.
- Inventory: `docs/scm/g10/seam-inventory-completeness.md` (**74/74**).
- Proof bar: `docs/scm/g10/proof-bar.md`.
- Cohesion: `docs/scm/g10/cross-slice-cohesion-index.md`.
- Auth later: `docs/scm/g10/runtime-auth-ceremony.md`.
- Hard locks: no codec; no eleventh bus; no G9-763-as-G10-proof; HHPE off-git.

## Slice order

```text
S0 foundation contracts
  → S1 orch/events+queue
  → S2 ws + server settings
  → S3 git + relay
  → S4 provider (+ MCP)
  → S5 terminal / Manager
  → S6 observability / Effect consumers
  → S7 persistence / remaining locals
  → S8 campaign close (dual-run exit audit + rollback + proof bar)
```

Barrier: S0 before S1–S7. S1–S7 definition may proceed in parallel after S0
freeze; runtime lands respect sole-owner hotspots. S8 last.

---

## S0 — Foundation contracts

**Owner:** G10-S0-Foundation  
**Files (later runtime):** new G10 cutover coordinator / bootstrap substitution
module under `apps/server/src/scm/g10*` (name frozen at runtime auth); Layer
wiring notes in `server.ts` (text only now).

### DoD (definition)

- [x] **Substitution model:** Per-slice cutover installs a manifold Layer that
      becomes the authority path for assigned `comm_id`s. G9
      `T2CODE_SCM_G9_SHADOW` observe-beside remains available for non-cut-over
      rows but is **not** the cutover switch. Cutover is an explicit
      admit/route/replace at named seams (see slices), not post-success
      `captureOccurrence`.
- [x] **Rollback switch contract:** Each S1–S7 exposes a per-slice restore to
      pre-cutover live path; S8 exposes campaign-wide restore. Rollback does
      not add a halt controller (G7 DIP unchanged). Rollback ≠ unset shadow env.
- [x] **Proof harness shape:** Normative bar in `docs/scm/g10/proof-bar.md`
      (cutover ≡ + rollback drill; explicitly not WP8 763).
- [x] **Ordered proof bar:** `proof-bar.md` **Ordered proof (in-session)** is
      normative — S0 green before fabric land; per slice land →
      live-authoritative rehearsal → ≡ → restore → exit → arm inversion; not
      OQ7 (`decisions.md`, `session-runbook.md` §2).
- [x] **Campaign radius (defined):** inventory-authoritative activatable
      `comm_id` set (`session-runbook.md` §1); neither shrink nor expand.
- [x] **Noninterference inversion policy:** On cut-over surfaces, manifold
      failure may fail the user-visible operation **after** that slice’s
      Ordered proof exit. Non-cut-over surfaces keep G9 observe-beside
      noninterference (SCM fail must not fail live).

### DoD (runtime — deferred)

- [x] Contracts implemented behind runtime auth only.
- [x] Default remains today’s live until slice exit.
- [x] Ordered proof S0 gate evidence `S0-contracts.md` landed green before
      S1–S7 fabric.

---

## S1 — Orch events + queue

**Owner:** G10-S1-Orch  
**Inventory:** 7 `comm_id`s — `INV-T2-LIFECYCLE-EVENTS`, `INV-T2-ORCH-EVENTS`,
`INV-T2-ORCH-QUEUE`, `INV-T2-PREVIEW-AUTO`, `INV-T2-PROJECT-QUEUE`,
`INV-T2-SETTINGS-EVENTS`, `INV-T2-VCS-EVENTS` (see seam inventory).  
**G9 seams / handoffs:**
`docs/scm/g9/wp5/handoffs/B1-ORCH-EVENTS-slice.md`; foundation ORCH-QUEUE on
`OrchestrationEngine.ts` (Slice sole owner).

### DoD (definition)

- [x] **Seams:** `apps/server/src/orchestration/Layers/OrchestrationEngine.ts`
      — domain-event publish sites (~ORCH-EVENTS) and queue-offer site
      (`queue-offered` / ORCH-QUEUE). Other S1 rows use ledger
      `capture_module`/`capture_symbol` from inventory JSON as cutover seams.
- [x] **Admit/route/replace:** Manifold becomes the publish/offer authority
      for assigned rows. G9 post-success `captureOccurrence` is not cutover.
- [x] **Dual-run exit:** Measurable per `decisions.md` / Ordered proof: (a)
      manifold wired for all 7 S1 `comm_id`s, (b) live-authoritative rehearsal
      green, (c) cutover ≡ recorded, (d) rollback drill once OK, (e) **then**
      live Engine/orch path marked retired. Exit only after rehearsal + ≡ +
      restore.
- [x] **Rollback:** Restore pre-cutover Engine publish/offer wiring for S1
      rows; re-prove live authority (**before** dual-run exit; also once in
      live rehearsal).
- [x] **Noninterference inversion:** After dual-run exit (Ordered proof),
      manifold failure may fail user-visible orch ops for S1 rows; arm only
      after exit.
- [x] **Proof:** Per `docs/scm/g10/proof-bar.md` Ordered proof —
      live-rehearsal, ≡, rollback, dual-run exit, inversion evidence names.

### DoD (runtime — deferred)

- [x] Sole owner edits Engine for cutover (RFC-023 style).
- [x] Slice proof package landed.

---

## S2 — WS + server settings

**Owner:** G10-S2-WsSettings  
**Inventory:** 3 `comm_id`s — `INV-T2-ORCH-LIVE`, `INV-T2-FILE-SETTINGS`,
`INV-T2-FLAG-SERVER-CONFIG`.  
**G9 seams / handoffs:** `docs/scm/g9/wp5/handoffs/B1-orch-live-ws.md`,
`docs/scm/g9/wp5/handoffs/b2-to-b1-server-settings.md`.

### DoD (definition)

- [x] **Seams:** `apps/server/src/ws.ts` — `liveBuffer` Queue.offer I/O
      authority points (`live-buffer-offered`); `apps/server/src/serverSettings.ts` —
      settings file exists/read/write I/O phases; server-config flag
      resolution per ledger `capture_module` for `INV-T2-FLAG-SERVER-CONFIG`.
- [x] **Admit/route/replace:** Manifold becomes liveBuffer/settings **I/O
      authority** at those seams (replace, not “success-boundary” capture);
      ≠ capture-beside after liveBuffer/settings I/O. `ws.ts` commits are
      **S6 lander** with S2 handoff for ORCH-LIVE (cohesion index).
- [x] **Dual-run exit:** Measurable per `decisions.md` / Ordered proof for all
      3 S2 `comm_id`s; live path retired **after** live-rehearsal + ≡ +
      rollback drill green.
- [x] **Rollback:** Restore liveBuffer/settings I/O authority (**before** exit;
      also once in live rehearsal).
- [x] **Noninterference inversion:** After dual-run exit, manifold failure may
      fail user-visible ws/settings ops; arm only after exit.
- [x] **Proof:** `proof-bar.md` Ordered proof S2 evidence (incl. live-rehearsal).

### DoD (runtime)

- [x] S2 lands settings/`cli/config` cutover; delivers ORCH-LIVE **handoff**
      to **S6** sole lander for `ws.ts` (S2 does not commit `ws.ts`).
- [x] Slice proof package landed.

---

## S3 — Git + relay

**Owner:** G10-S3-GitRelay  
**Inventory:** 16 B3 `comm_id`s (GIT, RELAY-\*, SC-\*, NET-TCP, HTTP-SERVE,
TAILSCALE, EDITOR-LAUNCH, PREVIEW-SCAN, PROJECT-SETUP, TEL-ANALYTICS,
TEL-DESKTOP-CONTROL, …) — full list in seam inventory.  
**G9 seams / handoffs:** `docs/scm/g9/wp5/handoffs/B3-VcsDriver-GIT.md`,
`B3-relayClient-RELAY-CLIENT.md`, `b2-to-b3-vcs-relay.md`.

### DoD (definition)

- [x] **Seams:** Primary hotspots `apps/server/src/vcs/VcsDriver.ts`,
      `packages/shared/src/relayClient.ts`, plus each S3 row’s ledger
      `capture_module`/`capture_symbol` from inventory JSON.
- [x] **Admit/route/replace:** Manifold for inventoried GIT/RELAY/external-
      transport S3 rows at those seams. S3 is sole lander for VcsDriver +
      relayClient; S7 handoffs FILE-CHECKPOINTS / FLAG-CLOUDFLARED.
      `INV-T2-TEL-DESKTOP-CONTROL` on `DesktopTelemetryReceiver.ts` is an
      S3-owned `comm_id` with **handoff to S5** sole lander (S3 does not
      commit that file).
- [x] **Dual-run exit:** Measurable per `decisions.md` / Ordered proof for all
      16 S3 `comm_id`s; exit **after** live-rehearsal + ≡ + rollback drill green.
- [x] **Rollback:** Restore VcsDriver/relayClient (and peer) live paths
      **before** exit (and once in live rehearsal); DesktopTelemetryReceiver
      restore owned by S5 lander.
- [x] **Noninterference inversion:** After dual-run exit, manifold failure may
      fail user-visible VCS/relay ops; arm only after exit.
- [x] **Proof:** `proof-bar.md` Ordered proof S3 evidence (incl. live-rehearsal).

### DoD (runtime)

- [x] Sole owner lands VCS/relay cutover (`g10SliceS3.ts` + VcsDriver /
      relayClient sole landers + B3 peer call sites; TEL-DESKTOP-CONTROL
      handoff to S5; FILE-CHECKPOINTS / FLAG-CLOUDFLARED not stolen).
- [x] Slice proof package landed (`docs/scm/g10/evidence/S3-*.md` Ordered
      proof via `recordOrderedProofStep`; targeted `g10SliceS3.test.ts`).

---

## S4 — Provider (+ MCP)

**Owner:** G10-S4-Provider  
**Inventory:** 16 B4 `comm_id`s including all `INV-T2-PROVIDER-*`,
`INV-T2-HTTP-*` (auth/connect/meta/orch/pr/static), `INV-T2-MCP-HTTP`.  
**G9 seams:** `apps/server/src/provider/**`; MCP via
`apps/server/src/mcp/McpHttpServer.ts`; Environment HTTP APIs via
`packages/contracts/src/environmentHttp.ts`; static assets via
`apps/server/src/http.ts` (**S4** sole G10 lander for cutover on those
files; G9 WP6 was the historical MCP capture lander — not a second G10
commit owner).

### DoD (definition)

- [x] **Seams:** Provider runtime modules per ledger `capture_module` under
      `provider/**`; MCP HTTP including `mcp-http-session-deleted` on
      `McpHttpServer.ts`; `INV-T2-HTTP-{AUTH,CONNECT,META,ORCH,PR}` on
      `packages/contracts/src/environmentHttp.ts`
      (`Environment{Auth,Connect,Metadata,Orchestration,PullRequests}HttpApi`);
      `INV-T2-HTTP-STATIC` on `apps/server/src/http.ts`. Remaining S4
      provider `comm_id`s use ledger `capture_module` under `provider/**`
      as cutover seams (S1/S3 pattern).
- [x] **Admit/route/replace:** Manifold authority for S4 rows at those seams.
      S4 sole lander for `provider/**` + `McpHttpServer.ts` +
      `environmentHttp.ts` + `http.ts`; S7 handoffs FILE-PROVIDER-SESSION
      cache phases under `provider/**`, FILE-LOGS provider-event-log, and
      FLAG-CODEX-LAUNCH. S7 retains sole lander for
      `ProviderSessionRuntime.ts` binding phases (not under `provider/**`).
- [x] **Dual-run exit:** Measurable per `decisions.md` / Ordered proof for all
      16 S4 `comm_id`s; exit **after** live-rehearsal + ≡ + rollback drill green.
- [x] **Rollback:** Restore pre-cutover live paths for all S4 lander seams
      **before** exit (and once in live rehearsal): `provider/**`,
      `McpHttpServer.ts`, `packages/contracts/src/environmentHttp.ts`, and
      `apps/server/src/http.ts` (provider + MCP + HTTP AUTH/CONNECT/META/ORCH/PR + STATIC).
- [x] **MCP ownership:** S4 owns MCP cutover in this campaign (no deferred
      multi-session).
- [x] **Noninterference inversion:** After dual-run exit, manifold failure may
      fail user-visible provider/MCP/HTTP ops; arm only after exit.
- [x] **Proof:** `proof-bar.md` Ordered proof S4 evidence (incl. live-rehearsal).

### DoD (runtime)

- [x] Sole owner lands provider/MCP/HTTP cutover (`g10SliceS4.ts` + sole landers
      `provider/**`, `McpHttpServer.ts`, `environmentHttp.ts`, `http.ts`; S7
      handoffs FILE-PROVIDER-SESSION / FILE-LOGS provider-event-log /
      FLAG-CODEX-LAUNCH reserved — not stolen).
- [x] Slice proof package landed (`docs/scm/g10/evidence/S4-*.md` five files;
      Ordered proof via `recordOrderedProofStep` only).

---

## S5 — Terminal / Manager

**Owner:** G10-S5-Terminal  
**Inventory:** 5 `comm_id`s — `INV-T2-TERM`, `INV-T2-RES-MONITOR`,
`INV-T2-TEL-DESKTOP-IN`, `INV-T2-TEL-NDJSON`, `INV-T2-TEL-T3-TRACE`.  
**G9 seams:** `apps/server/src/terminal/Manager.ts`;
`apps/server/src/resourceTelemetry/NativeTelemetryClient.ts` (RES-MONITOR);
DesktopTelemetry / Observability handoffs where ledger points.

### DoD (definition)

- [x] **Seams:** `terminal/Manager.ts` TERM stream phases;
      `NativeTelemetryClient.ts` for `INV-T2-RES-MONITOR` (monitor spawn /
      stdin write / event decode); `DesktopTelemetryReceiver.ts` for
      TEL-DESKTOP-IN; TEL-NDJSON / TEL-T3-TRACE via handoffs to S6 landers on
      `T2Observability.ts` / `Observability.ts` (S5 owns `comm_id`, does not
      commit those files).
- [x] **Admit/route/replace:** Manifold for all 5 S5 inventoried `comm_id`s;
      S5 sole lander for Manager + DesktopTelemetryReceiver +
      NativeTelemetryClient; S7 handoffs FILE-LOGS terminalLogs phase /
      FLAG-TERM-ENV onto Manager.
- [x] **Dual-run exit:** Measurable per `decisions.md` / Ordered proof for all
      5 S5 `comm_id`s; exit **after** live-rehearsal + ≡ + rollback drill green.
- [x] **Rollback:** Restore S5 sole-lander files **before** exit (and once in
      live rehearsal): `terminal/Manager.ts`, `NativeTelemetryClient.ts`,
      `DesktopTelemetryReceiver.ts`. TEL-NDJSON / TEL-T3-TRACE restore stays
      with S6 landers on `T2Observability.ts` / `Observability.ts` (S5 does
      not commit those files).
- [x] **Noninterference inversion:** After dual-run exit, manifold failure may
      fail user-visible terminal/telemetry-in ops; arm only after exit.
- [x] **Proof:** `proof-bar.md` Ordered proof S5 evidence (incl. live-rehearsal).

### DoD (runtime)

- [x] Sole owner lands Manager/telemetry cutover (`g10SliceS5.ts` + sole landers
      `terminal/Manager.ts`, `NativeTelemetryClient.ts`, `DesktopTelemetryReceiver.ts`;
      S3 TEL-DESKTOP-CONTROL handoff landed; TEL-NDJSON / TEL-T3-TRACE handoffs
      to S6; FILE-LOGS terminalLogs / FLAG-TERM-ENV not stolen).
- [x] Slice proof package landed (`docs/scm/g10/evidence/S5-*.md` five files;
      Ordered proof via `recordOrderedProofStep`; targeted `g10SliceS5.test.ts`).

---

## S6 — Observability / Effect consumers

**Owner:** G10-S6-ObsEffect  
**Inventory:** 13 `comm_id`s — B6 `INV-T2-SCM-HOME-BUS-LINK` (**dormant-
preserved**, no activation), WP6 ten RPC/OTLP rows, plus
`INV-T2-FLAG-T2-OTEL`, `INV-T2-FLAG-T3-OTEL`.  
**G9 seams:** `T2Observability.ts`, `Observability.ts`, `ws.ts` RpcServer
hooks, Effect patch consumers; home-bus fixtures only.

### DoD (definition)

- [x] **Seams:** `apps/server/src/ws.ts` RpcServer admit/unary/stream hooks
      (S6 sole lander; integrates S2 ORCH-LIVE handoff);
      `T2Observability.ts` / `Observability.ts` OTLP + flag seams; Effect
      patch consumers; home-bus fixtures only on `g6HomeBusLink.ts`;
      `INV-T2-FLAG-T3-OTEL` hotspot `apps/server/src/cli/config.ts` with
      **handoff to S2** sole lander (S6 owns `comm_id`, does not commit
      `cli/config.ts`).
- [x] **Admit/route/replace:** Manifold authority for activatable S6 rows at
      those seams — not observe-beside capture after live success.
- [x] **Cut-over vs observe-after:** RPC/OTLP/flag rows become manifold
      authority where cut over. Pure OTEL export observation remains
      observational and must not own DIP/cutover switches.
- [x] **Export failure:** Must not mutate non-obs live state (G9 law retained).
- [x] **Home-bus-link:** Remains dormant-preserved; not a cutover target;
      exempt from dual-run exit.
- [x] **Dual-run exit:** Measurable per `decisions.md` / Ordered proof for 12
      activatable S6 `comm_id`s (except home-bus-link); exit **after**
      live-rehearsal + ≡ + rollback drill green.
- [x] **Rollback:** Restore pre-cutover live/hook wiring for those 12 rows
      **before** exit (and once in live rehearsal).
- [x] **Noninterference inversion:** After dual-run exit, manifold failure may
      fail user-visible RPC/OTLP/flag ops; arm only after exit (dormant exempt).
- [x] **Proof:** `proof-bar.md` Ordered proof S6 evidence incl. live-rehearsal
      (dormant exempt).

### DoD (runtime)

- [x] Sole owner lands obs/Effect cutover where in scope (ws.ts / T2Observability /
      Observability.ts; FLAG-T3-OTEL handoff to S2; home-bus dormant-exempt).
- [x] Slice proof package landed (`docs/scm/g10/evidence/S6-*.md` + `g10SliceS6`).

---

## S7 — Persistence / remaining locals

**Owner:** G10-S7-Persistence  
**Inventory:** 14 B2 remainder `comm_id`s (FILE-\* except SETTINGS,
PROJECT-SQL, SQLITE, PROJECT-READ, FILE-ATTACHMENTS/CHECKPOINTS/LOGS/
PROVIDER-SESSION/RUNTIME-STATE/SECRETS/USAGE-CACHE/WORKTREES, FLAG-CLOUDFLARED,
FLAG-CODEX-LAUNCH, FLAG-TERM-ENV) — exact list in seam inventory
`per_slice_comm_ids.S7`.

### DoD (definition)

- [x] **Inventory:** S7 = B2 remainder after S2/S6 specializations; **14**
      `comm_id`s listed in `seam-inventory-completeness.json`
      `per_slice_comm_ids.S7`; no silent drop (74 = S1…S7).
- [x] **Seams (by lander):** - S7 sole lander (exact files): - PROJECT-SQL → `persistence/Services/ProjectionCheckpoints.ts`,
      `ProjectionPendingApprovals.ts`, `ProjectionProjects.ts`,
      `ProjectionState.ts`, `ProjectionThreadActivities.ts`,
      `ProjectionThreadMessages.ts`, `ProjectionThreadProposedPlans.ts`,
      `ProjectionThreadSessions.ts`, `ProjectionThreads.ts`,
      `ProjectionTurns.ts` - SQLITE → `persistence/NodeSqliteClient.ts` - PROJECT-READ → `orchestration/Services/ProjectionSnapshotQuery.ts` - FILE-ATTACHMENTS → `orchestration/Normalizer.ts` - FILE-RUNTIME-STATE → `environment/ServerEnvironment.ts`,
      `serverRuntimeState.ts`, `telemetry/Identify.ts`, `keybindings.ts` - FILE-SECRETS → `apps/server/src/config.ts` - FILE-USAGE-CACHE → `usage/UsageService.ts` - FILE-WORKTREES → `vcs/GitVcsDriverCore.ts` - FILE-LOGS directory-create + `serverLogPath-declared` →
      `apps/server/src/config.ts` - FILE-PROVIDER-SESSION binding upsert/get/list/delete →
      `persistence/ProviderSessionRuntime.ts` - Handoff to **S3** lander: FILE-CHECKPOINTS → `VcsDriver.ts`;
      FLAG-CLOUDFLARED → `relayClient.ts`. - Handoff to **S4** lander: FILE-PROVIDER-SESSION
      `providerStatusCache` read/write phases + FLAG-CODEX-LAUNCH +
      FILE-LOGS provider-event-log phase → `provider/**` (S4 sole commit
      on those files; S7 does not commit `provider/**`). - Handoff to **S5** lander: FILE-LOGS terminalLogs phase +
      FLAG-TERM-ENV → `Manager.ts`.
- [x] **Admit/route/replace:** Manifold becomes authority at each listed seam
      (lander commits; S7 authors handoff patches for foreign hotspots).
- [x] **Dual-run exit:** Measurable per `decisions.md` / Ordered proof for all
      14 S7 `comm_id`s; exit **after** live-rehearsal + ≡ + rollback drill green.
- [x] **Rollback:** Restore pre-cutover live I/O for all 14 S7 `comm_id`s
      **before** exit (and once in live rehearsal) by executing restore on the
      **named** sole-lander files listed in Seams above (Projection\*,
      NodeSqliteClient, ProjectionSnapshotQuery, Normalizer,
      ServerEnvironment/serverRuntimeState/Identify/keybindings, `config.ts`,
      UsageService, GitVcsDriverCore, ProviderSessionRuntime); foreign
      hotspots restore via S3/S4/S5 landers.
- [x] **Noninterference inversion:** After dual-run exit, manifold failure may
      fail user-visible persistence/local ops; arm only after exit.
- [x] **Proof:** `proof-bar.md` Ordered proof S7 evidence incl. live-rehearsal;
      phase count must match inventory JSON for S7.

### DoD (runtime)

- [x] Remaining locals cut over on S7 sole landers (Projection Layers\*,
      NodeSqliteClient, ProjectionSnapshotQuery, Normalizer, runtime-state
      files, config.ts, UsageService, GitVcsDriverCore, ProviderSessionRuntime);
      foreign hotspots authored as S7→S3/S4/S5 handoffs (not stolen).
- [x] Slice proof package landed (`docs/scm/g10/evidence/S7-*.md` five files;
      `g10SliceS7` + tests; Ordered proof via `recordOrderedProofStep` only).

---

## S8 — Campaign close

**Owner:** G10-S8-Campaign  
**Depends on:** S0–S7 definition closed (runtime: all slice proofs).

### DoD (definition)

- [x] **Cross-slice dual-run exit audit:** Checklist = every **radius-set**
      activatable `comm_id` has completed Ordered proof sequence
      (live-rehearsal → ≡ → restore → exit → inversion armed) on its S1–S7
      slice (`proof-bar.md` S8 + Ordered proof; `session-runbook.md` §1).
- [x] **Full-campaign rollback drill:** Single procedure restores pre-G10 live
      for all cut-over slices (`proof-bar.md` S8-campaign-rollback-drill).
- [x] **G10 proof bar document:** `docs/scm/g10/proof-bar.md` — Ordered proof
      (incl. live rehearsal) + aggregate cutover ≡ + rollback; **forbidden**
      to close via WP8 763 alone or to resize the radius set.
- [x] **One session:** All surfaces S0–S8 encompassed in this one campaign
      (decisions 1A/2A); no multi-session per-platform cutover; Ordered proof
      sequencing inside the session; campaign radius defined/frozen.

### DoD (runtime)

- [x] Campaign proof package accepted (Worker proposal; panel VOTE_READY):
      `docs/scm/g10/evidence/S8-dual-run-exit-audit.md` (73 activatable + 1
      dormant), `S8-campaign-rollback-drill.md`,
      `S8-campaign-cutover-equivalence.md` under `G9DeferredEquality` (not 763);
      `g10SliceS8.ts` + tests; critical residuals lander-reopen-wired;
      phase residuals operator-accepted; radius unchanged; home-bus dormant.
- [x] Still does not unlock codec or later gates beyond G10 completion
      ceremony in package manifest.

---

## Cross-slice cohesion

See `docs/scm/g10/cross-slice-cohesion-index.md` for owners, shared contracts,
and hotspot exclusion rules. Seam completeness: **74/74** in
`seam-inventory-completeness.md`.

## Open questions

None blocking definition. Runtime naming of `g10*` modules deferred to
runtime auth (ceremony doc).

## Out of scope

- Runtime code in this plan pass
- `authorization.md` / `g9toG10Authorized` flip
- Codec / nibble / eleventh bus
- Multi-session per-platform cutover

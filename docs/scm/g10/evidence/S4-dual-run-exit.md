# S4 dual-run-exit evidence

<!-- Agent: G10 S4 Ordered proof step 5. Live path retired for all sixteen wired S4 seams. -->

- Date: 2026-10-18
- Slice: **S4**
- Step: **dual-run-exit**
- Phase: `exited`
- Authority: **manifold**
- inversionArmed: `false` (armed only at next step)
- S4 inventory comm_ids (16): INV-T2-HTTP-AUTH, INV-T2-HTTP-CONNECT, INV-T2-HTTP-META, INV-T2-HTTP-ORCH, INV-T2-HTTP-PR, INV-T2-HTTP-STATIC, INV-T2-MCP-HTTP, INV-T2-PROVIDER-CLAUDE, INV-T2-PROVIDER-CODEX, INV-T2-PROVIDER-CURSOR, INV-T2-PROVIDER-EVENTS, INV-T2-PROVIDER-GROK, INV-T2-PROVIDER-LIST-EVENTS, INV-T2-PROVIDER-OPENCODE, INV-T2-PROVIDER-PERM, INV-T2-PROVIDER-TURN

## Wired + exited (16) — exit criteria (a)/(e)

Manifold admit/route/replace wired via `g10SeamBridge`; live path retired for:

| comm_id                       | Call site                                                        |
| ----------------------------- | ---------------------------------------------------------------- |
| `INV-T2-HTTP-AUTH`            | `withHttpAuthCapture` → EnvironmentAuthHttpApi handlers          |
| `INV-T2-HTTP-CONNECT`         | `withHttpConnectCapture` → EnvironmentConnectHttpApi handlers    |
| `INV-T2-HTTP-META`            | `withHttpMetaCapture` → `http.ts` descriptor                     |
| `INV-T2-HTTP-ORCH`            | `withHttpOrchCapture` → EnvironmentOrchestrationHttpApi handlers |
| `INV-T2-HTTP-PR`              | `withHttpPrCapture` → EnvironmentPullRequestsHttpApi             |
| `INV-T2-HTTP-STATIC`          | `http.ts` (sole lander)                                          |
| `INV-T2-MCP-HTTP`             | `McpHttpServer.ts` (sole lander)                                 |
| `INV-T2-PROVIDER-CLAUDE`      | `ClaudeAdapter.ts`                                               |
| `INV-T2-PROVIDER-CODEX`       | `CodexSessionRuntime.ts`                                         |
| `INV-T2-PROVIDER-CURSOR`      | `AcpSessionRuntime.ts` (via CursorAdapter g9SpawnCommId)         |
| `INV-T2-PROVIDER-EVENTS`      | `ProviderService.ts`                                             |
| `INV-T2-PROVIDER-GROK`        | `AcpSessionRuntime.ts` (via GrokAdapter g9SpawnCommId)           |
| `INV-T2-PROVIDER-LIST-EVENTS` | `ProviderRegistry.ts`                                            |
| `INV-T2-PROVIDER-OPENCODE`    | `opencodeRuntime.ts`                                             |
| `INV-T2-PROVIDER-PERM`        | `AcpSessionRuntime.ts`                                           |
| `INV-T2-PROVIDER-TURN`        | `ProviderService.ts`                                             |

## S7 handoffs — not exit (a) under S4

| comm_id                                 | Status                                                               |
| --------------------------------------- | -------------------------------------------------------------------- |
| `INV-T2-FILE-PROVIDER-SESSION`          | S7→S4 lander slot reserved on `providerStatusCache.ts` — not stolen  |
| `INV-T2-FILE-LOGS` (provider-event-log) | S7→S4 lander slot reserved on `ProviderEventLoggers.ts` — not stolen |
| `INV-T2-FLAG-CODEX-LAUNCH`              | S7→S4 lander slot reserved on `codexLaunchArgs.ts` — not stolen      |

## Measurable exit (decisions.md) — scoped

- (a) Manifold admit/route/replace wired for all **sixteen S4** seams above
- (b) Live-authoritative rehearsal green (`S4-live-rehearsal.md`)
- (c) Cutover ≡ recorded (`S4-cutover-equivalence.md`)
- (d) Rollback drill once OK (`S4-rollback-drill.md`)
- (e) Live path marked retired for the **wired sixteen** — **this record**

## Sole owner

Authority flip performed **only** by `recordOrderedProofStep(model, "S4", "dual-run-exit")`
(`g10ProofHarness.ts`). `markDualRunExited` **refuses** (S0 escalation
KEEP_A / `S0-escalation-proof-step-sole-owner.md`).

## Verdict

**GREEN** for S4 Ordered proof on all sixteen wired seams.

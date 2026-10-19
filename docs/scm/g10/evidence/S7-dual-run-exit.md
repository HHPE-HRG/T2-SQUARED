# S7 dual-run-exit evidence

<!-- Agent: G10 S7 Ordered proof step 5. Live path retired for ten wired S7 seams. -->

- Date: 2026-10-18
- Slice: **S7**
- Step: **dual-run-exit**
- Phase: `exited`
- Authority: **manifold**
- inversionArmed: `false` (armed only at next step)
- S7 activatable comm_ids (14): INV-T2-FILE-ATTACHMENTS, INV-T2-FILE-CHECKPOINTS, INV-T2-FILE-LOGS, INV-T2-FILE-PROVIDER-SESSION, INV-T2-FILE-RUNTIME-STATE, INV-T2-FILE-SECRETS, INV-T2-FILE-USAGE-CACHE, INV-T2-FILE-WORKTREES, INV-T2-FLAG-CLOUDFLARED, INV-T2-FLAG-CODEX-LAUNCH, INV-T2-FLAG-TERM-ENV, INV-T2-PROJECT-READ, INV-T2-PROJECT-SQL, INV-T2-SQLITE

## Wired + exited (10) — exit criteria (a)/(e)

Manifold admit/route/replace wired via `g10SeamBridge`; live path retired for:

| comm_id                        | Call site                                                             |
| ------------------------------ | --------------------------------------------------------------------- |
| `INV-T2-FILE-ATTACHMENTS`      | `Normalizer.ts`                                                       |
| `INV-T2-FILE-LOGS`             | `config.ts` (dir-create + serverLogPath declare; not foreign writers) |
| `INV-T2-FILE-PROVIDER-SESSION` | `ProviderSessionRuntime.ts` (binding phases)                          |
| `INV-T2-FILE-RUNTIME-STATE`    | ServerEnvironment / serverRuntimeState / Identify / keybindings       |
| `INV-T2-FILE-SECRETS`          | `config.ts` (secretsDir root)                                         |
| `INV-T2-FILE-USAGE-CACHE`      | `UsageService.ts`                                                     |
| `INV-T2-FILE-WORKTREES`        | `GitVcsDriverCore.ts`                                                 |
| `INV-T2-PROJECT-READ`          | `ProjectionSnapshotQuery` Layer                                       |
| `INV-T2-PROJECT-SQL`           | `persistence/Layers/Projection*`                                      |
| `INV-T2-SQLITE`                | `NodeSqliteClient.ts`                                                 |

## Handoff-deferred — not exit (a) under S7

| comm_id                    | Status                                        |
| -------------------------- | --------------------------------------------- |
| `INV-T2-FILE-CHECKPOINTS`  | S7→S3 handoff-pending on `VcsDriver.ts`       |
| `INV-T2-FLAG-CLOUDFLARED`  | S7→S3 handoff-pending on `relayClient.ts`     |
| `INV-T2-FLAG-CODEX-LAUNCH` | S7→S4 handoff-pending on `codexLaunchArgs.ts` |
| `INV-T2-FLAG-TERM-ENV`     | S7→S5 handoff-pending on `Manager.ts`         |

## Phase handoffs — not stolen under S7 exit (a)

| Phase                                             | Status                        |
| ------------------------------------------------- | ----------------------------- |
| FILE-LOGS `providerEventLogPath-writer-succeeded` | S7→S4 on ProviderEventLoggers |
| FILE-LOGS `terminalLogs-writer-succeeded`         | S7→S5 on Manager              |
| FILE-PROVIDER-SESSION cache read/write            | S7→S4 on providerStatusCache  |

## Measurable exit (decisions.md) — scoped

- (a) Manifold admit/route/replace wired for the **ten S7 wired** seams above
- (b) Live-authoritative rehearsal green (`S7-live-rehearsal.md`)
- (c) Cutover ≡ recorded (`S7-cutover-equivalence.md`)
- (d) Rollback drill once OK (`S7-rollback-drill.md`)
- (e) Live path marked retired for the **wired ten** — **this record**

Not an all-14 activatable Engine-wired exit claim (four foreign rows deferred).

## Sole owner

Authority flip performed **only** by `recordOrderedProofStep(model, "S7", "dual-run-exit")`
(`g10ProofHarness.ts`). `markDualRunExited` **refuses** (S0 escalation
KEEP_A / `S0-escalation-proof-step-sole-owner.md`).

## Verdict

**GREEN** for S7 Ordered proof on ten wired seams.

# S7 cutover-equivalence evidence

<!-- Agent: G10 S7 Ordered proof step 3. ≡ under G9DeferredEquality — honesty partition. -->

- Date: 2026-10-18
- Slice: **S7**
- Step: **cutover-equivalence**
- Phase: `equiv`
- Authority: **live**
- inversionArmed: `false`
- S7 inventory comm_ids (14): INV-T2-FILE-ATTACHMENTS, INV-T2-FILE-CHECKPOINTS, INV-T2-FILE-LOGS, INV-T2-FILE-PROVIDER-SESSION, INV-T2-FILE-RUNTIME-STATE, INV-T2-FILE-SECRETS, INV-T2-FILE-USAGE-CACHE, INV-T2-FILE-WORKTREES, INV-T2-FLAG-CLOUDFLARED, INV-T2-FLAG-CODEX-LAUNCH, INV-T2-FLAG-TERM-ENV, INV-T2-PROJECT-READ, INV-T2-PROJECT-SQL, INV-T2-SQLITE
- Inventory phase count: **72** (matches `seam-inventory-completeness.json`)
- Carrier: `asG9DeferredEquality` (`g10ProofHarness.ts` / `G9DeferredEquality`)

## Wired seams (10) — bridge traffic ≡

Live-vs-manifold identity after admit/route/replace via `g10SeamBridge`:

| comm_id                        | Sample projection (representative)                  |
| ------------------------------ | --------------------------------------------------- |
| `INV-T2-FILE-ATTACHMENTS`      | `{ "site": "writeFile" }`                           |
| `INV-T2-FILE-LOGS`             | `{ "member_id": "logsDir" }` (config.ts dir phases) |
| `INV-T2-FILE-PROVIDER-SESSION` | `{ "member_id": "upsert" }` (binding phases)        |
| `INV-T2-FILE-RUNTIME-STATE`    | `{ "member_id": "serverRuntimeStatePath" }`         |
| `INV-T2-FILE-SECRETS`          | `{ "comm_id": "present" }`                          |
| `INV-T2-FILE-USAGE-CACHE`      | `{ "comm_id": "present" }`                          |
| `INV-T2-FILE-WORKTREES`        | `{ "comm_id": "worktree-create-succeeded" }`        |
| `INV-T2-PROJECT-READ`          | `{ "method": "getSnapshot" }`                       |
| `INV-T2-PROJECT-SQL`           | `{ "repository": "upsert" }`                        |
| `INV-T2-SQLITE`                | `{ "operation": "execute" }`                        |

Call sites: Projection Layers\*, NodeSqliteClient, ProjectionSnapshotQuery,
Normalizer, runtime-state files, config.ts, UsageService, GitVcsDriverCore,
ProviderSessionRuntime via `g10SliceS7.ts` helpers.

## Handoff-deferred stubs (4) — ≡ carrier only

| comm_id                    | Status                                                 |
| -------------------------- | ------------------------------------------------------ |
| `INV-T2-FILE-CHECKPOINTS`  | S7→S3 handoff on `VcsDriver.ts`. Stub pair only.       |
| `INV-T2-FLAG-CLOUDFLARED`  | S7→S3 handoff on `relayClient.ts`. Stub pair only.     |
| `INV-T2-FLAG-CODEX-LAUNCH` | S7→S4 handoff on `codexLaunchArgs.ts`. Stub pair only. |
| `INV-T2-FLAG-TERM-ENV`     | S7→S5 handoff on `Manager.ts`. Stub pair only.         |

## Explicitly not

- WP8 763-fixture-as-G10-proof (`refuse763AsProof`)
- Stealing foreign sole-lander files (S3/S4/S5)

## Verdict

**GREEN** — wired ten ≡ under bridge traffic; stubs cover deferred four.

# S7 live-rehearsal evidence

<!-- Agent: G10 S7 Ordered proof step 2. Live remains authoritative; inversion not armed. -->

- Date: 2026-10-18
- Slice: **S7**
- Step: **live-rehearsal**
- Phase: `rehearsed`
- Authority: **live**
- inversionArmed: `false`
- S7 activatable comm_ids (14): INV-T2-FILE-ATTACHMENTS, INV-T2-FILE-CHECKPOINTS, INV-T2-FILE-LOGS, INV-T2-FILE-PROVIDER-SESSION, INV-T2-FILE-RUNTIME-STATE, INV-T2-FILE-SECRETS, INV-T2-FILE-USAGE-CACHE, INV-T2-FILE-WORKTREES, INV-T2-FLAG-CLOUDFLARED, INV-T2-FLAG-CODEX-LAUNCH, INV-T2-FLAG-TERM-ENV, INV-T2-PROJECT-READ, INV-T2-PROJECT-SQL, INV-T2-SQLITE
- Inventory phase count: **72**
- Runtime: `apps/server/src/scm/g10SliceS7.ts` + `g10SeamBridge.ts`
- Sole landers: Projection Layers\*, NodeSqliteClient, ProjectionSnapshotQuery Layer, Normalizer, ServerEnvironment/serverRuntimeState/Identify/keybindings, config.ts, UsageService, GitVcsDriverCore, ProviderSessionRuntime
- Handoff-deferred: VcsDriver (CHECKPOINTS), relayClient (CLOUDFLARED), provider/\*\* (cache/logs/codex), Manager (terminalLogs/TERM-ENV)

## Notes

- admit/route/replace already landed; dual-run observe exercised on **ten
  wired** S7 seams via `runG10SeamBridge` (live authoritative; manifold
  observe-beside isolated).
- Four foreign-hotspot handoff stubs only (S3/S4/S5 landers; S7 does not
  commit those files).
- One rollback restore (`restorePreCutoverLive`) + re-land under live authority;
  live re-proven.
- Inversion not armed; treating rehearsal as exit/inversion is forbidden.

## Verdict

**GREEN**

# S4 live-rehearsal evidence

<!-- Agent: G10 S4 Ordered proof step 2. Live remains authoritative; inversion not armed. -->

- Date: 2026-10-18
- Slice: **S4**
- Step: **live-rehearsal**
- Phase: `rehearsed`
- Authority: **live**
- inversionArmed: `false`
- S4 inventory comm_ids (16): INV-T2-HTTP-AUTH, INV-T2-HTTP-CONNECT, INV-T2-HTTP-META, INV-T2-HTTP-ORCH, INV-T2-HTTP-PR, INV-T2-HTTP-STATIC, INV-T2-MCP-HTTP, INV-T2-PROVIDER-CLAUDE, INV-T2-PROVIDER-CODEX, INV-T2-PROVIDER-CURSOR, INV-T2-PROVIDER-EVENTS, INV-T2-PROVIDER-GROK, INV-T2-PROVIDER-LIST-EVENTS, INV-T2-PROVIDER-OPENCODE, INV-T2-PROVIDER-PERM, INV-T2-PROVIDER-TURN
- Runtime: `apps/server/src/scm/g10SliceS4.ts` + `g10SeamBridge.ts`
- Sole landers: `provider/**`, `McpHttpServer.ts`, `environmentHttp.ts`, `http.ts`
- S7 handoffs reserved (not stolen): FILE-PROVIDER-SESSION cache, FILE-LOGS provider-event-log, FLAG-CODEX-LAUNCH

## Notes

- admit/route/replace already landed; dual-run observe exercised on **sixteen wired**
  S4 seams via `runG10SeamBridge` (live authoritative; manifold observe-beside isolated).
- One rollback restore (`restorePreCutoverLive`) + re-land under live authority; live re-proven.
- Inversion not armed; treating rehearsal as exit/inversion is forbidden.
- S7 handoffs on the provider tree left for S7 — not claimed under S4 rehearsal.

## Verdict

**GREEN**

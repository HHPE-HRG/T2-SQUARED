# S4 rollback-drill evidence

<!-- Agent: G10 S4 Ordered proof step 4. Restore pre-cutover live before dual-run exit. -->

- Date: 2026-10-18
- Slice: **S4**
- Step: **rollback-drill**
- Phase: `restored`
- Authority: **live**
- inversionArmed: `false`
- S4 inventory comm_ids (16): INV-T2-HTTP-AUTH, INV-T2-HTTP-CONNECT, INV-T2-HTTP-META, INV-T2-HTTP-ORCH, INV-T2-HTTP-PR, INV-T2-HTTP-STATIC, INV-T2-MCP-HTTP, INV-T2-PROVIDER-CLAUDE, INV-T2-PROVIDER-CODEX, INV-T2-PROVIDER-CURSOR, INV-T2-PROVIDER-EVENTS, INV-T2-PROVIDER-GROK, INV-T2-PROVIDER-LIST-EVENTS, INV-T2-PROVIDER-OPENCODE, INV-T2-PROVIDER-PERM, INV-T2-PROVIDER-TURN

## Notes

- `restorePreCutoverLive` restored live authority for S4.
- Rollback ≠ unset `T2CODE_SCM_G9_SHADOW`; no halt controller.
- Re-proved live-authoritative bridge selection for `INV-T2-PROVIDER-TURN`.
- Restore scope: `provider/**`, `McpHttpServer.ts`, `environmentHttp.ts`, `http.ts`.

## Verdict

**GREEN**

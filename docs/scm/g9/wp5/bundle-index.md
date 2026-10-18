# WP5 family bundle index (U2)

<!-- Agent: definition only. Links bundles to plan sections. Not runtime. -->

- Date: 2026-10-17
- Unit: **U2** — WP5 family-bundle plan set
- Plan: [`docs/superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md`](../../superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md)
- Ledger: `docs/scm/g9/coverage-ledger.json` (74 rows; do not hand-edit)
- `implementation_authorized: false` — no `apps/server/src/scm/g9*.ts` in this pass

| Bundle id                          | Family module (proposed)                 |                       Rows | Plan section                                                                                                            |
| ---------------------------------- | ---------------------------------------- | -------------------------: | ----------------------------------------------------------------------------------------------------------------------- |
| `B1` queue-pubsub-callback         | `g9FamilyQueuePubSubCallback.ts`         |                          8 | [§ B1](../../superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md#b1-queue-pubsub-callback)                   |
| `B2` file-db-process-config        | `g9FamilyFileDbProcessConfig.ts`         |                         18 | [§ B2](../../superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md#b2-file-db-process-config)                  |
| `B3` subprocess-external-transport | `g9FamilySubprocessExternalTransport.ts` |                         16 | [§ B3](../../superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md#b3-subprocess-external-transport)           |
| `B4` provider-protocol             | `g9FamilyProviderProtocol.ts`            |                         16 | [§ B4](../../superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md#b4-provider-protocol)                       |
| `B5` terminal-local-streams        | `g9FamilyTerminalLocalStreams.ts`        |                          5 | [§ B5](../../superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md#b5-terminal-local-streams)                  |
| `B6` dormant-home-bus-link         | `g9FamilyHomeBusLinkFixtures.ts`         |                          1 | [§ B6](../../superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md#b6-dormant-home-bus-link)                   |
| WP6 deferral (typed hooks)         | _(U3; not WP5 modules)_                  | 10 full rows + 1 MCP phase | [§ WP6 deferral](../../superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md#wp6-deferral-planned_typed_hooks) |

**Assignment:** 64 `comm_id`s in WP5 bundles + 10 `comm_id`s fully deferred to WP6 = **74 accounted**. Phase-level WP6 deferral: `INV-T2-MCP-HTTP` / `mcp-http-session-deleted` (row remains in B4 with WP6 phase note). Counted fixtures: **763** (`coverage-validation.json`).

**Parallelization:** B1–B6 definitions and later isolated `g9Family*.ts` work may proceed in parallel after WP4 freeze. **Serial integrators:** B5 → `terminal/Manager.ts` (B2 handoff); B4 → `provider/**` (B2 handoff for FILE-LOGS provider phase, FILE-PROVIDER-SESSION cache phases, FLAG-CODEX-LAUNCH); generator → `regen_coverage_ledger.py`. See plan § [WP5 serial hotspots](../../superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md#wp5-serial-hotspots-normative).

# S3 dual-run-exit evidence

<!-- Agent: G10 S3 Ordered proof step 5. Live path retired for wired fifteen; TEL-DESKTOP-CONTROL handoff-deferred. -->

- Date: 2026-10-18
- Slice: **S3**
- Step: **dual-run-exit**
- Phase: `exited`
- Authority: **manifold**
- inversionArmed: `false` (armed only at next step)
- S3 inventory comm_ids (16): INV-T2-EDITOR-LAUNCH, INV-T2-GIT, INV-T2-HTTP-SERVE, INV-T2-NET-TCP, INV-T2-PREVIEW-SCAN, INV-T2-PROJECT-SETUP, INV-T2-RELAY-AWARENESS, INV-T2-RELAY-CLIENT, INV-T2-RELAY-HTTP, INV-T2-SC-ADO, INV-T2-SC-BITBUCKET, INV-T2-SC-GITHUB, INV-T2-SC-GITLAB, INV-T2-TAILSCALE, INV-T2-TEL-ANALYTICS, INV-T2-TEL-DESKTOP-CONTROL

## Wired + exited (15) — exit criteria (a)/(e)

Manifold admit/route/replace wired via `g10SeamBridge`; live path retired for:

| comm_id                  | Call site                                      |
| ------------------------ | ---------------------------------------------- |
| `INV-T2-GIT`             | `VcsDriver.ts` (sole lander; GIT methods only) |
| `INV-T2-RELAY-CLIENT`    | `relayClient.ts` (sole lander; spawn/exit)     |
| `INV-T2-EDITOR-LAUNCH`   | `externalLauncher.ts`                          |
| `INV-T2-HTTP-SERVE`      | `serverRuntimeStartup.ts`                      |
| `INV-T2-NET-TCP`         | `packages/shared/src/Net.ts`                   |
| `INV-T2-PREVIEW-SCAN`    | `PortScanner.ts`                               |
| `INV-T2-PROJECT-SETUP`   | `ProjectSetupScriptRunner.ts`                  |
| `INV-T2-RELAY-AWARENESS` | `AgentAwarenessRelay.ts`                       |
| `INV-T2-RELAY-HTTP`      | `cloud/http.ts`                                |
| `INV-T2-SC-ADO`          | `AzureDevOpsCli.ts`                            |
| `INV-T2-SC-BITBUCKET`    | `BitbucketApi.ts`                              |
| `INV-T2-SC-GITHUB`       | `GitHubCli.ts`                                 |
| `INV-T2-SC-GITLAB`       | `GitLabCli.ts`                                 |
| `INV-T2-TAILSCALE`       | `packages/tailscale/src/tailscale.ts`          |
| `INV-T2-TEL-ANALYTICS`   | `AnalyticsService.ts`                          |

## Handoff-deferred (1) — not exit (a)

| comm_id                      | Status                                                                                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INV-T2-TEL-DESKTOP-CONTROL` | S3→S5 handoff-pending on `DesktopTelemetryReceiver.ts`. Ledger stub only. **Do not claim S3-wired or dual-run-exit (a) for this row from S3.** See `docs/scm/g10/handoffs/S3-TEL-DESKTOP-CONTROL-to-S5.md`. |

## Measurable exit (decisions.md) — scoped

- (a) Manifold admit/route/replace wired for the **fifteen S3** seams above (not TEL-DESKTOP-CONTROL)
- (b) Live-authoritative rehearsal green (`S3-live-rehearsal.md`)
- (c) Cutover ≡ recorded (`S3-cutover-equivalence.md`) — wired fifteen bridge traffic; TEL-DESKTOP-CONTROL handoff stub disclosed
- (d) Rollback drill once OK (`S3-rollback-drill.md`)
- (e) Live path marked retired for the **wired fifteen** — **this record**

## Sole owner

Authority flip performed **only** by `recordOrderedProofStep(model, "S3", "dual-run-exit")`
(`g10ProofHarness.ts`). `markDualRunExited` **refuses** (S0 escalation
KEEP_A / `S0-escalation-proof-step-sole-owner.md`).

## Verdict

**GREEN** for S3 Ordered proof on the wired fifteen + TEL-DESKTOP-CONTROL handoff disclosure.
Not an all-16 Engine-wired exit claim (TEL-DESKTOP-CONTROL deferred to S5).

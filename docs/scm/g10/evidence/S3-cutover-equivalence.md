# S3 cutover-equivalence evidence

<!-- Agent: G10 S3 Ordered proof step 3. ≡ under G9DeferredEquality — honesty partition. -->

- Date: 2026-10-18
- Slice: **S3**
- Step: **cutover-equivalence**
- Phase: `equiv`
- Authority: **live**
- inversionArmed: `false`
- S3 inventory comm_ids (16): INV-T2-EDITOR-LAUNCH, INV-T2-GIT, INV-T2-HTTP-SERVE, INV-T2-NET-TCP, INV-T2-PREVIEW-SCAN, INV-T2-PROJECT-SETUP, INV-T2-RELAY-AWARENESS, INV-T2-RELAY-CLIENT, INV-T2-RELAY-HTTP, INV-T2-SC-ADO, INV-T2-SC-BITBUCKET, INV-T2-SC-GITHUB, INV-T2-SC-GITLAB, INV-T2-TAILSCALE, INV-T2-TEL-ANALYTICS, INV-T2-TEL-DESKTOP-CONTROL
- Carrier: `asG9DeferredEquality` (`g10ProofHarness.ts` / `G9DeferredEquality`)

## Wired seams (15) — bridge traffic ≡

Live-vs-manifold identity after admit/route/replace via `g10SeamBridge` (not
G9 capture-beside alone):

| comm_id                               | Sample projection (representative)                |
| ------------------------------------- | ------------------------------------------------- |
| `INV-T2-GIT`                          | `{ "method": "execute" }` (VcsDriver sole lander) |
| `INV-T2-RELAY-CLIENT`                 | `{ "site": "spawned" }` (relayClient sole lander) |
| `INV-T2-EDITOR-LAUNCH`                | `{ "comm_id": "present" }`                        |
| `INV-T2-HTTP-SERVE`                   | `{ "site": "listening" }`                         |
| `INV-T2-NET-TCP`                      | `{ "result_class": "available" }`                 |
| `INV-T2-PREVIEW-SCAN`                 | `{ "comm_id": "present" }`                        |
| `INV-T2-PROJECT-SETUP`                | `{ "site": "project-setup-started" }`             |
| `INV-T2-RELAY-AWARENESS`              | `{ "operation": "publishAgentActivity" }`         |
| `INV-T2-RELAY-HTTP`                   | `{ "member_id": "environment-link" }`             |
| `INV-T2-SC-ADO` / `GITHUB` / `GITLAB` | `{ "comm_id": "cli-execute-succeeded" }`          |
| `INV-T2-SC-BITBUCKET`                 | `{ "operation": "request" }`                      |
| `INV-T2-TAILSCALE`                    | `{ "operation": "configure" }`                    |
| `INV-T2-TEL-ANALYTICS`                | `{ "comm_id": "present" }`                        |

Call sites: `VcsDriver.ts`, `relayClient.ts`, plus peer capture modules via
`g10SliceS3.ts` helpers / shared `g10S3CutoverHook`.

## Handoff-deferred (1) — stub only

| comm_id                      | Notes                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INV-T2-TEL-DESKTOP-CONTROL` | S3→S5 handoff on `DesktopTelemetryReceiver.ts`. Ledger A stub pair for Ordered-proof carrier coverage only. **Not** admit/route/replace wiring. **Not** credited as S3-wired ≡. |

## Explicitly not

- WP8 763-fixture-as-G10-proof (`refuse763AsProof`)
- Treating TEL-DESKTOP-CONTROL stub as dual-run-exit (a)
- Committing `DesktopTelemetryReceiver.ts` from S3
- Stealing FILE-CHECKPOINTS (S7) on VcsDriver or FLAG-CLOUDFLARED (S7) on relayClient

## Verdict

**GREEN** — wired fifteen ≡ under bridge traffic; TEL-DESKTOP-CONTROL disclosed as handoff-deferred stub.

# B2 → B3 handoff: VCS checkpoints + cloudflared flag

<!-- Agent: W5a patch description only. B3 sole lander for VcsDriver.ts and relayClient.ts. B2 must not commit those live files. -->

- Bundle owner: **B2** (`g9FamilyFileDbProcessConfig.ts`)
- Integrator: **B3** (`g9FamilySubprocessExternalTransport.ts` owner)
- Helper module: `apps/server/src/scm/g9FamilyFileDbProcessConfig.ts`
- Live files:
  - `apps/server/src/vcs/VcsDriver.ts` (ledger `capture_module` / serial hotspot)
  - `packages/shared/src/relayClient.ts`

## A. `INV-T2-FILE-CHECKPOINTS` (5 phases)

Ledger lists `capture_module: apps/server/src/vcs/VcsDriver.ts`. Concrete success returns today live on `GitVcsDriver.ts` `checkpoints` (~702+): `captureCheckpoint`, `hasCheckpointRef`, `restoreCheckpoint`, `diffCheckpoints`, `deleteCheckpointRefs`.

B3 lands capture on the VCS checkpoint success path (wrap `VcsCheckpointOps` or hook each GitVcsDriver success return). Planning ownership stays B2.

| `phase_id`                                  | Helper                                                                                                    | Capture input                           |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `checkpoint-captureCheckpoint-succeeded`    | `captureCheckpointSucceeded("captureCheckpoint", …)` / `buildCheckpointCaptureInput("captureCheckpoint")` | `{ operation: "captureCheckpoint" }`    |
| `checkpoint-restoreCheckpoint-succeeded`    | `…("restoreCheckpoint", …)`                                                                               | `{ operation: "restoreCheckpoint" }`    |
| `checkpoint-diffCheckpoints-succeeded`      | `…("diffCheckpoints", …)`                                                                                 | `{ operation: "diffCheckpoints" }`      |
| `checkpoint-deleteCheckpointRefs-succeeded` | `…("deleteCheckpointRefs", …)`                                                                            | `{ operation: "deleteCheckpointRefs" }` |
| `checkpoint-hasCheckpointRef-succeeded`     | `…("hasCheckpointRef", …)`                                                                                | `{ operation: "succeeded" }`            |

### Call sites

- Interface: `VcsCheckpointOps` in `VcsDriver.ts` (~41–52).
- Implementation: `GitVcsDriver.ts` checkpoints object (~702–888+).
- When: after each op Effect succeeds (for `hasCheckpointRef` / `restoreCheckpoint`, after a successful boolean resolution per ledger success predicate; do not capture on `VcsError`).
- Note: `hasCheckpointRef` input uses `"succeeded"`, not `"hasCheckpointRef"`.

## B. `INV-T2-FLAG-CLOUDFLARED` / `flag-resolved`

| Field      | Value                                                                          |
| ---------- | ------------------------------------------------------------------------------ |
| Live file  | `packages/shared/src/relayClient.ts`                                           |
| Env member | `T3CODE_CLOUDFLARED_PATH` (`CLOUDFLARED_PATH_ENV_NAME`, ~23)                   |
| Helper     | `captureFlagCloudflaredResolved` / `buildFlagCloudflaredResolvedCaptureInput`  |
| Input      | `{ member: "T3CODE_CLOUDFLARED_PATH", state_label: "configured" \| "absent" }` |

### Call site

- Config: `CloudflaredConfig.executableOverride` via `trimmedString(CLOUDFLARED_PATH_ENV_NAME)` (~116–118).
- Resolve path: `makeCloudflaredRelayClient` uses `config.executableOverride` (~226+).
- When: once per successful flag resolution at the declared site.
  - `"configured"` when override Option is Some (non-empty trimmed path present).
  - `"absent"` when Option is None.
- Do not capture install/download success as this phase. Do not invent new env keys.

## Integrator checklist

1. Import B2 helpers; B3 commits only under its sole-lander files.
2. `captureOccurrence` only; no FIFO ownership.
3. Checkpoint captures carry operation tokens only (no refs, cwd, or diffs in A).
4. Run B2 family tests for checkpoint + cloudflared builders after landing.

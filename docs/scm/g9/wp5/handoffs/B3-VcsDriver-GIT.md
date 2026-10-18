# B3 live-landing notes: INV-T2-GIT on VcsDriver

**Planning owner:** WP5-B3 (`g9FamilySubprocessExternalTransport.ts`)
**Sole lander:** WP5-B3-Owner (RFC-014 **A**)
**Live file:** `apps/server/src/vcs/VcsDriver.ts`
**W5a status:** helpers + notes only. Do **not** edit VcsDriver.ts in W5a.

## Phase

| `comm_id`    | `phase`                 | Helper                       | Equality A                          |
| ------------ | ----------------------- | ---------------------------- | ----------------------------------- |
| `INV-T2-GIT` | `git-execute-succeeded` | `captureGitExecuteSucceeded` | `{ method: <GitVcsDriver method> }` |

`method` finite domain: `execute`, `detectRepository`, `isInsideWorkTree`, `listWorkspaceFiles`, `listRemotes`, `filterIgnoredPaths`, `initRepository`.

## Live sites (B3 later land)

Call `captureGitExecuteSucceeded(capture, method)` only after the matching public VcsDriver method completes with declared success (including `allowNonZeroExit` when that is live success). Do not put stdout, stderr, cwd, argv, or error strings into A.

Integrate **B2** `INV-T2-FILE-CHECKPOINTS` handoff on this file before GIT capture lands (plan serial hotspot).

## Forbidden in W5a

- Commits to `VcsDriver.ts`
- Payload / error-string retention in equality A
- OTLP rows (WP6)
